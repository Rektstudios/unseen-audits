import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, network } from 'hardhat';

import type { UnseenFixtures } from '@utils/fixtures';
import type { BigNumber, Wallet } from 'ethers';

import {
  type MockDelegateCaller,
  type MockERC1155,
  type MockERC20,
  type MockERC721,
  type UnseenAtomicizer,
} from '@typechained';
import { deployContract } from '@utils/contracts';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { minRandom } from '@utils/helpers';

describe(`Atomicizer - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let mockERC721: MockERC721;
  let mockERC1155: MockERC1155;
  let atomicizer: UnseenAtomicizer;
  let delegateCaller: MockDelegateCaller;

  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];
  let mintAndApprove721: UnseenFixtures['mintAndApprove721'];
  let mintAndApprove1155: UnseenFixtures['mintAndApprove1155'];
  let atomicize: UnseenFixtures['atomicize'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;

  let erc721Id: BigNumber;
  let erc1155Id: BigNumber;
  let erc20Amount: BigNumber;
  let amount: BigNumber;

  let targets: string[];
  let calldatas: string[];

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, alice };
  }

  before(async () => {
    ({ owner, bob, alice } = await loadFixture(setupFixture));

    ({
      atomicizer,
      mockERC20,
      mockERC721,
      mockERC1155,
      mintAndApproveERC20,
      mintAndApprove721,
      mintAndApprove1155,
      atomicize,
    } = await unseenFixture(owner));

    delegateCaller = await deployContract('MockDelegateCaller', owner);

    erc20Amount = minRandom(100);
  });

  beforeEach(async function () {
    targets = [mockERC20.address, mockERC1155.address, mockERC721.address];

    await mintAndApproveERC20(bob, atomicizer.address, erc20Amount);
    erc721Id = await mintAndApprove721(bob, atomicizer.address);
    ({ nftId: erc1155Id, amount } = await mintAndApprove1155(
      bob,
      atomicizer.address,
      25
    ));

    calldatas = [
      mockERC20.interface.encodeFunctionData('transferFrom', [
        bob.address,
        alice.address,
        erc20Amount,
      ]),
      mockERC1155.interface.encodeFunctionData('safeTransferFrom', [
        bob.address,
        alice.address,
        erc1155Id,
        amount,
        [],
      ]),
      mockERC721.interface.encodeFunctionData('transferFrom', [
        bob.address,
        alice.address,
        erc721Id,
      ]),
    ];
  });

  context('execute multiple transactions atomically in order', function () {
    it('should fail if arrays length mismatch', async function () {
      const slicedData = [...calldatas.splice(2, 1)];
      await expect(
        atomicize({ targets, calldatas: slicedData })
      ).to.be.revertedWithCustomError(atomicizer, 'LengthsMismatch');

      await expect(
        atomicize({ targets, calldatas })
      ).to.be.revertedWithCustomError(atomicizer, 'LengthsMismatch');
    });
    it('should not fail if all transactions gets executed', async function () {
      await expect(atomicize({ targets, calldatas })).to.not.be.rejected;
      expect(await mockERC20.balanceOf(alice.address)).to.eq(erc20Amount);
      expect(await mockERC721.ownerOf(erc721Id)).to.eq(alice.address);
      expect(await mockERC1155.balanceOf(alice.address, erc1155Id)).to.eq(
        amount
      );
    });
    it('should fail if 1 transaction reverts', async function () {
      calldatas[2] = mockERC721.interface.encodeFunctionData('transferFrom', [
        alice.address,
        bob.address,
        erc721Id,
      ]);
      await expect(
        atomicize({ targets, calldatas })
      ).to.be.revertedWithCustomError(atomicizer, 'SubcallFailed');
    });
    it('can delegate transactions to atomicizer', async function () {
      await mockERC20.connect(bob).approve(delegateCaller.address, erc20Amount);
      await mockERC721
        .connect(bob)
        .setApprovalForAll(delegateCaller.address, true);
      await mockERC1155
        .connect(bob)
        .setApprovalForAll(delegateCaller.address, true);
      const data = atomicizer.interface.encodeFunctionData('atomicize', [
        targets,
        calldatas,
      ]);
      await delegateCaller.delegateCall(atomicizer.address, data);
      expect(await mockERC20.balanceOf(alice.address)).to.eq(
        erc20Amount.mul(2)
      );
      expect(await mockERC721.ownerOf(erc721Id)).to.eq(alice.address);
      expect(await mockERC1155.balanceOf(alice.address, erc1155Id)).to.eq(
        amount
      );
    });
  });
});
