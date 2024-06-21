import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, network } from 'hardhat';

import type { FeeCollector, MockERC20, WETH } from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { BigNumber, Wallet } from 'ethers';

import { ZERO_ADDRESS } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/helpers';

const { parseEther } = ethers.utils;

describe(`Fee-Collector - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let feeCollector: FeeCollector;
  let mockERC20: MockERC20;
  let WETH: WETH;

  let mint20: UnseenFixtures['mint20'];
  let depositETH: UnseenFixtures['depositETH'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let operator: Wallet;
  let malicious: Wallet;
  let withdrawalWallet: Wallet;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    operator = new ethers.Wallet(randomHex(32), provider);
    malicious = new ethers.Wallet(randomHex(32), provider);
    withdrawalWallet = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, operator, malicious]) {
      await faucet(wallet.address, provider);
    }

    return { owner, operator, malicious, withdrawalWallet };
  }

  before(async () => {
    ({ owner, operator, malicious, withdrawalWallet } =
      await loadFixture(setupFixture));

    ({ mint20, mockERC20, WETH, depositETH } = await unseenFixture(owner));
  });

  beforeEach(async function () {
    ({ feeCollector } = await unseenFixture(owner));
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('FeeCollector', ...args);
      if (expectedError)
        await expect(deployment).to.be.revertedWithCustomError(
          feeCollector,
          expectedError
        );
      else {
        const collector = await deployment;
        expect(await collector.owner()).to.eq(owner.address);
        expect(await collector.name()).to.eq('unseen-fee-collector');
      }
    };

    it('reverts if owner is set to address 0', async function () {
      const t = async (ownerToSet: string, expectSuccess: boolean) => {
        await testConstructor(
          expectSuccess ? '' : 'NewOwnerIsZeroAddress',
          ownerToSet
        );
      };
      await t(ZERO_ADDRESS, false);
      await t(owner.address, true);
    });
  });

  context('ownership and authority', async function () {
    it('only owner can set and update _operator', async function () {
      // Revert if not owner.
      await expect(
        feeCollector.connect(malicious).assignOperator(operator.address)
      ).to.be.revertedWithCustomError(feeCollector, 'Unauthorized');

      await feeCollector.connect(owner).assignOperator(operator.address);

      // Assert operator is set.
      expect(await feeCollector._operator()).to.equal(operator.address);

      // Revert even if operator.
      await expect(
        feeCollector.connect(operator).assignOperator(malicious.address)
      ).to.be.revertedWithCustomError(feeCollector, 'Unauthorized');
    });

    it('only owner can set or remove and withdrawAddress', async function () {
      await feeCollector.connect(owner).assignOperator(operator.address);

      // Revert non owner (even operator) adding withdrawal wallet.
      await expect(
        feeCollector.connect(operator).addWithdrawAddress(operator.address)
      ).to.be.revertedWithCustomError(feeCollector, 'Unauthorized');

      // Add withdrawal wallet
      await feeCollector
        .connect(owner)
        .addWithdrawAddress(withdrawalWallet.address);

      // Assert withdrawal wallet is set correctly.
      expect(
        await feeCollector.isWithdrawalWallet(withdrawalWallet.address)
      ).to.equal(true);

      // Revert non owner (even operator) removing withdrawal wallet.
      await expect(
        feeCollector
          .connect(operator)
          .removeWithdrawAddress(withdrawalWallet.address)
      ).to.be.revertedWithCustomError(feeCollector, 'Unauthorized');

      // Remove withdrawal wallet
      await feeCollector
        .connect(owner)
        .removeWithdrawAddress(withdrawalWallet.address);

      // Assert withdrawal wallet is set correctly.
      expect(
        await feeCollector.isWithdrawalWallet(withdrawalWallet.address)
      ).to.equal(false);
    });
  });

  context('deposits and withdraws', async function () {
    const value: BigNumber = parseEther('1');
    const erc20Amount: BigNumber = parseEther('1000000');

    beforeEach(async function () {
      await mint20(feeCollector, erc20Amount);

      await depositETH(owner, value);

      await owner.sendTransaction({
        to: feeCollector.address,
        value,
      });
    });

    it('should allow tokens [native & erc20] deposits', async function () {
      expect(await provider.getBalance(feeCollector.address)).eq(
        parseEther('1')
      );

      expect(await mockERC20.balanceOf(feeCollector.address)).eq(
        parseEther('1000000')
      );
    });

    it('only owner or operator can call withdraw functions with correct params', async function () {
      // Assign operator
      await feeCollector.connect(owner).assignOperator(operator.address);

      // Revert if not operator withdrawing native tokens.
      await expect(
        feeCollector
          .connect(malicious)
          .withdraw(withdrawalWallet.address, value)
      ).to.be.revertedWithCustomError(feeCollector, 'InvalidOperator');

      // Revert if whitelisted wallet not set.
      await expect(
        feeCollector.connect(operator).withdraw(withdrawalWallet.address, value)
      ).to.be.revertedWithCustomError(feeCollector, 'InvalidWithdrawalWallet');

      // Add withdrawal wallet
      await feeCollector
        .connect(owner)
        .addWithdrawAddress(withdrawalWallet.address);

      // Revert with value > feeCollector balance
      await expect(
        feeCollector
          .connect(operator)
          .withdraw(withdrawalWallet.address, value.mul(2))
      ).to.be.revertedWithCustomError(feeCollector, 'InvalidNativeTokenAmount');

      // Withdraw ETH value from feeCollector.
      await feeCollector
        .connect(operator)
        .withdraw(withdrawalWallet.address, value);

      // Assert ETH balance is correct after withdrawal.
      expect(await ethers.provider.getBalance(withdrawalWallet.address)).eq(
        parseEther('1')
      );

      // Withdraw the correct amount of erc20 tokens to withdrawal wallet.
      await feeCollector
        .connect(operator)
        .withdrawERC20Tokens(
          withdrawalWallet.address,
          mockERC20.address,
          erc20Amount
        );

      expect(await mockERC20.balanceOf(withdrawalWallet.address)).eq(
        parseEther('1000000')
      );

      // Revert if owner/operator try to withdraw non existant erc20 balance.
      await expect(
        feeCollector
          .connect(operator)
          .withdrawERC20Tokens(
            withdrawalWallet.address,
            mockERC20.address,
            erc20Amount
          )
      )
        .to.be.revertedWithCustomError(
          feeCollector,
          'TokenTransferGenericFailure'
        )
        .withArgs(mockERC20.address, withdrawalWallet.address, 0, erc20Amount);

      await WETH.connect(owner).transfer(feeCollector.address, value);

      // Withdraw the correct amount of wrapped tokens in unwrapped version of it.
      await feeCollector
        .connect(operator)
        .unwrapAndWithdraw(withdrawalWallet.address, WETH.address, value);

      // Assert ETH balance is correct after unwrapping native tokens.
      expect(await ethers.provider.getBalance(withdrawalWallet.address)).eq(
        value.mul(2)
      );
    });
  });
});
