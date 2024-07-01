import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, type Wallet } from 'ethers';
import hre, { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  ITheGenerates,
  MockERC20,
  TheGenerates,
  TheGeneratesConfigurer,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';

import { ZERO_ADDRESS } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract, getCustomRevertSelector } from '@utils/helpers';
import { clock, duration, increaseBy } from '@utils/time';
import { MintType } from '@utils/types';

const { parseEther } = ethers.utils;

describe(`The Generates Signed Mint - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let theGenerates: TheGenerates;
  let theGeneratesInterface: ITheGenerates;
  let configurer: TheGeneratesConfigurer;
  let feeCollector: FeeCollector;
  let mockERC20: MockERC20;

  let mintSignedTokens: UnseenFixtures['mintSignedTokens'];
  let signMint: UnseenFixtures['signMint'];
  let createMintOrder: UnseenFixtures['createMintOrder'];
  let updateSigner: UnseenFixtures['updateSigner'];
  let updateUnseenPayout: UnseenFixtures['updateUnseenPayout'];
  let updatePaymentToken: UnseenFixtures['updatePaymentToken'];
  let getDigestIsUsed: UnseenFixtures['getDigestIsUsed'];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];
  let setMaxSupply: UnseenFixtures['setMaxSupply'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let signer: Wallet;
  let minter: Wallet;
  let malicious: Wallet;
  let payer: Wallet;
  let rentee: Wallet;

  let amount: BigNumber;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    minter = new ethers.Wallet(randomHex(32), provider);
    payer = new ethers.Wallet(randomHex(32), provider);
    rentee = new ethers.Wallet(randomHex(32), provider);
    malicious = new ethers.Wallet(randomHex(32), provider);
    signer = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, minter, payer, rentee, malicious]) {
      await faucet(wallet.address, provider);
    }

    return { owner, minter, signer, rentee, malicious, payer };
  }

  before(async () => {
    ({ owner, minter, signer, rentee, malicious, payer } = await loadFixture(
      setupFixture
    ));

    ({ feeCollector } = await unseenFixture(owner));
  });

  beforeEach(async function () {
    ({
      configurer,
      theGenerates,
      theGeneratesInterface,
      mockERC20,
      setMaxSupply,
      mintAndApproveERC20,
      mintSignedTokens,
      updateSigner,
      updateUnseenPayout,
      signMint,
      getDigestIsUsed,
      createMintOrder,
      updatePaymentToken,
    } = await unseenFixture(owner));

    await updateSigner({ signer });
    await updateUnseenPayout({ payoutAddress: feeCollector.address });
    await updatePaymentToken({ token: mockERC20.address });
    await setMaxSupply({ supply: 1000 });

    amount = parseEther('1000');
    await mockERC20.mint(owner.address, amount);
    await mintAndApproveERC20(minter, theGenerates.address, amount);
    await mintAndApproveERC20(payer, theGenerates.address, amount);
    await mintAndApproveERC20(rentee, theGenerates.address, amount);
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('TheGenerates', ...args);
      if (expectedError)
        await expect(deployment).to.be.revertedWithCustomError(
          theGenerates,
          expectedError
        );
      else {
        const collector = await deployment;
        expect(await collector.owner()).to.eq(owner.address);
      }
    };

    it('reverts if owner or configurer is set to address 0', async function () {
      const t = async (
        configurerToSet: string,
        ownerToSet: string,
        expectedError: string
      ) => {
        await testConstructor(expectedError, configurerToSet, ownerToSet);
      };
      await t(configurer.address, ZERO_ADDRESS, 'NewOwnerIsZeroAddress');
      await t(ZERO_ADDRESS, owner.address, 'ConfigurerCannotBeZeroAddress');
      await t(configurer.address, owner.address, '');
    });
  });

  context('server side signed mint', async function () {
    it('should mint with valid signature and params', async () => {
      // Mint signed with payer for minter.
      let { signature, salt, digest, mintParams } = await signMint({
        minter,
        signer,
      });

      let { data } = await createMintOrder({
        minter: minter.address,
        mintParams,
        salt,
        signature,
        mintType: MintType.SIGNED,
      });

      expect(await getDigestIsUsed(digest)).to.eq(false);

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, mintParams.dropStageIndex);

      expect(await getDigestIsUsed(digest)).to.eq(true);

      expect(await theGenerates.balanceOf(minter.address)).to.eq(1);
      expect(await theGenerates.totalSupply()).to.eq(1);

      expect(await mockERC20.balanceOf(feeCollector.address)).to.eq(
        mintParams.startPrice
      );

      // Ensure a signature can only be used once.
      // Mint again with the same params.
      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'SignatureAlreadyUsed');

      // Mint signed with minter being payer.
      // Change the salt to use a new digest.
      const newSalt = randomHex();

      ({ signature, salt, digest, mintParams } = await signMint({
        minter,
        salt: newSalt,
        signer,
      }));

      ({ data } = await createMintOrder({
        minter: minter.address,
        mintParams,
        salt: newSalt,
        signature,
        mintType: MintType.SIGNED,
      }));

      expect(await getDigestIsUsed(digest)).to.eq(false);

      await mockERC20.connect(minter).approve(theGenerates.address, 0);

      const expectedRevertReason = getCustomRevertSelector(
        'TransferFromFailed()'
      );

      const tx = await minter.populateTransaction({
        to: theGenerates.address,
        data,
        gasLimit: 150_000,
      });
      const returnData = await provider.call(tx);

      expect(returnData).to.equal(expectedRevertReason);

      await mockERC20.connect(minter).approve(theGenerates.address, amount);

      await expect(
        minter.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(minter.address, mintParams.dropStageIndex);

      expect(await theGenerates.balanceOf(minter.address)).to.eq(2);
      expect(await theGenerates.totalSupply()).to.eq(2);
      expect(await getDigestIsUsed(digest)).to.eq(true);
      expect(await mockERC20.balanceOf(feeCollector.address)).to.eq(
        BigNumber.from(mintParams.startPrice).mul(2)
      );
    });

    it('should not mint with different params', async () => {
      // Mint signed with payer for minter.
      let { signature, salt, mintParams } = await signMint({
        minter,
        signer,
      });

      let { data } = await createMintOrder({
        minter: malicious.address, //Test with different minter address
        mintParams,
        salt,
        signature,
        mintType: MintType.SIGNED,
      });

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidSignature');

      // Test with different price
      ({ data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.SIGNED,
        mintParams: {
          ...mintParams,
          startPrice: parseEther('0.001'),
          endPrice: parseEther('0.001'),
        },
        salt,
        signature,
      }));

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidSignature');

      // Test with signer that is not allowed
      ({ signature, salt, mintParams } = await signMint({
        minter,
        signer: malicious,
      }));

      ({ data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.SIGNED,
        mintParams,
        salt,
        signature,
      }));

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidSignature');

      // Test with different salt
      const newSalt = randomHex();
      ({ signature, salt, mintParams } = await signMint({
        minter,
        signer: malicious,
      }));

      ({ data } = await createMintOrder({
        minter: minter.address,
        mintType: MintType.SIGNED,
        mintParams,
        salt: newSalt,
        signature,
      }));

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 150_000,
        })
      ).to.be.revertedWithCustomError(configurer, 'InvalidSignature');

      //Ensure that the zero address cannot be added as a signer.
      // @note can't use fixture fn because it expects wallet
      await expect(
        theGeneratesInterface.updateSigner(ZERO_ADDRESS, {
          gasLimit: 100_000,
        })
      ).to.be.revertedWithCustomError(
        theGenerates,
        'SignerCannotBeZeroAddress'
      );

      await expect(
        updateSigner({
          signer,
          options: {
            gasLimit: 100_000,
          },
        })
      ).to.be.revertedWithCustomError(theGenerates, 'DuplicateSigner');

      await expect(
        updateSigner({
          caller: malicious,
          signer,
          options: {
            gasLimit: 100_000,
          },
        })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');
    });

    it('should mint to caller if minter is address 0', async () => {
      const { signature, salt, mintParams } = await signMint({
        minter: payer,
        signer,
      });

      const { data } = await createMintOrder({
        minter: ZERO_ADDRESS,
        mintType: MintType.SIGNED,
        mintParams,
        salt,
        signature,
      });

      await expect(
        payer.sendTransaction({
          to: theGenerates.address,
          data,
          gasLimit: 180_000,
        })
      )
        .to.emit(theGenerates, 'TheGeneratesMint')
        .withArgs(payer.address, mintParams.dropStageIndex);

      expect(await theGenerates.balanceOf(payer.address)).to.eq(1);
    });
  });

  context('rentable tokens', async function () {
    it('user should be able to rent out his tokens', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await theGenerates
        .connect(minter)
        .setRentablesInfo(1, true, amount.div(100));
      const [ratePerMinute, rentable] = await theGenerates.getTokenRentInfo(1);
      const mintPrice = parseEther('0.1');
      expect(rentable).to.be.true;
      expect(ratePerMinute).to.eq(amount.div(100));
      const rentAmount = ratePerMinute.mul(60);
      const minterBalance = await mockERC20.balanceOf(minter.address);
      await expect(theGenerates.connect(rentee).rent(1, 60)).to.emit(
        theGenerates,
        'UpdateUser'
      );
      expect(await theGenerates.userOf(1)).to.equal(rentee.address);
      expect(await mockERC20.balanceOf(minter.address)).to.eq(
        rentAmount.mul(9000).div(10000).add(minterBalance)
      );
      expect(await mockERC20.balanceOf(feeCollector.address)).to.eq(
        rentAmount.mul(1000).div(10000).add(mintPrice)
      );
    });
    it('user should not be able to rent out a rented token', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await theGenerates
        .connect(minter)
        .setRentablesInfo(1, true, amount.div(100));
      await expect(theGenerates.connect(rentee).rent(1, 60)).to.emit(
        theGenerates,
        'UpdateUser'
      );
      expect(await theGenerates.userOf(1)).to.equal(rentee.address);
      await expect(
        theGenerates.connect(rentee).rent(1, 60)
      ).to.be.revertedWithCustomError(theGenerates, 'Rented');
    });
    it('user should be able to rent out a token again once expiry time is reached', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await theGenerates
        .connect(minter)
        .setRentablesInfo(1, true, amount.div(200));
      await expect(theGenerates.connect(rentee).rent(1, 60)).to.emit(
        theGenerates,
        'UpdateUser'
      );
      expect(await theGenerates.userOf(1)).to.equal(rentee.address);
      const oneHour = duration.minutes(60);
      await increaseBy.timestamp(oneHour);
      await expect(theGenerates.connect(rentee).rent(1, 60)).to.emit(
        theGenerates,
        'UpdateUser'
      );
      expect(await theGenerates.userOf(1)).to.equal(rentee.address);
    });
    it('user should not be able to rent a token if not enough tokens to cover rent amount', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await theGenerates.connect(minter).setRentablesInfo(1, true, amount);
      const expectedRevertReason = getCustomRevertSelector(
        'TransferFromFailed()'
      );
      const tx = await theGenerates
        .connect(rentee)
        .populateTransaction.rent(1, 60);
      const returnData = await provider.call(tx);
      expect(returnData).to.equal(expectedRevertReason);
    });
    it('user should not be able to rent a non rentable token', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      expect((await theGenerates.getTokenRentInfo(1))[1]).to.be.false;
      await expect(
        theGenerates.connect(rentee).rent(1, 60)
      ).to.be.revertedWithCustomError(theGenerates, 'RentingDisabled');
    });
    it('user should not be able to set rentable info if not owner', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await expect(
        theGenerates.connect(rentee).setRentablesInfo(1, true, amount)
      ).to.be.revertedWithCustomError(
        theGenerates,
        'SetUserCallerNotOwnerNorApproved'
      );
    });
    it('owner should be able to set rentable info', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await theGenerates.connect(minter).setRentablesInfo(1, true, amount);
      await expect(
        theGenerates.connect(minter).setRentablesInfo(1, true, amount)
      ).to.be.revertedWithCustomError(theGenerates, 'NoChange');

      expect(await theGenerates.getTokenRentInfo(1)).to.deep.eq([amount, true]);
    });
    it('owner of token should be able to set user as rentee (without payment)', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      const timestamp = await clock.timestamp();
      await theGenerates
        .connect(minter)
        .setUser(1, rentee.address, timestamp.add(duration.hours(1)));
      expect(await theGenerates.userOf(1)).to.equal(rentee.address);
    });
    it('user should not be able to setUser of token (without payment) if not owner or approved', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      await theGenerates.connect(minter).setRentablesInfo(1, true, amount);
      const timestamp = await clock.timestamp();
      await expect(
        theGenerates
          .connect(rentee)
          .setUser(1, rentee.address, timestamp.add(duration.hours(1)))
      ).to.be.revertedWithCustomError(
        theGenerates,
        'SetUserCallerNotOwnerNorApproved'
      );
    });
    it('owner of token should not be able to setUser of his token twice same time', async function () {
      await mintSignedTokens({
        minter,
        signer,
      });
      const timestamp = await clock.timestamp();
      await theGenerates
        .connect(minter)
        .setUser(1, rentee.address, timestamp.add(duration.hours(1)));
      await expect(
        theGenerates
          .connect(minter)
          .setUser(1, rentee.address, timestamp.add(duration.hours(1)))
      ).to.be.revertedWithCustomError(theGenerates, 'Rented');
    });
  });

  context.skip('domain test on chain id change', async function () {
    // NOTE: Run this test last in this file as it hacks changing the hre
    it('Reverts on changed chainId', async () => {
      const { signature, salt, mintParams } = await signMint({
        minter,
        signer,
      });

      const { data } = await createMintOrder({
        mintType: MintType.SIGNED,
        minter: minter.address,
        mintParams,
        salt,
        signature,
      });

      // Change chainId in-flight to test branch coverage for _deriveDomainSeparator()
      // (hacky way, until https://github.com/NomicFoundation/hardhat/issues/3074 is added)
      const changeChainId = () => {
        const recurse = (obj: any) => {
          for (const [key, value] of Object.entries(obj ?? {})) {
            if (key === 'transactions') continue;
            if (key === 'chainId') {
              obj[key] = typeof value === 'bigint' ? BigInt(1) : 1;
            } else if (typeof value === 'object') {
              recurse(obj[key]);
            }
          }
        };
        const hreProvider = hre.network.provider as any;
        recurse(
          hreProvider._wrapped._wrapped._wrapped?._node?._vm ??
            // When running coverage, there was an additional layer of wrapping
            hreProvider._wrapped._wrapped._wrapped._wrapped._node._vm
        );
      };
      changeChainId();

      const tx = await payer.populateTransaction({
        to: theGenerates.address,
        data,
        gasLimit: 150_000,
        chainId: 1,
      });

      const expectedRevertReason =
        getCustomRevertSelector('InvalidSignature()');

      const returnData = await provider.call(tx);
      expect(returnData.slice(0, 10)).to.equal(expectedRevertReason);
    });
  });
});
