import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, type Wallet } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  MockTransferValidator,
  TheGenerates,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';

import { ZERO_ADDRESS, ZERO_BYTES32 } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/contracts';

describe(`The Generates Contract Metadata - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let theGenerates: TheGenerates;
  let feeCollector: FeeCollector;
  let mockTransferValidatorAlwaysReverts: MockTransferValidator;
  let mockTransferValidatorAlwaysSucceeds: MockTransferValidator;

  let mintPublicTokens: UnseenFixtures['mintPublicTokens'];
  let getRoyaltyInfo: UnseenFixtures['getRoyaltyInfo'];
  let getBaseUri: UnseenFixtures['getBaseUri'];
  let getTokenUri: UnseenFixtures['getTokenUri'];
  let setBaseUri: UnseenFixtures['setBaseUri'];
  let getContractUri: UnseenFixtures['getContractUri'];
  let setContractUri: UnseenFixtures['setContractUri'];
  let updateRoyalties: UnseenFixtures['updateRoyalties'];
  let setMaxSupply: UnseenFixtures['setMaxSupply'];
  let getMaxSupply: UnseenFixtures['getMaxSupply'];
  let getProvenanceHash: UnseenFixtures['getProvenanceHash'];
  let setProvenanceHash: UnseenFixtures['setProvenanceHash'];
  let updateUnseenPayout: UnseenFixtures['updateUnseenPayout'];
  let mintAndApproveERC20: UnseenFixtures['mintAndApproveERC20'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let malicious: Wallet;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    malicious = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, malicious]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, malicious };
  }

  before(async () => {
    ({ owner, bob, malicious } = await loadFixture(setupFixture));

    ({ feeCollector } = await unseenFixture(owner));
  });

  beforeEach(async function () {
    ({
      mintAndApproveERC20,
      theGenerates,
      mintPublicTokens,
      updateRoyalties,
      setProvenanceHash,
      getProvenanceHash,
      getRoyaltyInfo,
      getBaseUri,
      getTokenUri,
      setBaseUri,
      setContractUri,
      getContractUri,
      setMaxSupply,
      getMaxSupply,
      updateUnseenPayout,
    } = await unseenFixture(owner));

    await mintAndApproveERC20(
      owner,
      theGenerates.address,
      parseEther('1000000')
    );

    await updateUnseenPayout({ payoutAddress: feeCollector.address });

    mockTransferValidatorAlwaysReverts = await deployContract(
      'MockTransferValidator',
      owner,
      true
    );

    mockTransferValidatorAlwaysSucceeds = await deployContract(
      'MockTransferValidator',
      owner,
      false
    );
  });

  context('contract access control', async function () {
    it('only owner can set base uri', async () => {
      expect(await getBaseUri()).to.equal('');

      await expect(
        setBaseUri({ caller: bob, uri: 'http://example.com' })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');
      expect(await getBaseUri()).to.equal('');

      // it should not emit BatchMetadataUpdate when totalSupply is 0
      await expect(setBaseUri({ uri: 'http://example.com' })).to.not.emit(
        theGenerates,
        'BatchMetadataUpdate'
      );

      // it should emit BatchMetadataUpdate when totalSupply is greater than 0
      await setMaxSupply({ supply: 1 });
      await mintPublicTokens({
        minter: owner,
      });
      await expect(setBaseUri({ uri: 'http://example.com' }))
        .to.emit(theGenerates, 'BatchMetadataUpdate')
        .withArgs(1, await theGenerates.totalSupply());
      expect(await getBaseUri()).to.equal('http://example.com');
    });

    it('only owner can set contract uri', async () => {
      expect(await getContractUri()).to.equal('');

      await expect(
        setContractUri({ caller: bob, uri: 'http://example.com' })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');
      expect(await getContractUri()).to.equal('');

      await expect(setContractUri({ uri: 'http://example.com' }))
        .to.emit(theGenerates, 'ContractURIUpdated')
        .withArgs('http://example.com');
      expect(await getContractUri()).to.equal('http://example.com');
    });

    it('only owner can set max supply', async () => {
      expect(await getMaxSupply()).to.equal(0);

      await expect(
        setMaxSupply({ caller: bob, supply: 10 })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');
      expect(await getMaxSupply()).to.equal(0);

      await expect(setMaxSupply({ supply: 25 }))
        .to.emit(theGenerates, 'MaxSupplyUpdated')
        .withArgs(25);
      expect(await getMaxSupply()).to.equal(25);
    });

    it('owner cannot set the max supply over 2**64', async () => {
      await expect(setMaxSupply({ supply: BigNumber.from(2).pow(70) }))
        .to.be.revertedWithCustomError(
          theGenerates,
          'CannotExceedMaxSupplyOfUint64'
        )
        .withArgs(BigNumber.from(2).pow(70));
    });

    it('owner cannot set the max supply less then the totalMinted', async () => {
      await setMaxSupply({ supply: 3 });
      await mintPublicTokens({
        minter: owner,
        quantity: 3,
      });
      expect(await theGenerates.totalSupply()).to.equal(3);

      await expect(setMaxSupply({ supply: 2 }))
        .to.be.revertedWithCustomError(
          theGenerates,
          'NewMaxSupplyCannotBeLessThenTotalMinted'
        )
        .withArgs(2, 3);
    });

    it('only owner can notify update of batch token URIs', async () => {
      await expect(
        theGenerates.connect(bob).emitBatchMetadataUpdate(5, 10)
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      await expect(theGenerates.emitBatchMetadataUpdate(5, 10))
        .to.emit(theGenerates, 'BatchMetadataUpdate')
        .withArgs(5, 10);
    });

    it('only owner can update the royalties address and basis points', async () => {
      expect(await getRoyaltyInfo(0, 100)).to.deep.equal([ZERO_ADDRESS, 0]);

      await expect(
        updateRoyalties({
          caller: bob,
          treasury: feeCollector.address,
          bps: 100,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      await expect(
        updateRoyalties({
          treasury: feeCollector.address,
          bps: 1_001,
        })
      ).to.be.revertedWithCustomError(theGenerates, 'InvalidBasisPoints');

      await expect(
        updateRoyalties({
          treasury: ZERO_ADDRESS,
          bps: 1_000,
        })
      ).to.be.revertedWithCustomError(
        theGenerates,
        'RoyaltyReceiverIsZeroAddress'
      );

      await expect(
        updateRoyalties({
          treasury: feeCollector.address,
          bps: 100,
        })
      )
        .to.emit(theGenerates, 'RoyaltyInfoUpdated')
        .withArgs(feeCollector.address, 100);

      await expect(
        updateRoyalties({
          treasury: feeCollector.address,
          bps: 500,
        })
      )
        .to.emit(theGenerates, 'RoyaltyInfoUpdated')
        .withArgs(feeCollector.address, 500);

      expect(await getRoyaltyInfo(0, 100)).to.deep.equal([
        feeCollector.address,
        BigNumber.from(5),
      ]);
      expect(await getRoyaltyInfo(1, 100_000)).to.deep.equal([
        feeCollector.address,
        BigNumber.from(5000),
      ]);

      // interface id for EIP-2981 is 0x2a55205a
      expect(await theGenerates.supportsInterface('0x2a55205a')).to.equal(true);
    });

    it("should return the correct tokenURI based on baseURI's last character", async () => {
      await setMaxSupply({ supply: 2 });
      await mintPublicTokens({
        minter: owner,
        quantity: 2,
      });

      // Revert on nonexistent token
      await expect(getTokenUri(99)).to.be.revertedWithCustomError(
        theGenerates,
        'URIQueryForNonexistentToken'
      );

      // If the baseURI is empty then the tokenURI should be empty
      await expect(setBaseUri({ uri: '' })).to.emit(
        theGenerates,
        'BatchMetadataUpdate'
      );
      expect(await getBaseUri()).to.equal('');
      expect(await getTokenUri(1)).to.equal('');
      await expect(getTokenUri(15)).to.be.revertedWithCustomError(
        theGenerates,
        'URIQueryForNonexistentToken'
      );

      // If the baseURI ends with "/" then the tokenURI should be baseURI + tokenId
      await expect(setBaseUri({ uri: 'http://example.com/' })).to.emit(
        theGenerates,
        'BatchMetadataUpdate'
      );

      expect(await getBaseUri()).to.equal('http://example.com/');
      expect(await getTokenUri(1)).to.equal('http://example.com/1');
      expect(await getTokenUri(2)).to.equal('http://example.com/2');

      // If the baseURI does not end with "/" then the tokenURI should just be baseURI
      await expect(setBaseUri({ uri: 'http://example.com' })).to.emit(
        theGenerates,
        'BatchMetadataUpdate'
      );

      expect(await getBaseUri()).to.equal('http://example.com');
      expect(await getTokenUri(1)).to.equal('http://example.com');
      expect(await getTokenUri(2)).to.equal('http://example.com');
    });

    it('only owner can set the provenance hash', async () => {
      expect(await getProvenanceHash()).to.equal(ZERO_BYTES32);

      const defaultProvenanceHash = `0x${'0'.repeat(64)}`;
      const firstProvenanceHash = `0x${'1'.repeat(64)}`;
      const secondProvenanceHash = `0x${'2'.repeat(64)}`;

      await expect(
        setProvenanceHash({ caller: bob, hash: firstProvenanceHash })
      ).to.revertedWithCustomError(theGenerates, 'Unauthorized');

      await expect(setProvenanceHash({ hash: firstProvenanceHash }))
        .to.emit(theGenerates, 'ProvenanceHashUpdated')
        .withArgs(defaultProvenanceHash, firstProvenanceHash);


      // @note will be able to update provenanceHash due to the nature our seasonal drops.
      await expect(setProvenanceHash({ hash: secondProvenanceHash }))
      .to.emit(theGenerates, 'ProvenanceHashUpdated')
      .withArgs(firstProvenanceHash, secondProvenanceHash);
    });

    it('only owner can set transfer validator', async () => {
      await expect(
        theGenerates
          .connect(bob)
          .setTransferValidator(mockTransferValidatorAlwaysReverts.address)
      ).to.be.revertedWithCustomError(theGenerates, 'Unauthorized');

      await expect(
        theGenerates.setTransferValidator(
          mockTransferValidatorAlwaysReverts.address
        )
      )
        .to.emit(theGenerates, 'TransferValidatorUpdated')
        .withArgs(ZERO_ADDRESS, mockTransferValidatorAlwaysReverts.address);
    });

    it('transfer validator policies applies properly', async () => {
      await theGenerates.setTransferValidator(
        mockTransferValidatorAlwaysReverts.address
      );
      await setMaxSupply({ supply: 1 });
      await mintPublicTokens({
        minter: owner,
      });

      await expect(
        theGenerates.transferFrom(owner.address, bob.address, 1)
      ).to.be.revertedWith('MockTransferValidator: always reverts');

      await theGenerates.setTransferValidator(
        mockTransferValidatorAlwaysSucceeds.address
      );

      await theGenerates.transferFrom(owner.address, bob.address, 1);

      expect(await theGenerates.ownerOf(1)).to.eq(bob.address);
    });

    it('revert on unsupported function selector', async () => {
      await expect(
        owner.sendTransaction({
          to: theGenerates.address,
          data: '0x12345678',
          gasLimit: 50_000,
        })
      )
        .to.be.revertedWithCustomError(
          theGenerates,
          'UnsupportedFunctionSelector'
        )
        .withArgs('0x12345678');
    });
  });
});
