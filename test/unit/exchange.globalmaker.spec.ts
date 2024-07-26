import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, Signature, type Wallet } from 'ethers';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  GlobalMaker,
  MockERC1155,
  MockERC20,
  MockERC721,
  UnseenExchange,
  UnseenRegistry,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { AdvancedMatchingOptions, ProtocolFees } from '@utils/types';

import { NULL_SIG, ZERO_ADDRESS, globalMakerSigMakerOffsets } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/helpers';

describe(`Exchange Global Maker - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let mockERC721: MockERC721;
  let mockERC1155: MockERC1155;
  let globalMaker: GlobalMaker;
  let registry: UnseenRegistry;
  let feeCollector: FeeCollector;
  let marketplace: UnseenExchange;

  let getProtocolFees: UnseenFixtures['getProtocolFees'];
  let placeAsk: UnseenFixtures['placeAsk'];
  let placeBid: UnseenFixtures['placeBid'];
  let matchOrders: UnseenFixtures['matchOrders'];
  let getAndVerifyOrderHash: UnseenFixtures['getAndVerifyOrderHash'];

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
  let malicious: Wallet;

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
    malicious = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice, sender, malicious]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, alice, creator, sender, malicious };
  }

  before(async () => {
    ({ owner, bob, alice, creator, sender, malicious } = await loadFixture(
      setupFixture
    ));

    ({
      globalMaker,
      registry,
      marketplace,
      feeCollector,
      placeAsk,
      placeBid,
      matchOrders,
      getProtocolFees,
      getAndVerifyOrderHash,
    } = await unseenFixture(owner));

    ({ pFee, treasury } = await getProtocolFees());

    globalMakerProxy = await registry.proxies(globalMaker.address);
    await registry.grantInitialExchangeAuthentication(marketplace.address);
  });

  beforeEach(async function () {
    ({ mockERC20, mockERC721, mockERC1155 } = await unseenFixture(owner));
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

    it('reverts if registry, fnSignatures or makerOffsets are set to 0', async function () {
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

    const anyERC1155ForERC20WithRoyaltiesFees = async (
      options: AdvancedMatchingOptions['ERC1155']
    ) => {
      const {
        tokenId,
        buyTokenId,
        sellAmount,
        sellingPrice,
        sellingNumerator,
        buyingPrice,
        buyAmount,
        buyingDenominator,
        erc1155MintAmount,
        erc20MintAmount,
        maker,
        taker,
        sender,
        txCount = 1,
        protocolFees,
        royalties,
      } = options;

      const { creator, feebps } = royalties!;

      const { treasury, pFee } = protocolFees!;

      const protocolFeesAmount = sellingPrice
        .mul(buyAmount)
        .mul(pFee)
        .div(10000);
      const royaltiesFeesAmount = sellingPrice
        .mul(buyAmount)
        .mul(feebps)
        .div(10000);
      const sellerAmount = sellingPrice
        .mul(buyAmount)
        .sub(protocolFeesAmount.add(royaltiesFeesAmount));

      await mockERC20.connect(taker).approve(globalMakerProxy, erc20MintAmount);
      await mockERC1155
        .connect(maker)
        .setApprovalForAll(globalMakerProxy, true);
      await mockERC20.mint(taker.address, erc20MintAmount);

      await mockERC1155['mint(address,uint256,uint256)'](
        maker.address,
        tokenId,
        erc1155MintAmount
      );

      if (buyTokenId)
        await mockERC1155['mint(address,uint256,uint256)'](
          maker.address,
          buyTokenId,
          erc1155MintAmount
        );

      const { order: sellOrder, signature: sellSig } =
        await placeAsk<'ERC1155Fees'>({
          maker,
          executer: globalMaker.address,
          tokenType: 'ERC1155Fees',
          tokenAddress: mockERC1155.address,
          tokenId,
          erc20Address: mockERC20.address,
          erc20SellPrice: sellingPrice,
          expirationTime: BigNumber.from(0),
          optionalParams: {
            erc1155Amount: sellAmount,
            erc1155ratio: sellingNumerator ?? 1,
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
      for (let i = 0; i < txCount; ++i) {
        const { order: buyOrder, signature: buySig } =
          await placeBid<'ERC1155Fees'>({
            taker,
            executer: globalMaker.address,
            tokenType: 'ERC1155Fees',
            tokenAddress: mockERC1155.address,
            tokenId: buyTokenId ?? tokenId,
            erc20Address: mockERC20.address,
            erc20BuyPrice: buyingPrice,
            expirationTime: BigNumber.from(0),
            optionalParams: {
              erc1155Amount: buyAmount,
              erc1155ratio: buyingDenominator ?? 1,
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
          sender,
          tokenType: 'ERC1155Fees',
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount: (sellingNumerator ?? 1) * buyAmount,
        });
        await tx.wait();
        buyOrder.extraData = buyOrder.extraData.slice(0, -32) + randomHex(16);
      }

      expect(await mockERC20.balanceOf(maker.address)).to.eq(
        sellerAmount.mul(txCount)
      );

      expect(await mockERC20.balanceOf(feeCollector.address)).to.eq(
        protocolFeesAmount.mul(txCount)
      );

      expect(await mockERC20.balanceOf(creator)).to.eq(
        royaltiesFeesAmount.mul(txCount)
      );

      expect(await mockERC1155.balanceOf(taker.address, tokenId)).to.eq(
        (sellingNumerator ?? 1) * buyAmount * txCount ?? buyAmount * txCount
      );
    };

    it('should match any ERC721 orders with global maker', async function () {
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

    it('should not match ERC721 orders with global maker and diff order.maker who approved shared proxy', async function () {
      const price = BigNumber.from(1);

      await mockERC721.connect(bob).setApprovalForAll(globalMakerProxy, true);
      await mockERC20.connect(alice).approve(globalMakerProxy, price);
      await mockERC721['mint(address,uint256)'](bob.address, 10);
      await mockERC20.mint(alice.address, price);

      const protocolFeesAmount = price.mul(pFee).div(10000);
      const royaltiesFeesAmount = price.mul(500).div(10000);
      const sellerAmount = price.sub(
        protocolFeesAmount.add(royaltiesFeesAmount)
      );

      const sellData = await placeAsk<'ERC721Fees'>({
        maker: bob,
        executer: globalMaker.address,
        tokenType: 'ERC721Fees',
        tokenAddress: mockERC721.address,
        tokenId: 10,
        erc20Address: mockERC20.address,
        erc20SellPrice: price,
        expirationTime: BigNumber.from(0),
        optionalParams: {
          sellerAmount,
          protocolFees: {
            treasury,
            pFee: protocolFeesAmount,
          },
          royalties: {
            creator: creator.address,
            feebps: royaltiesFeesAmount,
          },
        },
      });
      const buyData = await placeBid<'ERC721Fees'>({
        taker: malicious,
        executer: globalMaker.address,
        tokenType: 'ERC721Fees',
        tokenAddress: mockERC721.address,
        tokenId: 10,
        erc20Address: mockERC20.address,
        erc20BuyPrice: price,
        expirationTime: BigNumber.from(0),
        optionalParams: {
          sellerAmount,
          protocolFees: {
            treasury,
            pFee: protocolFeesAmount,
          },
          royalties: {
            creator: creator.address,
            feebps: royaltiesFeesAmount,
          },
        },
      });

      await expect(
        matchOrders({
          sender: malicious,
          tokenType: 'ERC721Fees',
          sellOrder: sellData.order,
          sellSig: NULL_SIG as Signature,
          buyOrder: buyData.order,
          buySig: buyData.signature,
          buyAmount: 1,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'FirstOrderFailedAuthorization'
      );
    });

    it('should match any ERC1155 orders with global maker', async () => {
      const price = BigNumber.from(10000);

      return anyERC1155ForERC20WithRoyaltiesFees({
        tokenId: 5,
        sellAmount: 1,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount: 1,
        erc1155MintAmount: 1,
        erc20MintAmount: price,
        maker: bob,
        taker: alice,
        sender,
        protocolFees: {
          treasury,
          pFee,
        },
        royalties: {
          feebps: 500,
          creator: creator.address,
        },
      });
    });

    it('should not match ERC1155 orders with global maker and diff order.maker who approved shared proxy', async () => {
      const sellingPrice = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(10000);
      const sellAmount = 10;
      const buyAmount = 5;
      const feebps = 500;
      const erc20MintAmount = sellingPrice.mul(sellAmount);

      const protocolFeesAmount = sellingPrice
        .mul(buyAmount)
        .mul(pFee)
        .div(10000);
      const royaltiesFeesAmount = sellingPrice
        .mul(buyAmount)
        .mul(feebps)
        .div(10000);
      const sellerAmount = sellingPrice
        .mul(buyAmount)
        .sub(protocolFeesAmount.add(royaltiesFeesAmount));

      await mockERC20.connect(alice).approve(globalMakerProxy, erc20MintAmount);
      await mockERC1155.connect(bob).setApprovalForAll(globalMakerProxy, true);
      await mockERC20.mint(alice.address, erc20MintAmount);

      await mockERC1155['mint(address,uint256,uint256)'](
        bob.address,
        5,
        sellAmount
      );

      const { order: sellOrder, signature: sellSig } =
        await placeAsk<'ERC1155Fees'>({
          maker: bob,
          executer: globalMaker.address,
          tokenType: 'ERC1155Fees',
          tokenAddress: mockERC1155.address,
          tokenId: 5,
          erc20Address: mockERC20.address,
          erc20SellPrice: sellingPrice,
          expirationTime: BigNumber.from(0),
          optionalParams: {
            erc1155Amount: sellAmount,
            erc1155ratio: 1,
            sellerAmount,
            protocolFees: {
              treasury,
              pFee: protocolFeesAmount,
            },
            royalties: {
              creator: creator.address,
              feebps: royaltiesFeesAmount,
            },
          },
        });

      const { order: buyOrder, signature: buySig } =
        await placeBid<'ERC1155Fees'>({
          taker: malicious,
          executer: globalMaker.address,
          tokenType: 'ERC1155Fees',
          tokenAddress: mockERC1155.address,
          tokenId: 5,
          erc20Address: mockERC20.address,
          erc20BuyPrice: buyingPrice,
          expirationTime: BigNumber.from(0),
          optionalParams: {
            erc1155Amount: buyAmount,
            erc1155ratio: 1,
            sellerAmount,
            protocolFees: {
              treasury,
              pFee: protocolFeesAmount,
            },
            royalties: {
              creator: creator.address,
              feebps: royaltiesFeesAmount,
            },
          },
        });

      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: buyOrder,
      });

      /**
       * try to set order fill in order to bypass validations in validateOrderAuthorization :
       *
       * - if (fills[maker][hash] != 0) return true
       * - if (maker == msg.sender) return true
       * - if (approved[maker][hash]) return true
       *
       * @note in all those checks , global maker kind can never be msg.sender
       *
       */

      await marketplace.connect(malicious).setOrderFill(orderHash, 1);

      await expect(
        matchOrders({
          sender: malicious,
          tokenType: 'ERC1155Fees',
          sellOrder,
          sellSig: NULL_SIG as Signature,
          buyOrder,
          buySig,
          buyAmount: 1,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'FirstOrderFailedAuthorization'
      );
    });
  });
});
