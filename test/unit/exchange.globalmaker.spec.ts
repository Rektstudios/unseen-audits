import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, type Wallet } from 'ethers';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  GlobalMaker,
  MockERC20,
  MockERC721,
  UnseenExchange,
  UnseenRegistry,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { AdvancedMatchingOptions, ProtocolFees } from '@utils/types';

import { ZERO_ADDRESS, globalMakerSigMakerOffsets } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/helpers';

describe(`Exchange Global Maker - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let mockERC721: MockERC721;
  let globalMaker: GlobalMaker;
  let registry: UnseenRegistry;
  let feeCollector: FeeCollector;
  let marketplace: UnseenExchange;

  let getProtocolFees: UnseenFixtures['getProtocolFees'];
  let placeAsk: UnseenFixtures['placeAsk'];
  let placeBid: UnseenFixtures['placeBid'];
  let matchOrders: UnseenFixtures['matchOrders'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;
  let creator: Wallet;
  let sender: Wallet;

  let globalMakerProxy: string;

  let { pFee, treasury }: ProtocolFees = {
    pFee: 500,
    treasury: ZERO_ADDRESS,
  };

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    creator = new ethers.Wallet(randomHex(32), provider);
    sender = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice, sender]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, alice, creator, sender };
  }

  before(async () => {
    ({ owner, bob, alice, creator, sender } = await loadFixture(setupFixture));

    ({
      globalMaker,
      registry,
      marketplace,
      feeCollector,
      placeAsk,
      placeBid,
      matchOrders,
      getProtocolFees,
    } = await unseenFixture(owner));

    ({ pFee, treasury } = await getProtocolFees());

    globalMakerProxy = await registry.proxies(globalMaker.address);
    await registry.grantInitialExchangeAuthentication(marketplace.address);
  });

  beforeEach(async function () {
    ({ mockERC20, mockERC721 } = await unseenFixture(owner));
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('GlobalMaker', ...args);
      if (expectedError)
        await expect(deployment).to.be.revertedWith(expectedError);
      else {
        const globalMaker = await deployment;
        expect(
          await globalMaker.sigMakerOffsets(globalMakerSigMakerOffsets[0].sig)
        ).to.eq(4);
        expect(
          await globalMaker.sigMakerOffsets(globalMakerSigMakerOffsets[1].sig)
        ).to.eq(4);
        expect(await globalMaker.NAME()).to.eq('Unseen Global Maker');
        expect(await registry.proxies(globalMaker.address)).to.not.eq(
          ZERO_ADDRESS
        );
      }
    };

    it('reverts if owner or configurer is set to address 0', async function () {
      const t = async (
        registryToSet: string,
        FnSig: string[],
        Offset: number[],
        expectedError: string
      ) => {
        await testConstructor(expectedError, registryToSet, FnSig, Offset);
      };
      await t(
        ZERO_ADDRESS,
        globalMakerSigMakerOffsets.map((a) => a.sig),
        globalMakerSigMakerOffsets.map((a) => a.offset),
        'Registry cannot be address 0'
      );
      await t(
        registry.address,
        [],
        globalMakerSigMakerOffsets.map((a) => a.offset),
        'No function signatures passed, GlobalMaker would be inert.'
      );
      await t(
        registry.address,
        globalMakerSigMakerOffsets.map((a) => a.sig),
        [],
        'functionSignatures and makerOffsets lengths not equal'
      );
      await t(
        registry.address,
        globalMakerSigMakerOffsets.map((a) => a.sig),
        globalMakerSigMakerOffsets.map((a) => a.offset),
        ''
      );
    });
  });

  context('match orders', function () {
    const ERC721ForERC20WithRoyaltiesFees = async (
      options: AdvancedMatchingOptions['ERC721']
    ) => {
      const {
        tokenId,
        buyTokenId,
        sellingPrice,
        buyingPrice,
        erc20MintAmount,
        maker,
        taker,
        protocolFees,
        royalties,
      } = options;

      const { treasury, pFee } = protocolFees!;
      const { creator, feebps } = royalties!;

      await mockERC721.connect(maker).setApprovalForAll(globalMakerProxy, true);
      await mockERC20.connect(taker).approve(globalMakerProxy, erc20MintAmount);
      await mockERC721['mint(address,uint256)'](maker.address, tokenId);
      await mockERC20.mint(taker.address, erc20MintAmount);

      if (buyTokenId)
        await mockERC721['mint(address,uint256)'](maker.address, buyTokenId);

      const protocolFeesAmount = sellingPrice.mul(pFee).div(10000);
      const royaltiesFeesAmount = sellingPrice.mul(feebps).div(10000);
      const sellerAmount = sellingPrice.sub(
        protocolFeesAmount.add(royaltiesFeesAmount)
      );

      const sellData = await placeAsk<'ERC721Fees'>({
        maker,
        executer: globalMaker.address,
        tokenType: 'ERC721Fees',
        tokenAddress: mockERC721.address,
        tokenId,
        erc20Address: mockERC20.address,
        erc20SellPrice: sellingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: {
          sellerAmount,
          protocolFees: {
            treasury,
            pFee: protocolFeesAmount,
          },
          royalties: {
            creator,
            feebps: royaltiesFeesAmount,
          },
        },
      });
      const buyData = await placeBid<'ERC721Fees'>({
        taker,
        executer: globalMaker.address,
        tokenType: 'ERC721Fees',
        tokenAddress: mockERC721.address,
        tokenId: buyTokenId ?? tokenId,
        erc20Address: mockERC20.address,
        erc20BuyPrice: buyingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: {
          sellerAmount,
          protocolFees: {
            treasury,
            pFee: protocolFeesAmount,
          },
          royalties: {
            creator,
            feebps: royaltiesFeesAmount,
          },
        },
      });

      const tx = await matchOrders({
        sender: maker,
        tokenType: 'ERC721Fees',
        sellOrder: sellData.order,
        sellSig: sellData.signature,
        buyOrder: buyData.order,
        buySig: buyData.signature,
        buyAmount: 1,
      });
      const receipt = await tx.wait();
      console.log('Gas used: ', receipt.gasUsed.toString());

      expect(await mockERC20.balanceOf(maker.address)).to.eq(sellerAmount);
      expect(await mockERC20.balanceOf(feeCollector.address)).to.eq(
        protocolFeesAmount
      );
      expect(await mockERC20.balanceOf(creator)).to.eq(royaltiesFeesAmount);
      expect(await mockERC721.ownerOf(tokenId)).to.eq(taker.address);
    };
    it('should match any orders with global maker', async function () {
      const price = BigNumber.from(15000);

      return ERC721ForERC20WithRoyaltiesFees({
        tokenId: 10,
        sellingPrice: price,
        buyingPrice: price,
        erc20MintAmount: price,
        maker: bob,
        taker: alice,
        sender,
        protocolFees: {
          treasury,
          pFee,
        },
        royalties: {
          creator: creator.address,
          feebps: 500,
        },
      });
    });
  });
});
