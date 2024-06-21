import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, type Wallet } from 'ethers';
import { defaultAbiCoder, id, parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type { UnseenFixtures } from '@utils/fixtures';
import type { ConfigStructs } from 'typechained/contracts/shim/Shim';

import { ZERO_ADDRESS, ZERO_BYTES32 } from '@constants';
import {
  ERC2981__factory,
  type FeeCollector,
  IContractMetadata__factory,
  ICreatorToken__factory,
  IERC165__factory,
  type ITheGenerates,
  ITheGeneratesConfigurer__factory,
  ITheGenerates__factory,
  type MockERC20,
  type TheGenerates,
  type TheGeneratesConfigurer,
} from '@typechained';
import { deployContract } from '@utils/contracts';
import { getInterfaceID, randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { type AwaitedObject, expectedPrice } from '@utils/helpers';
import { clock, increaseTo } from '@utils/time';
import { MintType } from '@utils/types';

describe(`The Generates Configurer - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let theGenerates: TheGenerates;
  let theGeneratesInterface: ITheGenerates;
  let configurer: TheGeneratesConfigurer;
  let feeCollector: FeeCollector;
  let mockERC20: MockERC20;

  let mintTokens: UnseenFixtures['mintSignedTokens'];
  let createMintOrder: UnseenFixtures['createMintOrder'];
  let updateUnseenPayout: UnseenFixtures['updateUnseenPayout'];
  let updatePaymentToken: UnseenFixtures['updatePaymentToken'];
  let updateSigner: UnseenFixtures['updateSigner'];
  let getUnseenPayout: UnseenFixtures['getUnseenPayout'];
  let getPaymentToken: UnseenFixtures['getPaymentToken'];
  let getRoyaltyInfo: UnseenFixtures['getRoyaltyInfo'];
  let getBaseUri: UnseenFixtures['getBaseUri'];
  let getContractUri: UnseenFixtures['getContractUri'];
  let getUnseenSigner: UnseenFixtures['getUnseenSigner'];
  let setMaxSupply: UnseenFixtures['setMaxSupply'];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  let publicDrop: AwaitedObject<ConfigStructs.PublicDropStruct>;

  // Wallets
  let owner: Wallet;
  let minter: Wallet;
  let signer: Wallet;
  let malicious: Wallet;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    minter = new ethers.Wallet(randomHex(32), provider);
    signer = new ethers.Wallet(randomHex(32), provider);
    malicious = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, minter, malicious]) {
      await faucet(wallet.address, provider);
    }

    return { owner, minter, signer, malicious };
  }

  before(async () => {
    ({ owner, minter, signer, malicious } = await loadFixture(setupFixture));

    ({ feeCollector } = await unseenFixture(owner));

    publicDrop = {
      startPrice: parseEther('0.1'),
      endPrice: parseEther('0.1'),
      startTime: Math.round(Date.now() / 1000) - 1000,
      endTime: Math.round(Date.now() / 1000) + 1000,
    };
  });

  beforeEach(async function () {
    ({
      mockERC20,
      mintAndApproveERC20,
      configurer,
      theGenerates,
      createMintOrder,
      theGeneratesInterface,
      updateUnseenPayout,
      updatePaymentToken,
      updateSigner,
      getPaymentToken,
      getRoyaltyInfo,
      getBaseUri,
      getContractUri,
      getUnseenSigner,
      setMaxSupply,
      getUnseenPayout,
    } = await unseenFixture(owner));

    await updateSigner({ signer });
    await setMaxSupply({ supply: 100 });
    await updateUnseenPayout({ payoutAddress: feeCollector.address });
  });

  context('contract deployment', async function () {
    it('should emit an event when the contract is deployed', async () => {
      const tx = await deployContract(
        'TheGenerates',
        owner,
        configurer.address,
        owner.address
      );
      const receipt = await tx.deployTransaction.wait();
      const event = (receipt as any).events.filter(
        ({ event }: any) => event === 'TheGeneratesDeployed'
      );

      expect(event).to.not.be.empty;
    });

    it('should return the correct configurer address', async () => {
      expect(await theGeneratesInterface.configurer()).to.eq(
        configurer.address
      );
    });
  });

  context('implementation Contract Access Control', async function () {
    it('should not be able to call TheGeneratesImplementation without delegatecall', async () => {
      // Fallback
      await expect(
        owner.sendTransaction({
          to: configurer.address,
          data: '0x123456',
          gasLimit: 50_000,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');

      // mint
      await expect(
        configurer.mint(ethers.constants.HashZero, { gasLimit: 50_000 })
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');

      // updateUnseenPayout
      await expect(
        configurer.updateUnseenPayout(
          { payoutAddress: feeCollector.address, basisPoints: 1_000 },
          {
            gasLimit: 50_000,
          }
        )
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');

      // updateAllowedSigner
      await expect(
        configurer.updateSigner(ZERO_ADDRESS, {
          gasLimit: 50_000,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');

      // updatePaymentToken
      await expect(
        configurer.updatePaymentToken(ZERO_ADDRESS, {
          gasLimit: 50_000,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');

      // updateAllowList
      await expect(
        configurer.updateAllowList(`0x${'1'.repeat(64)}`, { gasLimit: 50_000 })
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');

      // updatePublicDrop
      await expect(
        configurer.updatePublicDrop(publicDrop, { gasLimit: 50_000 })
      ).to.be.revertedWithCustomError(theGenerates, 'OnlyDelegateCalled');
    });

    it('only owner can update the paymentToken address', async () => {
      expect(await getPaymentToken()).to.eq(ZERO_ADDRESS);
      await expect(
        updatePaymentToken({
          token: ZERO_ADDRESS,
          options: {
            gasLimit: 100_000,
          },
        })
      ).to.be.revertedWithCustomError(
        theGenerates,
        'PaymentTokenCannotBeZeroAddress'
      );
      await expect(updatePaymentToken({ token: mockERC20.address }))
        .to.emit(theGenerates, 'PaymentTokenUpdated')
        .withArgs(mockERC20.address);
      expect(await getPaymentToken()).to.eq(mockERC20.address);
      await expect(
        updatePaymentToken({
          token: mockERC20.address,
          options: { gasLimit: 100_000 },
        })
      ).to.be.revertedWithCustomError(theGenerates, 'DuplicatePaymentToken');
    });

    it('should not be able to mint until unseen payout and payment token is set', async () => {
      ({
        configurer,
        theGenerates,
        theGeneratesInterface,
        mintSignedTokens: mintTokens,
        updateSigner,
        updateUnseenPayout,
        getUnseenPayout,
        updatePaymentToken,
        getPaymentToken,
        setMaxSupply,
      } = await unseenFixture(owner));

      await setMaxSupply({ supply: 100 });
      await updateSigner({ signer });

      expect(await getUnseenPayout()).to.deep.equal([ZERO_ADDRESS, 0]);

      await expect(
        mintTokens({
          minter,
          signer,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'UnseenPayoutNotSet');

      await updateUnseenPayout({ payoutAddress: feeCollector.address });

      await expect(
        mintTokens({
          minter,
          signer,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'PaymentTokenNotSet');

      await updatePaymentToken({ token: mockERC20.address });

      expect(await getPaymentToken()).to.eq(mockERC20.address);

      await mintAndApproveERC20(minter, theGenerates.address, parseEther('1'));

      await expect(
        mintTokens({
          minter,
          signer,
        })
      ).to.emit(theGenerates, 'TheGeneratesMint');
    });

    it('Should handle desc and asc mint prices', async () => {
      const amount = parseEther('10');
      await mintAndApproveERC20(minter, theGenerates.address, amount);
      await updatePaymentToken({ token: mockERC20.address });
      const publicDropDescMintPrice = {
        ...publicDrop,
        startPrice: parseEther('1'),
        endPrice: parseEther('.1'),
      };
      await theGeneratesInterface.updatePublicDrop(publicDropDescMintPrice);

      let { data } = await createMintOrder({
        minter: ZERO_ADDRESS,
        mintType: MintType.PUBLIC,
      });

      // Fix the next block timestamp so we can calculate the expected price.
      let nextTimestamp = (await clock.timestamp()).add(20);
      await increaseTo.timestamp(nextTimestamp, false);
      let expected = expectedPrice({
        startPrice: publicDropDescMintPrice.startPrice,
        endPrice: publicDropDescMintPrice.endPrice,
        startTime: publicDrop.startTime,
        endTime: publicDrop.endTime,
        blockTimestamp: nextTimestamp,
      });

      let balanceBefore = amount;

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, 0);

      let balanceAfter = await mockERC20.balanceOf(minter.address);
      expect(balanceAfter).to.eq(balanceBefore.sub(expected));

      // Test asc mint price
      const publicDropAscMintPrice = {
        ...publicDrop,
        startPrice: parseEther('.1'),
        endPrice: parseEther('1'),
      };
      await theGeneratesInterface.updatePublicDrop(publicDropAscMintPrice);
      ({ data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.PUBLIC,
      }));

      balanceBefore = await mockERC20.balanceOf(minter.address);
      nextTimestamp = nextTimestamp.add(250);
      await increaseTo.timestamp(nextTimestamp, false);
      expected = expectedPrice({
        startPrice: publicDropAscMintPrice.startPrice,
        endPrice: publicDropAscMintPrice.endPrice,
        startTime: publicDrop.startTime,
        endTime: publicDrop.endTime,
        blockTimestamp: nextTimestamp,
      });

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, 0);

      balanceAfter = await mockERC20.balanceOf(minter.address);
      expect(balanceAfter).to.eq(balanceBefore.sub(expected));

      expect(await theGenerates.ownerOf(1)).to.eq(minter.address);
      expect(await theGenerates.ownerOf(2)).to.eq(minter.address);

      await theGenerates
        .connect(minter)
        .transferFrom(minter.address, owner.address, 1);
      await theGenerates
        .connect(minter)
        .transferFrom(minter.address, owner.address, 2);

      expect(await theGenerates.ownerOf(1)).to.eq(owner.address);
      expect(await theGenerates.ownerOf(2)).to.eq(owner.address);
    });

    it('only owner can use the multiConfigure method', async () => {
      const config = {
        maxSupply: 6000,
        baseURI: 'https://example1.com',
        contractURI: 'https://example2.com',
        publicDrop: {
          startPrice: parseEther('0.1'),
          endPrice: parseEther('0.1'),
          startTime: Math.round(Date.now() / 1000) - 1000,
          endTime: Math.round(Date.now() / 1000) + 1000,
        },
        merkleRoot: `0x${'3'.repeat(64)}`,
        TGenImpl: theGenerates.address,
        unseenPayout: {
          payoutAddress: feeCollector.address,
          basisPoints: 1_000,
        },
        provenanceHash: `0x${'3'.repeat(64)}`,
        allowedSigner: `0x${'8'.repeat(40)}`,
        royaltyReceiver: `0x${'12'.repeat(20)}`,
        royaltyBps: 1_000,
        paymentToken: mockERC20.address,
        mintRecipient: minter.address,
        mintQuantity: 0,
      };

      await expect(
        configurer
          .connect(malicious)
          .multiConfigure(theGenerates.address, config)
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      await expect(configurer.multiConfigure(theGenerates.address, config))
        .to.emit(theGenerates, 'SignerUpdated')
        .withArgs(config.allowedSigner);

      const checkResults = async () => {
        expect(await theGenerates.maxSupply()).to.eq(6000);
        expect(await theGenerates.provenanceHash()).to.eq(
          `0x${'3'.repeat(64)}`
        );
        expect(await getBaseUri()).to.eq('https://example1.com');
        expect(await getContractUri()).to.eq('https://example2.com');

        const publicDrop = await theGeneratesInterface.getPublicDrop();
        const merkleRoot = await theGeneratesInterface.getAllowListMerkleRoot();

        expect(publicDrop).to.deep.eq([
          publicDrop.startPrice,
          publicDrop.endPrice,
          publicDrop.startTime,
          publicDrop.endTime,
        ]);

        expect(await getUnseenPayout()).to.deep.eq([
          feeCollector.address,
          1_000,
        ]);
        expect(await getUnseenSigner()).to.deep.eq(config.allowedSigner);
        expect(merkleRoot).to.eq(config.merkleRoot);
        expect(await getRoyaltyInfo(0, 100)).to.deep.eq([
          config.royaltyReceiver,
          BigNumber.from(config.royaltyBps).mul(100).div(10_000),
        ]);
      };

      await checkResults();

      // Should not do anything if all fields are zeroed out
      const zeroedConfig = {
        baseURI: '',
        contractURI: '',
        TGenImpl: theGenerates.address,
        unseenPayout: {
          payoutAddress: ZERO_ADDRESS,
          basisPoints: 0,
        },
        allowedSigner: ZERO_ADDRESS,
        royaltyReceiver: ZERO_ADDRESS,
        royaltyBps: 0,
        paymentToken: ZERO_ADDRESS,
        maxSupply: 0,
        provenanceHash: ZERO_BYTES32,
        publicDrop: {
          startPrice: parseEther('0.1'),
          endPrice: parseEther('0.1'),
          startTime: 0,
          endTime: 0,
        },
        merkleRoot: ZERO_BYTES32,
        mintRecipient: ZERO_ADDRESS,
        mintQuantity: 0,
      };
      await expect(
        configurer.multiConfigure(theGenerates.address, zeroedConfig)
      ).to.not.emit(theGenerates, 'SignerUpdated');
      await checkResults();

      expect(await getPaymentToken()).to.eq(config.paymentToken);
      expect(await getUnseenSigner()).to.deep.eq(config.allowedSigner);

      // Should be able to use the multiConfigure method to mint
      const configWithMint = {
        ...zeroedConfig,
        mintRecipient: minter.address,
        mintQuantity: 1,
      };
      await expect(
        configurer.multiConfigure(theGenerates.address, configWithMint)
      )
        .to.emit(theGenerates, 'Transfer')
        .withArgs(ZERO_ADDRESS, minter.address, 1);

      // Ensure multiConfigureMint can only be used by the owner.
      await expect(
        theGeneratesInterface
          .connect(minter)
          .multiConfigureMint(minter.address, 1, {
            gasLimit: 100_000,
          })
      ).to.revertedWithCustomError(theGenerates, 'Unauthorized');
    });

    it('only the owner can use admin methods', async () => {
      // Test `updateAllowList` for coverage.
      await theGeneratesInterface.updateAllowList(`0x${'3'.repeat(64)}`);

      await expect(
        theGeneratesInterface
          .connect(malicious)
          .updateAllowList(`0x${'3'.repeat(64)}`, { gasLimit: 100_000 })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      // Test `updateSigner` for coverage.
      await updateSigner({
        signer: owner,
        options: { gasLimit: 100_000 },
      });

      await expect(
        updateSigner({
          caller: malicious,
          signer: owner,
          options: { gasLimit: 100_000 },
        })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      // Test `updatePaymentToken` for coverage.
      await updatePaymentToken({
        token: `0x${'5'.repeat(40)}`,
        options: { gasLimit: 100_000 },
      });

      await expect(
        updatePaymentToken({
          caller: malicious,
          token: `0x${'5'.repeat(40)}`,
          options: { gasLimit: 100_000 },
        })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');
    });

    it('only the owner can call update functions', async () => {
      const UnauthorizedMethods = [
        'updatePublicDrop',
        'updateAllowList',
        'updateUnseenPayout',
        'updateSigner',
        'updatePaymentToken',
      ];

      const methodParams: any = {
        updateUnseenPayout: [
          { payoutAddress: `0x${'4'.repeat(40)}`, basisPoints: 500 },
        ],
        updatePublicDrop: [publicDrop],
        updateAllowList: [`0x${'3'.repeat(64)}`],
        updateSigner: [`0x${'4'.repeat(40)}`],
        updatePaymentToken: [`0x${'4'.repeat(40)}`],
      };

      for (const method of UnauthorizedMethods) {
        await (theGeneratesInterface as any)
          .connect(owner)
          [method](...methodParams[method]);

        await expect(
          (theGeneratesInterface as any)
            .connect(malicious)
            [method](...methodParams[method], {
              gasLimit: 100_000,
            })
        ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');
      }
    });

    it('Should return supportsInterface true for supported interfaces', async () => {
      const supportedInterfacesTheGenerates = [[ITheGenerates__factory]];
      const supportedInterfacesContractMetadata = [
        [IContractMetadata__factory],
        [ERC2981__factory, IERC165__factory],
        [ICreatorToken__factory],
      ];
      const supportedInterfacesContractConfigurer = [
        [ITheGeneratesConfigurer__factory],
      ];

      for (const factories of [
        ...supportedInterfacesTheGenerates,
        ...supportedInterfacesContractMetadata,
        ...supportedInterfacesContractConfigurer,
      ]) {
        const interfaceId = factories
          .map((factory) => getInterfaceID(factory.createInterface()))
          .reduce((prev, curr) => prev.xor(curr))
          .toHexString();
        expect(await theGenerates.supportsInterface(interfaceId)).to.be.true;
      }

      // Ensure the supported interfaces from ERC721A return true.
      // 0x80ac58cd: ERC721
      expect(await theGenerates.supportsInterface('0x80ac58cd')).to.be.true;
      // 0x5b5e139f: ERC721Metadata
      expect(await theGenerates.supportsInterface('0x5b5e139f')).to.be.true;
      // 0x01ffc9a7: ERC165
      expect(await theGenerates.supportsInterface('0x01ffc9a7')).to.be.true;

      // Ensure the interface for ERC-4906 returns true.
      expect(await theGenerates.supportsInterface('0x49064906')).to.be.true;

      // Ensure invalid interfaces return false.
      const invalidInterfaceIds = ['0x00000000', '0x10000000', '0x00000001'];
      for (const interfaceId of invalidInterfaceIds) {
        expect(await theGenerates.supportsInterface(interfaceId)).to.be.false;
      }
    });

    it('Should return errors for invalid encodings', async () => {
      const { context } = await createMintOrder({
        quantity: 1,
        minter: minter.address,
        mintType: MintType.PUBLIC,
      });

      const mintSelector = id('mint(bytes)').substring(0, 10);

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data:
            mintSelector +
            defaultAbiCoder
              .encode(['bytes'], ['0x04' + context.slice(4)])
              .slice(2),
          gasLimit: 180_000,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'InvalidSubstandard');

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data:
            mintSelector +
            defaultAbiCoder
              .encode(['bytes'], ['0x' + context.slice(20)])
              .slice(2),
          gasLimit: 180_000,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'InvalidExtraDataEncoding');
    });
  });
});
