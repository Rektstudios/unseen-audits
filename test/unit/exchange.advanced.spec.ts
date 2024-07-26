import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber, type Wallet } from 'ethers';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  MockERC1155,
  MockERC20,
  MockERC721,
  UnseenExchange,
  UnseenRegistry,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { AdvancedMatchingOptions, ProtocolFees } from '@utils/types';

import { ZERO_ADDRESS } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { validTokenID } from 'utils/helper-functions';

describe(`Exchange Advanced - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let mockERC721: MockERC721;
  let mockERC1155: MockERC1155;
  let marketplace: UnseenExchange;
  let feeCollector: FeeCollector;
  let registry: UnseenRegistry;

  let cancelOrder: UnseenFixtures['cancelOrder'];
  let placeAsk: UnseenFixtures['placeAsk'];
  let placeBid: UnseenFixtures['placeBid'];
  let matchOrders: UnseenFixtures['matchOrders'];
  let registerOrGetProxy: UnseenFixtures['registerOrGetProxy'];
  let getProtocolFees: UnseenFixtures['getProtocolFees'];
  let matchERC20ForERC20: UnseenFixtures['matchERC20ForERC20'];
  let offerERC20ForERC20: UnseenFixtures['offerERC20ForERC20'];
  let getAndVerifyOrderHash: UnseenFixtures['getAndVerifyOrderHash'];
  let offerNFTForNFT: UnseenFixtures['offerNFTForNFT'];
  let matchNFTForNFT: UnseenFixtures['matchNFTForNFT'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;
  let sender: Wallet;
  let creator: Wallet;

  let { pFee, treasury }: ProtocolFees = {
    pFee: 500,
    treasury: ZERO_ADDRESS,
  };

  let bobProxy: string;
  let aliceProxy: string;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    sender = new ethers.Wallet(randomHex(32), provider);
    creator = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice, sender]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, alice, sender, creator };
  }

  before(async () => {
    ({ owner, bob, alice, sender, creator } = await loadFixture(setupFixture));

    ({
      feeCollector,
      marketplace,
      feeCollector,
      registry,
      cancelOrder,
      registerOrGetProxy,
      getAndVerifyOrderHash,
      getProtocolFees,
      placeAsk,
      placeBid,
      matchOrders,
      matchERC20ForERC20,
      offerERC20ForERC20,
      matchNFTForNFT,
      offerNFTForNFT,
    } = await unseenFixture(owner));

    ({ pFee, treasury } = await getProtocolFees());

    ({ proxy: bobProxy } = await registerOrGetProxy(bob));
    ({ proxy: aliceProxy } = await registerOrGetProxy(alice));
    await registry.grantInitialExchangeAuthentication(marketplace.address);
  });

  beforeEach(async function () {
    ({ mockERC20, mockERC721, mockERC1155 } = await unseenFixture(owner));
  });

  context('ERC1155 <> ERC20 orders', () => {
    const anyERC1155ForERC20 = async (
      options: AdvancedMatchingOptions['ERC1155']
    ) => {
      const {
        tokenId,
        buyTokenId,
        sellAmount,
        sellingPrice,
        sellingNumerator = 1,
        buyingPrice,
        buyAmount,
        buyingDenominator = 1,
        erc1155MintAmount,
        erc20MintAmount,
        maker,
        taker,
        sender,
        txCount = 1,
      } = options;

      await mockERC1155.connect(maker).setApprovalForAll(bobProxy, true);
      await mockERC20.connect(taker).approve(aliceProxy, erc20MintAmount);
      await mockERC1155['mint(address,uint256,uint256)'](
        maker.address,
        tokenId,
        erc1155MintAmount
      );
      await mockERC20.mint(taker.address, erc20MintAmount);

      if (buyTokenId)
        await mockERC1155['mint(address,uint256,uint256)'](
          maker.address,
          buyTokenId,
          erc1155MintAmount
        );

      const { order: sellOrder, signature: sellSig } =
        await placeAsk<'ERC1155'>({
          maker,
          tokenType: 'ERC1155',
          tokenAddress: mockERC1155.address,
          tokenId,
          erc20Address: mockERC20.address,
          erc20SellPrice: sellingPrice,
          expirationTime: BigNumber.from(0),
          optionalParams: {
            erc1155Amount: sellAmount,
            erc1155ratio: sellingNumerator,
          },
        });

      for (let i = 0; i < txCount; ++i) {
        const { order: buyOrder, signature: buySig } =
          await placeBid<'ERC1155'>({
            taker,
            tokenType: 'ERC1155',
            tokenAddress: mockERC1155.address,
            tokenId: buyTokenId ?? tokenId,
            erc20Address: mockERC20.address,
            erc20BuyPrice: buyingPrice,
            expirationTime: BigNumber.from(0),
            optionalParams: {
              erc1155Amount: buyAmount,
              erc1155ratio: buyingDenominator,
            },
          });

        await matchOrders({
          sender,
          tokenType: 'ERC1155',
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount: sellingNumerator * buyAmount ?? buyAmount,
        });
        buyOrder.extraData = buyOrder.extraData.slice(0, -32) + randomHex(16);
      }

      const makerERC20Balance = await mockERC20.balanceOf(maker.address);
      const takerERC1155Balance = await mockERC1155.balanceOf(
        taker.address,
        tokenId
      );

      expect(makerERC20Balance).to.eq(sellingPrice.mul(buyAmount).mul(txCount));

      expect(takerERC1155Balance.toNumber()).to.eq(
        sellingNumerator * buyAmount * txCount ?? buyAmount * txCount
      );
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

      await mockERC20.connect(taker).approve(aliceProxy, erc20MintAmount);
      await mockERC1155.connect(maker).setApprovalForAll(bobProxy, true);
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

    it('matches erc1155 <> erc20 order, 1 fill', async () => {
      const price = BigNumber.from(10000);

      return anyERC1155ForERC20({
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
      });
    });

    it('matches ERC1155 <> ERC20 order, multiple fills in 1 transaction', async () => {
      const amount = 3;
      const price = BigNumber.from(10000);

      return anyERC1155ForERC20({
        tokenId: 5,
        sellAmount: amount,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount: amount,
        erc1155MintAmount: amount,
        erc20MintAmount: price.mul(amount),
        maker: bob,
        taker: alice,
        sender: bob,
      });
    });

    it('matches ERC1155 <> ERC20 order, multiple fills in multiple txCount', async () => {
      const nftAmount = 3;
      const buyAmount = 1;
      const price = BigNumber.from(10000);
      const txCount = 3;

      return anyERC1155ForERC20({
        tokenId: 5,
        sellAmount: nftAmount,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount,
        erc1155MintAmount: nftAmount,
        erc20MintAmount: price.mul(buyAmount).mul(txCount),
        maker: bob,
        taker: alice,
        sender: bob,
        txCount,
      });
    });

    it('matches ERC1155 <> ERC20 order, allows any partial fill', async () => {
      const nftAmount = 30;
      const buyAmount = 4;
      const price = BigNumber.from(10000);

      return anyERC1155ForERC20({
        tokenId: 5,
        sellAmount: nftAmount,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount,
        erc1155MintAmount: nftAmount,
        erc20MintAmount: price.mul(buyAmount),
        maker: bob,
        taker: alice,
        sender: bob,
      });
    });

    it('matches ERC1155 <> ERC20 order with any matching ratio', async () => {
      const lot = 83974;
      const price = BigNumber.from(972);

      return anyERC1155ForERC20({
        tokenId: 5,
        sellAmount: 6,
        sellingNumerator: lot,
        sellingPrice: price,
        buyingPrice: price,
        buyingDenominator: lot,
        buyAmount: 3,
        erc1155MintAmount: lot * 6,
        erc20MintAmount: price.mul(3),
        maker: bob,
        taker: alice,
        sender: bob,
      });
    });

    it('does not fill ERC1155 <> ERC20 order with different prices', async () => {
      const price = BigNumber.from(10000);

      await expect(
        anyERC1155ForERC20({
          tokenId: 5,
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice: price.sub(10),
          buyAmount: 1,
          erc1155MintAmount: 1,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender: bob,
        })
      ).to.be.rejectedWith("ERC20 buying prices don't match on orders");
    });

    it('does not fill ERC1155 <> ERC20 order with different ratios', async () => {
      const price = BigNumber.from(10000);

      await expect(
        anyERC1155ForERC20({
          tokenId: 5,
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice: price,
          buyingDenominator: 2,
          buyAmount: 1,
          erc1155MintAmount: 1,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender: bob,
        })
      ).to.be.rejectedWith("ERC1155 Numerator and Denominator don't match");
    });

    it('does not fill ERC1155 <> ERC20 order if balance is insufficient', async () => {
      const nftAmount = 1;
      const buyAmount = 1;
      const price = BigNumber.from(10000);

      await expect(
        anyERC1155ForERC20({
          tokenId: 5,
          sellAmount: nftAmount,
          sellingPrice: price,
          buyingPrice: price,
          buyAmount,
          erc1155MintAmount: nftAmount,
          erc20MintAmount: price.mul(buyAmount).sub(1),
          maker: bob,
          taker: alice,
          sender: bob,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SecondCallFailed');
    });

    it('does not fill ERC1155 <> ERC20 order if the token IDs are different', async () => {
      const price = BigNumber.from(10000);

      await expect(
        anyERC1155ForERC20({
          tokenId: 5,
          buyTokenId: 6,
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice: price,
          buyAmount: 1,
          erc1155MintAmount: 1,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender: bob,
        })
      ).to.be.rejectedWith("ERC1155 token IDs don't match on orders");
    });

    it('matches ERC1155 <> ERC20 order, 1 fill with only royalties', async () => {
      const price = BigNumber.from(10000);

      await marketplace.changeProtocolFee(0);

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
          pFee: 0,
        },
        royalties: {
          feebps: 1000,
          creator: creator.address,
        },
      });
    });

    it('matches ERC1155 <> ERC20 order, 1 fill with only protocol fees', async () => {
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
          feebps: 0,
          creator: creator.address,
        },
      });
    });

    it('matches ERC1155 <> ERC20 order, 1 fill with royalties and protocol fees', async () => {
      const price = BigNumber.from(10000);

      // @note added to reset protocol fees
      await marketplace.changeProtocolFee(500);

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
          feebps: 1000,
          creator: creator.address,
        },
      });
    });

    it('matches ERC1155 <> ERC20 order, 1 fill with royalties and protocol fees with any matching ratio', async () => {
      const lot = 100;
      const price = BigNumber.from(10000);

      return anyERC1155ForERC20WithRoyaltiesFees({
        tokenId: 5,
        sellAmount: 10,
        sellingNumerator: lot,
        sellingPrice: price,
        buyingPrice: price,
        buyingDenominator: lot,
        buyAmount: 5,
        erc20MintAmount: price.mul(5),
        erc1155MintAmount: lot * 10,
        maker: bob,
        taker: alice,
        sender,
        protocolFees: {
          treasury,
          pFee,
        },
        royalties: {
          feebps: 1000,
          creator: creator.address,
        },
      });
    });
  });

  context('Lazy ERC1155 <> ERC20 orders', () => {
    const lazyERC1155ForERC20 = async (
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
        extraBytes = [],
      } = options;

      await mockERC20.connect(taker).approve(aliceProxy, erc20MintAmount);
      await mockERC20.mint(taker.address, erc20MintAmount);
      await mockERC1155.connect(maker).setApprovalForAll(bobProxy, true);

      if (buyTokenId)
        await mockERC1155['mint(address,uint256,uint256)'](
          maker.address,
          buyTokenId,
          erc1155MintAmount
        );

      const { order: sellOrder, signature: sellSig } =
        await placeAsk<'LazyERC1155'>({
          maker,
          tokenType: 'LazyERC1155',
          tokenAddress: mockERC1155.address,
          tokenId,
          erc20Address: mockERC20.address,
          erc20SellPrice: sellingPrice,
          expirationTime: BigNumber.from(0),
          optionalParams: {
            erc1155Amount: sellAmount,
            erc1155ratio: sellingNumerator ?? 1,
            extraBytes,
          },
        });
      for (let i = 0; i < txCount; ++i) {
        const { order: buyOrder, signature: buySig } =
          await placeBid<'LazyERC1155'>({
            taker,
            tokenType: 'LazyERC1155',
            tokenAddress: mockERC1155.address,
            tokenId: buyTokenId ?? tokenId,
            erc20Address: mockERC20.address,
            erc20BuyPrice: buyingPrice,
            expirationTime: BigNumber.from(0),
            optionalParams: {
              erc1155Amount: buyAmount,
              erc1155ratio: buyingDenominator ?? 1,
              extraBytes,
            },
          });
        await matchOrders({
          sender,
          tokenType: 'LazyERC1155',
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount: sellingNumerator ?? buyAmount,
        });
        buyOrder.extraData = buyOrder.extraData.slice(0, -32) + randomHex(16);
      }

      const makerERC20Balance = await mockERC20.balanceOf(maker.address);
      const takerERC1155Balance = await mockERC1155.balanceOf(
        taker.address,
        tokenId
      );
      expect(makerERC20Balance.toNumber()).to.eq(
        sellingPrice.mul(buyAmount).mul(txCount)
      );

      expect(takerERC1155Balance.toNumber()).to.eq(
        sellingNumerator ?? buyAmount * txCount
      );
    };

    it('StaticMarket: matches ERC1155 <> ERC20 order, multiple fills in 1 transaction', async () => {
      const amount = 3;
      const price = BigNumber.from(10000);

      return lazyERC1155ForERC20({
        tokenId: validTokenID(bob),
        sellAmount: amount,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount: amount,
        erc1155MintAmount: amount,
        erc20MintAmount: price.mul(amount),
        maker: bob,
        taker: alice,
        sender: bob,
        extraBytes: '0x',
      });
    });

    it('StaticMarket: matches ERC1155 <> ERC20 order, multiple fills in multiple txCount', async () => {
      const nftAmount = 3;
      const buyAmount = 1;
      const price = BigNumber.from(10000);
      const txCount = 3;

      return lazyERC1155ForERC20({
        tokenId: validTokenID(bob),
        sellAmount: nftAmount,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount,
        erc1155MintAmount: nftAmount,
        erc20MintAmount: price.mul(buyAmount).mul(txCount),
        maker: bob,
        taker: alice,
        sender: bob,
        txCount,
        extraBytes: '0x',
      });
    });

    it('StaticMarket: matches ERC1155 <> ERC20 order, allows any partial fill', async () => {
      const nftAmount = 30;
      const buyAmount = 4;
      const price = BigNumber.from(10000);

      return lazyERC1155ForERC20({
        tokenId: validTokenID(bob),
        sellAmount: nftAmount,
        sellingPrice: price,
        buyingPrice: price,
        buyAmount,
        erc1155MintAmount: nftAmount,
        erc20MintAmount: price.mul(buyAmount),
        maker: bob,
        taker: alice,
        sender: bob,
        extraBytes: '0x',
      });
    });

    it('StaticMarket: matches ERC1155 <> ERC20 order with any matching ratio', async () => {
      const lot = 83974;
      const price = BigNumber.from(972);

      return lazyERC1155ForERC20({
        tokenId: validTokenID(bob),
        sellAmount: 6,
        sellingNumerator: lot,
        sellingPrice: price,
        buyingPrice: price,
        buyingDenominator: lot,
        buyAmount: 1,
        erc1155MintAmount: lot,
        erc20MintAmount: price,
        maker: bob,
        taker: alice,
        sender: bob,
        extraBytes: '0x',
      });
    });

    it('StaticMarket: does not fill ERC1155 <> ERC20 order with different prices', async () => {
      const price = BigNumber.from(10000);

      await expect(
        lazyERC1155ForERC20({
          tokenId: validTokenID(bob),
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice: price.sub(10),
          buyAmount: 1,
          erc1155MintAmount: 1,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender: bob,
          extraBytes: '0x',
        })
      ).to.be.rejectedWith("ERC20 buying prices don't match on orders");
    });

    it('StaticMarket: does not fill ERC1155 <> ERC20 order with different ratios', async () => {
      const price = BigNumber.from(10000);

      await expect(
        lazyERC1155ForERC20({
          tokenId: validTokenID(bob),
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice: price,
          buyingDenominator: 2,
          buyAmount: 1,
          erc1155MintAmount: 1,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender: bob,
          extraBytes: '0x',
        })
      ).to.be.rejectedWith("ERC1155 Numerator and Denominator don't match");
    });

    it('StaticMarket: does not fill ERC1155 <> ERC20 order if balance is insufficient', async () => {
      const nftAmount = 1;
      const buyAmount = 1;
      const price = BigNumber.from(10000);

      await expect(
        lazyERC1155ForERC20({
          tokenId: validTokenID(bob),
          sellAmount: nftAmount,
          sellingPrice: price,
          buyingPrice: price,
          buyAmount,
          erc1155MintAmount: nftAmount,
          erc20MintAmount: price.mul(buyAmount).sub(1),
          maker: bob,
          taker: alice,
          sender: bob,
          extraBytes: '0x',
        })
      ).to.be.revertedWithCustomError(marketplace, 'SecondCallFailed');
    });

    it('StaticMarket: does not fill ERC1155 <> ERC20 order if the token IDs are different', async () => {
      const price = BigNumber.from(10000);

      await expect(
        lazyERC1155ForERC20({
          tokenId: validTokenID(bob),
          buyTokenId: 6,
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice: price,
          buyAmount: 1,
          erc1155MintAmount: 1,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender: bob,
          extraBytes: '0x',
        })
      ).to.be.rejectedWith("ERC1155 token IDs don't match on orders");
    });
  });

  context('ERC721 <> ERC20 orders', () => {
    const ERC721ForERC20 = async (
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
      } = options;

      await mockERC721.connect(maker).setApprovalForAll(bobProxy, true);
      await mockERC20.connect(taker).approve(aliceProxy, erc20MintAmount);
      await mockERC721['mint(address,uint256)'](maker.address, tokenId);
      await mockERC20.mint(taker.address, erc20MintAmount);

      if (buyTokenId)
        await mockERC721['mint(address,uint256)'](maker.address, buyTokenId);

      const sellData = await placeAsk<'ERC721'>({
        maker,
        tokenType: 'ERC721',
        tokenAddress: mockERC721.address,
        tokenId,
        erc20Address: mockERC20.address,
        erc20SellPrice: sellingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: undefined,
      });
      const buyData = await placeBid<'ERC721'>({
        taker,
        tokenType: 'ERC721',
        tokenAddress: mockERC721.address,
        tokenId: buyTokenId ?? tokenId,
        erc20Address: mockERC20.address,
        erc20BuyPrice: buyingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: undefined,
      });

      await matchOrders({
        sender: taker,
        tokenType: 'ERC721',
        sellOrder: sellData.order,
        sellSig: sellData.signature,
        buyOrder: buyData.order,
        buySig: buyData.signature,
        buyAmount: 1,
      });
      const makerERC20Balance = await mockERC20.balanceOf(maker.address);
      const tokenOwner = await mockERC721.ownerOf(tokenId);
      expect(makerERC20Balance.toNumber()).to.eq(sellingPrice);
      expect(tokenOwner).to.eq(taker.address);
    };

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

      await mockERC721.connect(maker).setApprovalForAll(bobProxy, true);
      await mockERC20.connect(taker).approve(aliceProxy, erc20MintAmount);
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
      await tx.wait();

      expect(await mockERC20.balanceOf(maker.address)).to.eq(sellerAmount);
      expect(await mockERC20.balanceOf(feeCollector.address)).to.eq(
        protocolFeesAmount
      );
      expect(await mockERC20.balanceOf(creator)).to.eq(royaltiesFeesAmount);
      expect(await mockERC721.ownerOf(tokenId)).to.eq(taker.address);
    };

    it('StaticMarket: matches ERC721 <> ERC20 order', async () => {
      const price = BigNumber.from(15000);

      return ERC721ForERC20({
        tokenId: 10,
        sellingPrice: price,
        buyingPrice: price,
        erc20MintAmount: price,
        maker: bob,
        taker: alice,
        sender,
      });
    });

    it('StaticMarket: does not fill ERC721 <> ERC20 order with different prices', async () => {
      const price = BigNumber.from(15000);
      // note: this will also reject on-chain
      await expect(
        ERC721ForERC20({
          tokenId: 10,
          sellingPrice: price,
          buyingPrice: price.sub(1),
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender,
        })
      ).to.be.rejectedWith("ERC20 buying prices don't match on orders");
    });

    it('StaticMarket: does not fill ERC721 <> ERC20 order if the balance is insufficient', async () => {
      const price = BigNumber.from(15000);

      await expect(
        ERC721ForERC20({
          tokenId: 10,
          sellingPrice: price,
          buyingPrice: price,
          erc20MintAmount: price.sub(1),
          maker: bob,
          taker: alice,
          sender,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SecondCallFailed');
    });

    it('StaticMarket: does not fill ERC721 <> ERC20 order if the token IDs are different', async () => {
      const price = BigNumber.from(15000);
      // note: this will also reject on-chain
      await expect(
        ERC721ForERC20({
          tokenId: 10,
          buyTokenId: 11,
          sellingPrice: price,
          buyingPrice: price,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          sender,
        })
      ).to.be.rejectedWith("ERC721 token IDs don't match on orders");
    });

    it('StaticMarket: matches ERC721 <> ERC20 order only royalties', async () => {
      const price = BigNumber.from(15000);

      await marketplace.changeProtocolFee(0);

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
          pFee: 0,
        },
        royalties: {
          creator: creator.address,
          feebps: 1000,
        },
      });
    });

    it('StaticMarket: matches ERC721 <> ERC20 order with only protocol fees', async () => {
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
          feebps: 0,
        },
      });
    });

    it('StaticMarket: matches ERC721 <> ERC20 order with royalties and fees', async () => {
      const price = BigNumber.from(15000);

      // @note added to reset protocol fees
      await marketplace.changeProtocolFee(500);

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
          feebps: 1000,
        },
      });
    });
  });

  context('Lazy ERC721 <> ERC20 orders', () => {
    const ERC721ForERC20 = async (
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
        extraBytes = [],
      } = options;

      await mockERC20.connect(taker).approve(aliceProxy, erc20MintAmount);
      await mockERC20.mint(taker.address, erc20MintAmount);
      await mockERC721.connect(maker).setApprovalForAll(bobProxy, true);

      if (buyTokenId)
        await mockERC721['mint(address,uint256)'](maker.address, buyTokenId);

      const sellData = await placeAsk<'LazyERC721'>({
        maker,
        tokenType: 'LazyERC721',
        tokenAddress: mockERC721.address,
        tokenId,
        erc20Address: mockERC20.address,
        erc20SellPrice: sellingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: { extraBytes },
      });
      const buyData = await placeBid<'LazyERC721'>({
        taker,
        tokenType: 'LazyERC721',
        tokenAddress: mockERC721.address,
        tokenId: buyTokenId ?? tokenId,
        erc20Address: mockERC20.address,
        erc20BuyPrice: buyingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: { extraBytes },
      });

      await matchOrders({
        sender: maker,
        tokenType: 'LazyERC721',
        sellOrder: sellData.order,
        sellSig: sellData.signature,
        buyOrder: buyData.order,
        buySig: buyData.signature,
        buyAmount: 1,
      });
      const makerERC20Balance = await mockERC20.balanceOf(maker.address);
      const tokenOwner = await mockERC721.ownerOf(tokenId);
      expect(makerERC20Balance.toNumber()).to.eq(sellingPrice);
      expect(tokenOwner).to.eq(taker.address);
    };

    it('StaticMarket: matches ERC721 <> ERC20 order', async () => {
      const price = BigNumber.from(15000);

      return ERC721ForERC20({
        tokenId: validTokenID(bob),
        sellingPrice: price,
        buyingPrice: price,
        erc20MintAmount: price,
        maker: bob,
        taker: alice,
        extraBytes: '0x',
        sender,
      });
    });

    it('StaticMarket: does not fill ERC721 <> ERC20 order with different prices', async () => {
      const price = BigNumber.from(15000);
      // note: this will also reject on-chain
      await expect(
        ERC721ForERC20({
          tokenId: validTokenID(bob),
          sellingPrice: price,
          buyingPrice: price.sub(1),
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          extraBytes: '0x',
          sender,
        })
      ).to.be.rejectedWith("ERC20 buying prices don't match on orders");
    });

    it('StaticMarket: does not fill ERC721 <> ERC20 order if the balance is insufficient', async () => {
      const price = BigNumber.from(15000);

      await expect(
        ERC721ForERC20({
          tokenId: validTokenID(bob),
          sellingPrice: price,
          buyingPrice: price,
          erc20MintAmount: price.sub(1),
          maker: bob,
          taker: alice,
          extraBytes: '0x',
          sender,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SecondCallFailed');
    });

    it('StaticMarket: does not fill ERC721 <> ERC20 order if the token IDs are different', async () => {
      const price = BigNumber.from(15000);
      // note: this will also reject on-chain
      await expect(
        ERC721ForERC20({
          tokenId: validTokenID(bob),
          buyTokenId: 11,
          sellingPrice: price,
          buyingPrice: price,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          extraBytes: '0x',
          sender,
        })
      ).to.be.rejectedWith("ERC721 token IDs don't match on orders");
    });

    it('throws if tokenId does not match maker', async () => {
      const price = BigNumber.from(15000);

      await expect(
        ERC721ForERC20({
          tokenId: 0,
          sellingPrice: price,
          buyingPrice: price,
          erc20MintAmount: price,
          maker: bob,
          taker: alice,
          extraBytes: '0x',
          sender,
        })
      ).to.be.revertedWithCustomError(marketplace, 'FirstCallFailed');
    });
  });

  context('ERC20 <> ERC20 orders', () => {
    const anyERC20ForERC20 = async (
      options: AdvancedMatchingOptions['ERC20']
    ) => {
      const {
        sellAmount,
        sellingPrice,
        buyingPrice,
        buyPriceOffset,
        buyAmount,
        erc20MintAmountSeller,
        erc20MintAmountBuyer,
        maker,
        taker,
        sender,
        txCount = 1,
      } = options;

      const takerPriceOffset = buyPriceOffset ?? 0;

      const tokenA = mockERC20;
      const { mockERC20: tokenB } = await unseenFixture(owner);

      await tokenA.connect(maker).approve(bobProxy, erc20MintAmountSeller);
      await tokenB.connect(taker).approve(aliceProxy, erc20MintAmountBuyer);
      await tokenA.mint(maker.address, erc20MintAmountSeller);
      await tokenB.mint(taker.address, erc20MintAmountBuyer);

      const { order: sellOrder, signature: sellSig } = await offerERC20ForERC20(
        {
          maker,
          executer: maker.address,
          erc20SellerAddress: tokenA.address,
          sellingPrice,
          sellAmount,
          erc20BuyerAddress: tokenB.address,
          buyingPrice,
          expirationTime: BigNumber.from(0),
        }
      );

      for (let i = 0; i < txCount; ++i) {
        const { order: buyOrder, signature: buySig } = await offerERC20ForERC20(
          {
            maker: taker,
            executer: taker.address,
            erc20BuyerAddress: tokenA.address,
            buyingPrice: sellingPrice,
            sellAmount: sellingPrice.mul(txCount).mul(buyAmount),
            erc20SellerAddress: tokenB.address,
            sellingPrice: buyingPrice.add(takerPriceOffset),
            expirationTime: BigNumber.from(0),
          }
        );
        await matchERC20ForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount,
        });
        buyOrder.extraData = buyOrder.extraData.slice(0, -32) + randomHex(16);
      }

      const makerERC20Balance = await tokenB.balanceOf(maker.address);
      const takerERC20Balance = await tokenA.balanceOf(taker.address);
      expect(makerERC20Balance.toNumber()).to.eq(
        sellingPrice.mul(buyAmount).mul(txCount)
      );
      expect(takerERC20Balance.toNumber()).to.eq(buyAmount * txCount);
    };

    it('StaticMarket: matches ERC20 <> ERC20 order, 1 fill', async () => {
      const price = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(1);

      return anyERC20ForERC20({
        sellAmount: 1,
        sellingPrice: price,
        buyingPrice,
        buyAmount: 1,
        erc20MintAmountSeller: 1,
        erc20MintAmountBuyer: price,
        maker: bob,
        taker: alice,
        sender,
      });
    });

    it('StaticMarket: matches ERC20 <> ERC20 order, multiple fills in 1 transaction', async () => {
      const amount = 3;
      const price = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(1);

      return anyERC20ForERC20({
        sellAmount: amount,
        sellingPrice: price,
        buyingPrice,
        buyAmount: amount,
        erc20MintAmountSeller: amount,
        erc20MintAmountBuyer: price.mul(amount),
        maker: bob,
        taker: alice,
        sender,
      });
    });

    it('StaticMarket: matches ERC20 <> ERC20 order, multiple fills in multiple txCount', async () => {
      const sellAmount = 3;
      const buyAmount = 1;
      const price = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(1);
      const txCount = 3;

      return anyERC20ForERC20({
        sellAmount,
        sellingPrice: price,
        buyingPrice,
        buyAmount,
        erc20MintAmountSeller: sellAmount,
        erc20MintAmountBuyer: price.mul(buyAmount).mul(txCount),
        maker: bob,
        taker: alice,
        sender,
        txCount,
      });
    });

    it('StaticMarket: matches ERC20 <> ERC20 order, allows any partial fill', async () => {
      const sellAmount = 30;
      const buyAmount = 4;
      const price = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(1);

      return anyERC20ForERC20({
        sellAmount,
        sellingPrice: price,
        buyingPrice,
        buyAmount,
        erc20MintAmountSeller: sellAmount,
        erc20MintAmountBuyer: price.mul(buyAmount),
        maker: bob,
        taker: alice,
        sender,
      });
    });

    it('StaticMarket: does not fill ERC20 <> ERC20 order with different taker price', async () => {
      const price = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(1);

      await expect(
        anyERC20ForERC20({
          sellAmount: 1,
          sellingPrice: price,
          buyingPrice,
          buyPriceOffset: 1,
          buyAmount: 1,
          erc20MintAmountSeller: 2,
          erc20MintAmountBuyer: price,
          maker: bob,
          taker: alice,
          sender,
        })
      ).to.be.rejectedWith("ERC20 buying prices don't match on orders");
    });

    it('StaticMarket: does not fill ERC20 <> ERC20 order if balance is insufficient', async () => {
      const sellAmount = 1;
      const buyAmount = 1;
      const price = BigNumber.from(10000);
      const buyingPrice = BigNumber.from(1);

      await expect(
        anyERC20ForERC20({
          sellAmount,
          sellingPrice: price,
          buyingPrice,
          buyAmount,
          erc20MintAmountSeller: sellAmount,
          erc20MintAmountBuyer: price.mul(buyAmount).sub(1),
          maker: bob,
          taker: alice,
          sender,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SecondCallFailed');
    });
  });

  context('NFT <> NFT orders', () => {
    const anyNFTNFT = async (options: AdvancedMatchingOptions['NFT']) => {
      const {
        tokenGive,
        tokenGiveType,
        tokenGiveAmount = 1,
        tokenGet,
        tokenGetType,
        tokenGetAmount = 1,
        maker,
        taker,
      } = options;

      if (tokenGiveType == 'ERC1155') {
        await mockERC1155.connect(maker).setApprovalForAll(bobProxy, true);
        await mockERC1155['mint(address,uint256,uint256)'](
          maker.address,
          tokenGive,
          tokenGiveAmount
        );
      } else {
        await mockERC721.connect(maker).setApprovalForAll(bobProxy, true);
        await mockERC721['mint(address,uint256)'](maker.address, tokenGive);
      }
      if (tokenGetType == 'ERC1155') {
        await mockERC1155.connect(taker).setApprovalForAll(aliceProxy, true);
        await mockERC1155['mint(address,uint256,uint256)'](
          taker.address,
          tokenGet,
          tokenGetAmount
        );
      } else {
        await mockERC721.connect(taker).setApprovalForAll(aliceProxy, true);
        await mockERC721['mint(address,uint256)'](taker.address, tokenGet);
      }

      const { order: sellOrder, signature: sellSig } = await offerNFTForNFT({
        maker,
        executer: maker.address,
        offeringTokenType: tokenGiveType,
        offeringToken:
          tokenGiveType == 'ERC721' ? mockERC721.address : mockERC1155.address,
        offeringTokenId: tokenGive,
        offeringTokenAmount: tokenGiveAmount,
        askingTokenType: tokenGetType,
        askingToken:
          tokenGetType == 'ERC721' ? mockERC721.address : mockERC1155.address,
        askingTokenId: tokenGet,
        askingTokenAmount: tokenGetAmount,
        expirationTime: BigNumber.from(0),
      });

      const { order: buyOrder, signature: buySig } = await offerNFTForNFT({
        maker: taker,
        executer: taker.address,
        offeringTokenType: tokenGetType,
        offeringToken:
          tokenGetType == 'ERC721' ? mockERC721.address : mockERC1155.address,
        offeringTokenId: tokenGet,
        offeringTokenAmount: tokenGetAmount,
        askingTokenType: tokenGiveType,
        askingToken:
          tokenGiveType == 'ERC721' ? mockERC721.address : mockERC1155.address,
        askingTokenId: tokenGive,
        askingTokenAmount: tokenGiveAmount,
        expirationTime: BigNumber.from(0),
      });

      const tx = await matchNFTForNFT({
        sender: taker,
        sellOrder,
        sellSig,
        buyOrder,
        buySig,
      });

      await tx.wait();

      tokenGiveType == 'ERC721'
        ? expect(await mockERC721.ownerOf(tokenGive)).to.eq(taker.address)
        : expect(await mockERC1155.balanceOf(taker.address, tokenGive)).to.eq(
            2
          );
      tokenGetType == 'ERC1155'
        ? expect(await mockERC1155.balanceOf(maker.address, tokenGet)).to.eq(2)
        : expect(await mockERC721.ownerOf(tokenGet)).to.eq(maker.address);
    };

    it('StaticMarket: fills NFT <> NFT ERC721-ERC1155 order', async () => {
      return anyNFTNFT({
        tokenGive: 4,
        tokenGiveType: 'ERC721',
        tokenGiveAmount: 1,
        tokenGet: 5,
        tokenGetType: 'ERC1155',
        tokenGetAmount: 2,
        maker: bob,
        taker: alice,
      });
    });

    it('StaticMarket: fills NFT <> NFT ERC1155-ERC1155 order', async () => {
      return anyNFTNFT({
        tokenGive: 4,
        tokenGiveType: 'ERC1155',
        tokenGiveAmount: 2,
        tokenGet: 5,
        tokenGetType: 'ERC1155',
        tokenGetAmount: 2,
        maker: bob,
        taker: alice,
      });
    });

    it('StaticMarket: fills NFT <> NFT ERC721-ERC721 order', async () => {
      return anyNFTNFT({
        tokenGive: 4,
        tokenGiveType: 'ERC721',
        tokenGiveAmount: 1,
        tokenGet: 5,
        tokenGetType: 'ERC721',
        tokenGetAmount: 1,
        maker: bob,
        taker: alice,
      });
    });

    it('StaticMarket: fills NFT <> NFT ERC1155-ERC721 order', async () => {
      return anyNFTNFT({
        tokenGive: 4,
        tokenGiveType: 'ERC1155',
        tokenGiveAmount: 2,
        tokenGet: 5,
        tokenGetType: 'ERC721',
        tokenGetAmount: 1,
        maker: bob,
        taker: alice,
      });
    });
  });

  context('CancelOrder', () => {
    const sellingPrice = 1000000;
    const sellAmount = 5;

    it('sets the correct fill of an ERC20 order', async () => {
      const { order } = await placeBid({
        taker: bob,
        tokenType: 'ERC721',
        tokenAddress: mockERC721.address,
        tokenId: 0,
        erc20Address: mockERC20.address,
        erc20BuyPrice: sellingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: undefined,
      });
      await cancelOrder({ maker: bob, orderParams: order });
      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: order,
      });

      expect(await marketplace.fills(bob.address, orderHash)).to.eq(
        sellingPrice
      );
    });

    it('sets the correct fill of an ERC721 order', async () => {
      const { order } = await placeAsk<'ERC721'>({
        maker: bob,
        tokenType: 'ERC721',
        tokenAddress: mockERC721.address,
        tokenId: 0,
        erc20Address: mockERC20.address,
        erc20SellPrice: sellingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: undefined,
      });
      await cancelOrder({ maker: bob, orderParams: order });
      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: order,
      });

      expect(await marketplace.fills(bob.address, orderHash)).to.eq(1);
    });

    it('sets the correct fill of an ERC1155 order', async () => {
      const { order } = await placeAsk<'ERC1155'>({
        maker: bob,
        tokenType: 'ERC1155',
        tokenAddress: mockERC1155.address,
        tokenId: 0,
        erc20Address: mockERC20.address,
        erc20SellPrice: sellingPrice,
        expirationTime: BigNumber.from(0),
        optionalParams: {
          erc1155Amount: sellAmount,
          erc1155ratio: 1,
        },
      });
      await cancelOrder({ maker: bob, orderParams: order });
      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: order,
      });

      expect(await marketplace.fills(bob.address, orderHash)).to.eq(sellAmount);
    });
  });
});
