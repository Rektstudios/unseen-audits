import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { _TypedDataEncoder } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type { UnseenToken } from '@typechained';
import type { PermitData } from '@utils/types';
import type { BigNumber, Wallet } from 'ethers';

import { ZERO_ADDRESS } from '@constants';
import { deployContract as deploy } from '@utils/contracts';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { deployContract } from '@utils/helpers';
import { clock, duration } from '@utils/time';
import { EIP712Domain } from 'eip-712-types/domain';
import { permit } from 'eip-712-types/permit';

const { parseEther } = ethers.utils;

describe(`UNCN governance token - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let uncn: UnseenToken;

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let spender: Wallet;
  let malicious: Wallet;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    spender = new ethers.Wallet(randomHex(32), provider);
    malicious = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, malicious, spender]) {
      await faucet(wallet.address, provider);
    }

    return { owner, spender, malicious };
  }

  before(async () => {
    ({ owner, spender, malicious } = await loadFixture(setupFixture));
  });

  beforeEach(async function () {
    uncn = await deploy('UnseenToken', owner, owner.address);
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('UnseenToken', ...args);
      if (expectedError)
        await expect(deployment).to.be.revertedWithCustomError(
          uncn,
          expectedError
        );
      else {
        const uncn = await deployment;
        expect(await uncn.owner()).to.eq(owner.address);
        expect(await uncn.balanceOf(owner.address)).to.eq(
          parseEther('1000000000')
        );
      }
    };

    it('reverts if ownerToSet is address 0', async function () {
      const t = async (ownerToSet: string, expectedError: string) => {
        await testConstructor(expectedError, ownerToSet);
      };
      await t(ZERO_ADDRESS, 'OwnableInvalidOwner');
      await t(owner.address, '');
    });
  });

  context('ownership and authority', async function () {
    it('only owner can pause contract', async function () {
      // Revert if not owner pause.
      await expect(
        uncn.connect(malicious).pause()
      ).to.be.revertedWithCustomError(uncn, 'OwnableUnauthorizedAccount');

      await uncn.connect(owner).pause();

      // Assert contract is paused.
      expect(await uncn.paused()).to.equal(true);

      // Revert if not owner unpause.
      await expect(
        uncn.connect(malicious).unpause()
      ).to.be.revertedWithCustomError(uncn, 'OwnableUnauthorizedAccount');

      await uncn.connect(owner).unpause();

      // Assert contract is unpasued.
      expect(await uncn.paused()).to.equal(false);
    });
  });

  context('offchain token permit {eip-2612}', async function () {
    const value = 42n;
    const nonce = 0n;
    const maxDeadline = ethers.constants.MaxUint256;
    // eslint-disable-next-line no-unused-vars
    let data: (contract: string, deadline?: BigNumber) => Promise<PermitData>;

    beforeEach(async function () {
      data = (contract: string, deadline = maxDeadline): Promise<PermitData> =>
        EIP712Domain('UNSEEN', contract, '1', 31337).then((domain) => ({
          domain,
          types: permit,
          message: {
            owner: owner.address,
            spender: spender.address,
            value,
            nonce,
            deadline,
          },
        }));
    });

    it('initial nonce is 0', async function () {
      expect(await uncn.nonces(owner.address)).to.equal(0n);
    });

    it('domain separator', async function () {
      expect(await uncn.DOMAIN_SEPARATOR()).to.equal(
        await EIP712Domain('UNSEEN', uncn.address, '1', 31337).then(
          _TypedDataEncoder.hashDomain
        )
      );
    });

    it('accepts owner signature', async function () {
      const { v, r, s } = await data(uncn.address)
        .then(({ domain, types, message }: PermitData) =>
          owner._signTypedData(domain, types, message)
        )
        .then(ethers.utils.splitSignature);

      await uncn.permit(
        owner.address,
        spender.address,
        value,
        maxDeadline,
        v,
        r,
        s
      );

      expect(await uncn.nonces(owner.address)).to.equal(1n);
      expect(await uncn.allowance(owner.address, spender.address)).to.equal(
        value
      );
    });

    it('rejects reused signature', async function () {
      const { v, r, s } = await data(uncn.address)
        .then(({ domain, types, message }: PermitData) =>
          owner._signTypedData(domain, types, message)
        )
        .then(ethers.utils.splitSignature);

      await uncn.permit(
        owner.address,
        spender.address,
        value,
        maxDeadline,
        v,
        r,
        s
      );

      const recovered = await data(uncn.address).then(
        ({ domain, types, message }) =>
          ethers.utils.verifyTypedData(
            domain,
            types,
            { ...message, nonce: nonce + 1n, deadline: maxDeadline },
            { v, r, s }
          )
      );

      await expect(
        uncn.permit(owner.address, spender.address, value, maxDeadline, v, r, s)
      )
        .to.be.revertedWithCustomError(uncn, 'ERC2612InvalidSigner')
        .withArgs(recovered, owner.address);
    });

    it('rejects other signature', async function () {
      const { v, r, s } = await data(uncn.address)
        .then(({ domain, types, message }: PermitData) =>
          malicious._signTypedData(domain, types, message)
        )
        .then(ethers.utils.splitSignature);

      await expect(
        uncn.permit(owner.address, spender.address, value, maxDeadline, v, r, s)
      )
        .to.be.revertedWithCustomError(uncn, 'ERC2612InvalidSigner')
        .withArgs(malicious.address, owner.address);
    });

    it('rejects expired permit', async function () {
      const deadline = (await clock.timestamp()).sub(duration.weeks(1));

      const { v, r, s } = await data(uncn.address, deadline)
        .then(({ domain, types, message }: PermitData) =>
          owner._signTypedData(domain, types, message)
        )
        .then(ethers.utils.splitSignature);

      await expect(
        uncn.permit(owner.address, spender.address, value, deadline, v, r, s)
      )
        .to.be.revertedWithCustomError(uncn, 'ERC2612ExpiredSignature')
        .withArgs(deadline);
    });

    it('transfer with data', async function () {
      const memoText = 'GameId: #1267512654123';
      const memoHex = ethers.utils
        .hexlify(ethers.utils.toUtf8Bytes(memoText))
        .slice(2);
      await expect(uncn.transferWithData(spender.address, 400, memoHex))
        .to.emit(uncn, 'TransferWithData')
        .withArgs(owner.address, spender.address, 400, memoHex);
    });
    it('transferFrom with data', async function () {
      const memoText = 'GameId: #1267512654123';
      const memoHex = ethers.utils
        .hexlify(ethers.utils.toUtf8Bytes(memoText))
        .slice(2);
      await uncn.approve(spender.address, 400);
      await expect(
        uncn
          .connect(spender)
          .transferFromWithData(owner.address, spender.address, 400, memoHex)
      )
        .to.emit(uncn, 'TransferWithData')
        .withArgs(owner.address, spender.address, 400, memoHex);
    });
  });
});
