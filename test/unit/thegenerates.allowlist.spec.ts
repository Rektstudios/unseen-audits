import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  MockERC20,
  TheGenerates,
  TheGeneratesConfigurer,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { AwaitedObject } from '@utils/helpers';
import type { BigNumber, Wallet } from 'ethers';
import type { ConfigStructs } from 'typechained/contracts/shim/Shim';

import { ZERO_ADDRESS, ZERO_BYTES32 } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { MintType } from '@utils/types';

const { parseEther } = ethers.utils;

describe(`The Generates Allow List Mint - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let theGenerates: TheGenerates;
  let configurer: TheGeneratesConfigurer;
  let feeCollector: FeeCollector;
  let mockERC20: MockERC20;

  let updateAllowList: UnseenFixtures['updateAllowList'];
  let createMintOrder: UnseenFixtures['createMintOrder'];
  let updateSigner: UnseenFixtures['updateSigner'];
  let updateUnseenPayout: UnseenFixtures['updateUnseenPayout'];
  let updatePaymentToken: UnseenFixtures['updatePaymentToken'];
  let createAllowListAndGetProof: UnseenFixtures['createAllowListAndGetProof'];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];
  let setMaxSupply: UnseenFixtures['setMaxSupply'];
  let getAllowListMerkleRoot: UnseenFixtures['getAllowListMerkleRoot'];
  let params: UnseenFixtures['params'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let signer: Wallet;
  let minter: Wallet;
  let alice: Wallet;
  let payer: Wallet;

  let amount: BigNumber;
  let parameters: AwaitedObject<ConfigStructs.MintParamsStruct>;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    minter = new ethers.Wallet(randomHex(32), provider);
    payer = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    signer = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, minter, payer, alice]) {
      await faucet(wallet.address, provider);
    }

    return { owner, minter, signer, alice, payer };
  }

  before(async () => {
    ({ owner, minter, signer, alice, payer } = await loadFixture(setupFixture));

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
      updateSigner,
      updateUnseenPayout,
      createMintOrder,
      updatePaymentToken,
      createAllowListAndGetProof,
      updateAllowList,
      getAllowListMerkleRoot,
    } = await unseenFixture(owner));

    await updateSigner({ signer });
    await updateUnseenPayout({ payoutAddress: feeCollector.address });
    await updatePaymentToken({ token: mockERC20.address });
    await setMaxSupply({ supply: 1000 });

    amount = parseEther('1000');
    parameters = params();
    await mockERC20.mint(owner.address, amount);
    await mintAndApproveERC20(minter, theGenerates.address, amount);
    await mintAndApproveERC20(payer, theGenerates.address, amount);
  });

  context('allow list mint', async function () {
    it('should mint to a minter on the allow list', async () => {
      const { root, proof } = await createAllowListAndGetProof(
        [minter],
        parameters
      );

      // update allow list
      await updateAllowList({ root });

      // Mint the allow list stage to the minter and verify
      // the expected event was emitted.
      const { data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        proof,
      });

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, parameters.dropStageIndex);
    });

    it('should mint a free mint allow list stage', async () => {
      // Create a mintParams with price of 0.
      const mintParamsFreeMint = { ...parameters, startPrice: 0, endPrice: 0 };

      const { root, proof } = await createAllowListAndGetProof(
        [minter],
        mintParamsFreeMint
      );

      // update allow list
      await updateAllowList({ root });

      expect(await getAllowListMerkleRoot()).to.eq(root);

      const { data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        mintParams: mintParamsFreeMint,
        proof,
      });

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, parameters.dropStageIndex);
    });

    it('should mint an allow list stage with a different payer than minter', async () => {
      const { root, proof } = await createAllowListAndGetProof(
        [minter],
        parameters
      );

      // update allow list
      await updateAllowList({ root });

      const { data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        proof,
      });

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, parameters.dropStageIndex);
    });

    it('should revert if the minter is not on the allow list', async () => {
      const { root, proof } = await createAllowListAndGetProof(
        [minter],
        parameters
      );

      // update allow list
      await updateAllowList({ root });

      let { data } = await createMintOrder({
        minter: alice.address,
        mintType: MintType.ALLOW_LIST,
        proof,
      });

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidProof');

      ({ data } = await createMintOrder({
        minter: ZERO_ADDRESS,
        mintType: MintType.ALLOW_LIST,
        proof,
      }));

      await expect(
        alice.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidProof');
    });

    it('should not mint an allow list stage with different mint params', async () => {
      const { root, proof } = await createAllowListAndGetProof(
        [minter],
        parameters
      );

      // update allow list
      await updateAllowList({ root });

      // Create different mint params to include in the mint.
      const differentMintParams = {
        ...parameters,
        dropStageIndex: (parameters.dropStageIndex as number) + 5,
      };

      const { data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        mintParams: differentMintParams,
        proof,
      });

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidProof');
    });

    it('should not mint an allow list stage after exceeding max token supply for stage', async () => {
      const { root, proof } = await createAllowListAndGetProof(
        [minter, alice],
        parameters,
        0
      );
      const { proof: proofSecondMinter } = await createAllowListAndGetProof(
        [minter, alice],
        parameters,
        1
      );

      // update allow list
      await updateAllowList({ root });

      let { data } = await createMintOrder({
        quantity: parameters.maxTokenSupplyForStage,
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        proof,
      });

      // Mint the maxTokenSupplyForStage to the minter and verify
      // the expected event was emitted.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 340_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, parameters.dropStageIndex);

      ({ data } = await createMintOrder({
        quantity: parameters.maxTokenSupplyForStage,
        minter: alice.address,
        mintType: MintType.ALLOW_LIST,
        proof: proofSecondMinter,
      }));

      // Attempt to mint tokens to alice, exceeding
      // the drop stage supply.
      await expect(
        alice.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      )
        .to.be.revertedWithCustomError(
          configurer,
          'MintQuantityExceedsMaxTokenSupplyForStage'
        )
        .withArgs(
          2 * Number(parameters.maxTokenSupplyForStage),
          parameters.maxTokenSupplyForStage
        );
    });

    it('should not mint an allow list stage after exceeding max token supply', async () => {
      await setMaxSupply({ supply: 10 });
      const { root, proof } = await createAllowListAndGetProof(
        [minter, alice],
        parameters,
        0
      );
      const { proof: proofSecondMinter } = await createAllowListAndGetProof(
        [minter, alice],
        parameters,
        1
      );

      // update allow list
      await updateAllowList({ root });

      let { data } = await createMintOrder({
        quantity: 10,
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        proof,
      });

      // Mint the maxSupply to the minter and verify
      // the expected event was emitted.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, parameters.dropStageIndex);

      ({ data } = await createMintOrder({
        minter: alice.address,
        mintType: MintType.ALLOW_LIST,
        proof: proofSecondMinter,
      }));

      // Attempt to mint the more tokens to the second minter, exceeding
      // the token max supply.
      await expect(
        alice.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      )
        .to.be.revertedWithCustomError(
          configurer,
          'MintQuantityExceedsMaxSupply'
        )
        .withArgs(11, 10);
    });

    it('should not mint with an uninitialized AllowList', async () => {
      const { proof } = await createAllowListAndGetProof([minter], parameters);

      // We are skipping updating the allow list, the root should be zero.
      expect(await getAllowListMerkleRoot()).to.eq(ZERO_BYTES32);

      let { data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        proof,
      });

      // Mint the allow list stage.
      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidProof');

      // Try with proof of zero.
      ({ data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.ALLOW_LIST,
        proof: [ZERO_BYTES32],
      }));

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidProof');
    });
  });
});
