import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  ITheGenerates,
  MockERC20,
  TheGenerates,
  TheGeneratesConfigurer,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { BigNumber, Wallet } from 'ethers';
import type { ConfigStructs } from 'typechained/contracts/shim/Shim';

import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { type AwaitedObject, getCustomRevertSelector } from '@utils/helpers';
import { MintType } from '@utils/types';

const { parseEther } = ethers.utils;

describe(`The Generates Public Mint - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let theGenerates: TheGenerates;
  let theGeneratesInterface: ITheGenerates;
  let configurer: TheGeneratesConfigurer;
  let feeCollector: FeeCollector;
  let mockERC20: MockERC20;

  let createMintOrder: UnseenFixtures['createMintOrder'];
  let updateUnseenPayout: UnseenFixtures['updateUnseenPayout'];
  let updatePaymentToken: UnseenFixtures['updatePaymentToken'];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];
  let setMaxSupply: UnseenFixtures['setMaxSupply'];
  let getMaxSupply: UnseenFixtures['getMaxSupply'];
  let params: UnseenFixtures['params'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let minter: Wallet;
  let bob: Wallet;
  let payer: Wallet;

  let amount: BigNumber;
  let parameters: AwaitedObject<ConfigStructs.MintParamsStruct>;

  const _PUBLIC_DROP_STAGE_INDEX = 0;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    minter = new ethers.Wallet(randomHex(32), provider);
    payer = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, minter, payer, bob]) {
      await faucet(wallet.address, provider);
    }

    return { owner, minter, bob, payer };
  }

  before(async () => {
    ({ owner, minter, bob, payer } = await loadFixture(setupFixture));

    ({ feeCollector } = await unseenFixture(owner));
  });

  beforeEach(async function () {
    ({
      params,
      configurer,
      theGenerates,
      mockERC20,
      setMaxSupply,
      mintAndApproveERC20,
      updateUnseenPayout,
      createMintOrder,
      updatePaymentToken,
      getMaxSupply,
      theGeneratesInterface,
    } = await unseenFixture(owner));

    await updateUnseenPayout({ payoutAddress: feeCollector.address });
    await updatePaymentToken({ token: mockERC20.address });
    await setMaxSupply({ supply: 10 });

    amount = parseEther('1000');
    parameters = params();
    await mockERC20.mint(owner.address, amount);
    await mintAndApproveERC20(minter, theGenerates.address, amount);
    await mintAndApproveERC20(payer, theGenerates.address, amount);

    await theGeneratesInterface.updatePublicDrop(parameters);
  });

  context('public mint', async function () {
    it('should mint a public stage', async () => {
      // Mint public with payer as minter.
      const quantity = 3;
      const { data } = await createMintOrder({
        quantity,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, _PUBLIC_DROP_STAGE_INDEX);

      expect(await theGenerates.balanceOf(minter.address)).to.eq(quantity);
      expect(await theGenerates.totalSupply()).to.eq(quantity);

      // Mint public with minter being payer.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, _PUBLIC_DROP_STAGE_INDEX);

      expect(await theGenerates.balanceOf(minter.address)).to.eq(quantity * 2);
      expect(await theGenerates.totalSupply()).to.eq(quantity * 2);
    });

    it("should not mint a public stage that hasn't started", async () => {
      // Set start time in the future.
      await theGeneratesInterface.updatePublicDrop({
        ...parameters,
        startTime: Math.round(Date.now() / 1000) + 100,
      });

      // Mint public with payer for minter.
      const { data } = await createMintOrder({
        quantity: 3,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'NotActive');

      // Mint public with minter being payer.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'NotActive');
    });

    it('should not mint a public stage that has ended', async () => {
      // should not allow startTime > endTime.
      await expect(
        theGeneratesInterface.updatePublicDrop(
          { ...parameters, endTime: 100 },
          { gasLimit: 50_000 }
        )
      )
        .to.be.revertedWithCustomError(configurer, 'InvalidStartAndEndTime')
        .withArgs(parameters.startTime, 100);

      // Set end time in the past.
      await theGeneratesInterface.updatePublicDrop({
        ...parameters,
        endTime: Math.round(Date.now() / 1000) - 999,
      });

      // Mint public with payer for minter.
      const { data } = await createMintOrder({
        quantity: 3,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });
      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'NotActive');

      // Mint public with minter being payer.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'NotActive');
    });

    it('should respect limit for max supply', async () => {
      // Mint 10.
      const quantity = 10;
      let { data } = await createMintOrder({
        quantity,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, _PUBLIC_DROP_STAGE_INDEX);

      // Minting now should throw MintQuantityExceedsMaxSupply.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      )
        .to.be.revertedWithCustomError(
          configurer,
          'MintQuantityExceedsMaxSupply'
        )
        .withArgs(2 * quantity, await getMaxSupply());

      // Update max supply to 15.
      await setMaxSupply({ supply: 15 });

      // mint 1 more
      ({ data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.PUBLIC,
      }));

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, _PUBLIC_DROP_STAGE_INDEX);
    });

    it('should not mint with incorrect payment', async () => {
      // Not Enough tokens to pay the mint price.
      const { data } = await createMintOrder({
        quantity: 2,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });

      const expectedRevertReason = getCustomRevertSelector(
        'TransferFromFailed()'
      );

      const tx = await bob.populateTransaction({
        to: theGenerates.address,
        data,
        gasLimit: 150_000,
      });
      const returnData = await provider.call(tx);
      expect(returnData).to.equal(expectedRevertReason);
    });

    it('should not be able to mint zero quantity', async () => {
      const { data } = await createMintOrder({
        quantity: 0,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });

      await expect(
        bob.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'QuantityNotSet');
    });
  });
});
