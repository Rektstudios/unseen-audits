import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type { FeeCollector, MockERC20, TheGenerates } from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { BigNumber, Wallet } from 'ethers';

import { openseaConduitAddress } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { whileImpersonating } from '@utils/impersonate';

describe(`The Generates - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let theGenerates: TheGenerates;
  let feeCollector: FeeCollector;
  let mockERC20: MockERC20;

  let mintPublicTokens: UnseenFixtures['mintPublicTokens'];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];
  let updateUnseenPayout: UnseenFixtures['updateUnseenPayout'];
  let updatePaymentToken: UnseenFixtures['updatePaymentToken'];
  let setMaxSupply: UnseenFixtures['setMaxSupply'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let minter: Wallet;
  let malicious: Wallet;

  let amount: BigNumber;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    minter = new ethers.Wallet(randomHex(32), provider);
    malicious = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, minter, malicious]) {
      await faucet(wallet.address, provider);
    }

    return { owner, minter, malicious };
  }

  before(async () => {
    ({ owner, minter, malicious } = await loadFixture(setupFixture));

    ({ feeCollector } = await unseenFixture(owner));
  });

  beforeEach(async function () {
    ({
      theGenerates,
      mockERC20,
      mintAndApproveERC20,
      mintPublicTokens,
      updateUnseenPayout,
      updatePaymentToken,
      setMaxSupply,
    } = await unseenFixture(owner));

    await updateUnseenPayout({ payoutAddress: feeCollector.address });
    await updatePaymentToken({ token: mockERC20.address });
    await setMaxSupply({ supply: 10 });

    amount = parseEther('1000');
    await mockERC20.mint(owner.address, amount);
    await mintAndApproveERC20(minter, theGenerates.address, amount);
  });

  context('token transfers and approvals', function () {
    it('should be able to transfer successfully', async () => {
      await mintPublicTokens({
        minter,
        quantity: 4,
      });
      expect(await theGenerates.balanceOf(minter.address)).to.eq(4);
      await theGenerates
        .connect(minter)
        .transferFrom(minter.address, owner.address, 1);

      await theGenerates
        .connect(minter)
        ['safeTransferFrom(address,address,uint256)'](
          minter.address,
          owner.address,
          2
        );

      await theGenerates
        .connect(minter)
        ['safeTransferFrom(address,address,uint256,bytes)'](
          minter.address,
          owner.address,
          3,
          Buffer.from('dadb0d', 'hex')
        );

      expect(await theGenerates.balanceOf(owner.address)).to.eq(3);

      await theGenerates.connect(minter).setApprovalForAll(owner.address, true);
      await theGenerates.connect(minter).approve(owner.address, 4);

      // should auto-approve the conduit to transfer.
      expect(
        await theGenerates.isApprovedForAll(
          minter.address,
          openseaConduitAddress
        )
      ).to.eq(true);

      expect(
        await theGenerates.isApprovedForAll(
          owner.address,
          openseaConduitAddress
        )
      ).to.eq(true);

      await whileImpersonating(
        openseaConduitAddress,
        provider,
        async (impersonatedSigner) => {
          await theGenerates
            .connect(impersonatedSigner)
            .transferFrom(owner.address, minter.address, 1);
          await theGenerates
            .connect(impersonatedSigner)
            ['safeTransferFrom(address,address,uint256)'](
              owner.address,
              minter.address,
              2
            );
          await theGenerates
            .connect(impersonatedSigner)
            ['safeTransferFrom(address,address,uint256,bytes)'](
              owner.address,
              minter.address,
              3,
              Buffer.from('dadb0d', 'hex')
            );
        }
      );

      //should not allow a non-approved address to transfer.
      await expect(
        theGenerates
          .connect(malicious)
          .transferFrom(minter.address, owner.address, 1)
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );

      await expect(
        theGenerates
          .connect(malicious)
          ['safeTransferFrom(address,address,uint256)'](
            minter.address,
            owner.address,
            2
          )
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );

      await expect(
        theGenerates
          .connect(malicious)
          ['safeTransferFrom(address,address,uint256,bytes)'](
            minter.address,
            owner.address,
            3,
            Buffer.from('dadb0d', 'hex')
          )
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );
    });
  });

  context('tokens burn', function () {
    it('only owner or approved can burn their tokens', async () => {
      await mintPublicTokens({
        minter,
        quantity: 3,
      });

      expect(await theGenerates.ownerOf(1)).to.equal(minter.address);
      expect(await theGenerates.ownerOf(2)).to.equal(minter.address);
      expect(await theGenerates.ownerOf(3)).to.equal(minter.address);
      expect(await theGenerates.totalSupply()).to.equal(3);

      // Only the owner or approved of the minted theGenerates should be able to burn it.
      await expect(
        theGenerates.connect(owner).burn(1)
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );
      await expect(
        theGenerates.connect(malicious).burn(1)
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );
      await expect(
        theGenerates.connect(malicious).burn(2)
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );
      await expect(
        theGenerates.connect(malicious).burn(3)
      ).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );

      expect(await theGenerates.ownerOf(1)).to.equal(minter.address);
      expect(await theGenerates.ownerOf(2)).to.equal(minter.address);
      expect(await theGenerates.ownerOf(3)).to.equal(minter.address);
      expect(await theGenerates.totalSupply()).to.equal(3);

      await theGenerates.connect(minter).burn(1);

      expect(await theGenerates.totalSupply()).to.equal(2);

      await theGenerates.connect(minter).setApprovalForAll(owner.address, true);
      await theGenerates.burn(2);

      expect(await theGenerates.totalSupply()).to.equal(1);

      await theGenerates
        .connect(minter)
        .setApprovalForAll(owner.address, false);
      await expect(theGenerates.burn(3)).to.be.revertedWithCustomError(
        theGenerates,
        'TransferCallerNotOwnerNorApproved'
      );

      await theGenerates.connect(minter).approve(owner.address, 3);
      await theGenerates.burn(3);

      expect(await theGenerates.totalSupply()).to.equal(0);

      await expect(theGenerates.ownerOf(1)).to.be.revertedWithCustomError(
        theGenerates,
        'OwnerQueryForNonexistentToken'
      );
      await expect(theGenerates.ownerOf(2)).to.be.revertedWithCustomError(
        theGenerates,
        'OwnerQueryForNonexistentToken'
      );
      expect(await theGenerates.totalSupply()).to.equal(0);

      // should not be able to burn a nonexistent theGenerates.
      for (const theGeneratesId of [1, 2, 3]) {
        await expect(
          theGenerates.connect(minter).burn(theGeneratesId)
        ).to.be.revertedWithCustomError(
          theGenerates,
          'OwnerQueryForNonexistentToken'
        );
      }
    });
  });

  context('funds withdrawal', function () {
    it('should allow the contract owner to withdraw all funds in the contract', async () => {
      await expect(
        theGenerates.connect(minter).withdraw()
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      await expect(
        theGenerates.connect(owner).withdraw()
      ).to.be.revertedWithCustomError(theGenerates, 'NoBalanceToWithdraw');

      // Send some balance to the contract.
      await mintPublicTokens({
        minter,
      });

      await theGenerates
        .connect(minter)
        .approve(owner.address, 1, { value: 100 });
      expect(await provider.getBalance(theGenerates.address)).to.equal(100);

      const ownerBalanceBefore = await provider.getBalance(owner.address);
      const tx = await theGenerates.connect(owner).withdraw();
      const receipt = await tx.wait();
      const txCost = receipt.gasUsed.mul(receipt.effectiveGasPrice);

      const ownerBalanceAfter = await provider.getBalance(owner.address);
      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore.sub(txCost).add(100)
      );

      expect(await provider.getBalance(theGenerates.address)).to.equal(0);

      const tokensCount = 10;

      await mockERC20
        .connect(minter)
        .transfer(theGenerates.address, tokensCount);

      expect(await mockERC20.balanceOf(theGenerates.address)).to.eq(
        tokensCount
      );

      await theGenerates.connect(owner).withdrawERC20(mockERC20.address);

      expect(await mockERC20.balanceOf(owner.address)).to.eq(
        amount.add(tokensCount)
      );

      // Owner storage slot from solady's Ownable.sol
      const ownerStorageSlot =
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffff74873927';

      const revertedRecipientFactory =
        await ethers.getContractFactory('RevertedRecipient');
      const revertedRecipient = await revertedRecipientFactory.deploy();
      // theGenerates.address will revert with no data, and RevertedRecipient will revert with custom error.
      const ownerAddresses = [theGenerates.address, revertedRecipient.address];

      for (const ownerAddress of ownerAddresses) {
        const ownerStorageValue =
          '0x' + ownerAddress.slice(2).padStart(64, '0');
        await provider.send('hardhat_setStorageAt', [
          theGenerates.address,
          ownerStorageSlot,
          ownerStorageValue,
        ]);
        expect(await theGenerates.owner()).to.equal(ownerAddress);
        await theGenerates
          .connect(minter)
          .approve(owner.address, 1, { value: 100 });
        await whileImpersonating(
          ownerAddress,
          provider,
          async (impersonatedSigner) => {
            await expect(theGenerates.connect(impersonatedSigner).withdraw()).to
              .be.reverted;
          }
        );
      }
    });
  });
});
