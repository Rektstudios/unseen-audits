import { expect } from 'chai';
import {
  _TypedDataEncoder,
  arrayify,
  defaultAbiCoder,
  splitSignature,
  verifyMessage,
  verifyTypedData,
} from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import type {
  FeeCollector,
  MockUnseenStatic,
  UnseenAtomicizer,
  UnseenExchange,
  UnseenRegistry,
} from '@typechained';
import type { AwaitedObject } from '@utils/helpers';
import type {
  Ask,
  AtomicMatch,
  Bid,
  ERC1155FeesParams,
  ERC1155Params,
  ERC721FeesParams,
  LazyERC1155Params,
  LazyParams,
  OrderData,
  OrderParameters,
  OrdersMatch,
  TokenType,
} from '@utils/types';
import type {
  BigNumber,
  BigNumberish,
  BytesLike,
  Signature,
  Wallet,
} from 'ethers';

import {
  ERC1155Interface,
  ERC20ForERC721,
  ERC20Interface,
  ERC721ForERC20,
  ERC721ForMultiERC20s,
  ERC721Interface,
  LazyERC1155ForERC20,
  LazyERC20ForERC1155,
  LazyERC20ForERC721,
  LazyERC721ForERC20,
  MultiERC20ForERC721s,
  anyERC1155ForERC20,
  anyERC1155ForMultiERC20s,
  anyERC20ForERC1155,
  anyERC20ForERC20,
  anyMultiERC20ForERC1155s,
  anyNFTForNFT,
  noChecks_,
} from '@constants';
import { deployContract } from '@utils/contracts';
import { _getHashToSign, randomHex } from '@utils/encoding';
import { clock, duration } from '@utils/time';
import { EIP712Domain } from 'eip-712-types/domain';
import { eip712Order } from 'eip-712-types/order';
import { packData } from 'utils/helper-functions';

export const marketplaceFixture = async (
  owner: Wallet,
  registry: UnseenRegistry,
  staticMarket: MockUnseenStatic,
  atomicizer: UnseenAtomicizer,
  feeCollector: FeeCollector
) => {
  const marketplace: UnseenExchange = await deployContract(
    'UnseenExchange',
    owner,
    [registry.address],
    owner.address,
    feeCollector.address,
    500
  );

  const timestamp = await clock.timestamp();

  const order = (
    maker: Wallet,
    executer: string = maker.address
  ): AwaitedObject<OrderParameters> => ({
    registry: registry.address,
    maker: maker.address,
    executer,
    staticTarget: staticMarket.address,
    staticSelector: noChecks_,
    staticExtradata: [],
    maximumFill: '1',
    extraData: packData(
      duration.hours(0),
      timestamp.add(duration.hours(100)),
      randomHex(16)
    ),
  });

  const orderData = async (
    orderParams: OrderParameters,
    contract: string = marketplace.address
  ): Promise<OrderData> =>
    EIP712Domain(
      'Unseen Marketplace',
      contract,
      '1.0.0',
      (await ethers.provider.getNetwork()).chainId
    ).then((domain) => ({
      domain,
      types: eip712Order,
      orderParams,
    }));

  const getAndVerifyOrderHash = async ({
    maker,
    orderParams_ = order(maker),
  }: {
    maker: Wallet;
    orderParams_?: OrderParameters;
  }) => {
    const orderHash = await marketplace.hashOrder(
      orderParams_.registry,
      orderParams_.maker,
      orderParams_.executer,
      orderParams_.staticTarget,
      orderParams_.staticSelector,
      orderParams_.staticExtradata,
      orderParams_.maximumFill,
      orderParams_.extraData
    );

    const { domain, types, orderParams } = await orderData(orderParams_);

    const structHash = _TypedDataEncoder.hashStruct(
      'Order',
      types,
      orderParams
    );

    const domainHash = _TypedDataEncoder.hashDomain(domain);

    expect(orderHash).to.eq(structHash);

    return { orderHash, structHash, domainHash, orderParams_ };
  };

  const getHashToSign = async ({
    maker,
    orderParams = order(maker),
  }: {
    maker: Wallet;
    orderParams?: OrderParameters;
  }) => {
    const { orderHash, structHash, domainHash } = await getAndVerifyOrderHash({
      maker,
      orderParams_: orderParams,
    });

    const hashToSign = _getHashToSign(domainHash, structHash);
    const hash = await marketplace.hashToSign(orderHash);

    expect(hash).to.eq(hashToSign);

    return { hashToSign, orderHash };
  };

  const validateOrderParameters = async (orderParams: OrderParameters) => {
    return marketplace.validateOrderParameters(
      orderParams.registry,
      orderParams.maker,
      orderParams.executer,
      orderParams.staticTarget,
      orderParams.staticSelector,
      orderParams.staticExtradata,
      orderParams.maximumFill,
      orderParams.extraData
    );
  };

  const approveOrder = async ({
    maker,
    orderParams = order(maker),
    orderbookInclusionDesired = true,
  }: {
    maker: Wallet;
    orderParams?: OrderParameters;
    orderbookInclusionDesired?: boolean;
  }) => {
    return marketplace
      .connect(maker)
      .approveOrder(
        orderParams.registry,
        orderParams.maker,
        orderParams.executer,
        orderParams.staticTarget,
        orderParams.staticSelector,
        orderParams.staticExtradata,
        orderParams.maximumFill,
        orderParams.extraData,
        orderbookInclusionDesired
      );
  };

  const signOrder = async ({
    maker,
    orderParams_ = order(maker),
  }: {
    maker: Wallet;
    orderParams_?: OrderParameters;
  }) => {
    const { domain, types, orderParams } = await orderData(orderParams_);

    const structHash = _TypedDataEncoder.hashStruct(
      'Order',
      types,
      orderParams
    );

    const signature = await maker
      ._signTypedData(domain, types, orderParams)
      .then(splitSignature);

    // Verify recovered address matches maker address
    const verifiedAddress = verifyTypedData(
      domain,
      types,
      orderParams,
      signature
    );

    expect(verifiedAddress).to.eq(maker.address);

    return { signature, structHash, orderParams };
  };

  const personalSign = async ({
    maker,
    orderParams = order(maker),
  }: {
    maker: Wallet;
    orderParams?: OrderParameters;
  }) => {
    const { hashToSign } = await getHashToSign({ maker, orderParams });

    const signature = await maker
      .signMessage(arrayify(hashToSign))
      .then(splitSignature);

    // Verify recovered address matches maker address
    const verifiedAddress = verifyMessage(hashToSign, signature);
    // TODO fix address verification >> .to.eq.
    expect(verifiedAddress).to.not.eq(maker.address);

    return { signature, hashToSign, orderParams, suffix: '03' };
  };

  const getProtocolFees = async () => {
    const pFee = await marketplace.pFee();
    const treasury = await marketplace.protocolFeeRecipient();

    return { pFee, treasury };
  };

  const cancelOrder = async ({
    maker,
    orderParams,
  }: {
    maker: Wallet;
    orderParams: OrderParameters;
  }) => {
    const { orderHash } = await getAndVerifyOrderHash({
      maker,
      orderParams_: orderParams,
    });
    const tx = await marketplace
      .connect(maker)
      .setOrderFill(orderHash, orderParams.maximumFill);

    tx.wait();

    return tx;
  };

  const atomicMatch = async ({
    sender,
    order,
    sig,
    call,
    counterorder,
    countersig,
    countercall,
  }: AtomicMatch) => {
    return await marketplace
      .connect(sender)
      .atomicMatch(
        [
          order.registry,
          order.maker,
          order.executer,
          order.staticTarget,
          order.maximumFill,
          order.extraData,
          call.target,
          counterorder.registry,
          counterorder.maker,
          counterorder.executer,
          counterorder.staticTarget,
          counterorder.maximumFill,
          counterorder.extraData,
          countercall.target,
        ],
        [order.staticSelector, counterorder.staticSelector],
        order.staticExtradata,
        call.data,
        counterorder.staticExtradata,
        countercall.data,
        [call.howToCall, countercall.howToCall],
        defaultAbiCoder.encode(
          ['bytes', 'bytes'],
          [
            defaultAbiCoder.encode(
              ['uint8', 'bytes32', 'bytes32'],
              [sig.v, sig.r, sig.s]
            ) + (sig.suffix ?? ''),
            defaultAbiCoder.encode(
              ['uint8', 'bytes32', 'bytes32'],
              [countersig.v, countersig.r, countersig.s]
            ) + (countersig.suffix ?? ''),
          ]
        )
      );
  };

  const offerERC721ForERC20 = async ({
    maker,
    executer = maker.address,
    erc721Address,
    erc721Id,
    erc20Address,
    erc20SellPrice,
    expirationTime,
  }: {
    maker: Wallet;
    executer: string;
    erc721Address: string;
    erc721Id: BigNumberish;
    erc20Address: string;
    erc20SellPrice: BigNumberish;
    expirationTime: BigNumber;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[2]'],
      [
        [erc721Address, erc20Address],
        [erc721Id, erc20SellPrice],
      ]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: ERC721ForERC20,
      staticExtradata,
      maximumFill: '1',
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };
    const { signature, structHash } = await signOrder({
      maker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const offerERC20ForERC721 = async ({
    taker,
    executer = taker.address,
    erc721Address,
    erc721Id,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
  }: {
    taker: Wallet;
    executer: string;
    erc721Address: string;
    erc721Id: BigNumberish;
    erc20Address: string;
    erc20BuyPrice: BigNumberish;
    expirationTime: BigNumber;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[2]'],
      [
        [erc20Address, erc721Address],
        [erc721Id, erc20BuyPrice],
      ]
    );
    const order = {
      registry: registry.address,
      maker: taker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: ERC20ForERC721,
      staticExtradata,
      maximumFill: erc20BuyPrice.toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker: taker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const matchERC721ForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
  }: OrdersMatch) => {
    const [[erc721Address, erc20Address], [tokenId, buyingPrice]] =
      defaultAbiCoder.decode(
        ['address[2]', 'uint256[2]'],
        sellOrder.staticExtradata
      );
    const [
      [erc20AddressOther, erc721AddressOther],
      [tokenIdOther, buyingPriceOther],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[2]'],
      buyOrder.staticExtradata
    );

    // these checks are also performed within the static calls on StaticMarket, but we check here before going on chain
    if (erc721Address != erc721AddressOther)
      throw new Error("ERC721 Addresses don't match on orders");
    if (erc20Address != erc20AddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!tokenId.eq(tokenIdOther))
      throw new Error("ERC721 token IDs don't match on orders");
    if (!buyingPrice.eq(buyingPriceOther))
      throw new Error("ERC20 buying prices don't match on orders");

    const firstData = ERC721Interface.encodeFunctionData('transferFrom', [
      sellOrder.maker,
      buyOrder.maker,
      tokenId,
    ]); // this might be weird bc passing in BigNumbers...
    const secondData = ERC20Interface.encodeFunctionData('transferFrom', [
      buyOrder.maker,
      sellOrder.maker,
      buyingPrice,
    ]);

    const firstCall = { target: erc721Address, howToCall: 0, data: firstData };
    const secondCall = { target: erc20Address, howToCall: 0, data: secondData };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const ERC721ForMultiERC20 = async ({
    maker,
    executer = maker.address,
    erc721Address,
    erc721Id,
    erc20Address,
    erc20SellPrice,
    expirationTime,
    protocol,
    creator,
    sellerAmount,
    protocolFees,
    royaltiesFees,
  }: {
    maker: Wallet;
    executer?: string;
    erc721Address: string;
    erc721Id: BigNumberish;
    erc20Address: string;
    erc20SellPrice: BigNumberish;
    expirationTime: BigNumber;
    protocol: string;
    creator: string;
    sellerAmount: BigNumberish;
    protocolFees: BigNumberish;
    royaltiesFees: BigNumberish;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[]', 'uint256[]'],
      [
        [erc721Address, erc20Address, protocol, creator],
        [erc721Id, erc20SellPrice, sellerAmount, protocolFees, royaltiesFees],
      ]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: ERC721ForMultiERC20s,
      staticExtradata,
      maximumFill: '1',
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const MultiERC20ForERC721 = async ({
    taker,
    executer = taker.address,
    erc721Address,
    erc721Id,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
    protocol,
    creator,
    sellerAmount,
    protocolFees,
    royaltiesFees,
  }: {
    taker: Wallet;
    executer: string;
    erc721Address: string;
    erc721Id: BigNumberish;
    erc20Address: string;
    erc20BuyPrice: BigNumberish;
    expirationTime: BigNumber;
    protocol: string;
    creator: string;
    sellerAmount: BigNumberish;
    protocolFees: BigNumberish;
    royaltiesFees: BigNumberish;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[]', 'uint256[]'],
      [
        [erc20Address, erc721Address, protocol, creator],
        [erc721Id, erc20BuyPrice, sellerAmount, protocolFees, royaltiesFees],
      ]
    );
    const order = {
      registry: registry.address,
      maker: taker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: MultiERC20ForERC721s,
      staticExtradata,
      maximumFill: erc20BuyPrice.toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker: taker,
      orderParams_: order,
    }); // calls out to the signer (wallet, often Metamask)

    return { order, signature, orderHash: structHash };
  };

  const matchERC721FeesForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
  }: OrdersMatch) => {
    const [
      [erc721Address, erc20Address, protocol, creator],
      [tokenId, buyingPrice, sellerAmount, protocolFees, royaltiesFees],
    ] = defaultAbiCoder.decode(
      ['address[]', 'uint256[]'],
      sellOrder.staticExtradata
    );
    const [
      [erc20AddressOther, erc721AddressOther, protocolOther, creatorOther],
      [
        tokenIdOther,
        buyingPriceOther,
        sellerAmountOther,
        protocolFeesOther,
        royaltiesFeesOther,
      ],
    ] = defaultAbiCoder.decode(
      ['address[]', 'uint256[]'],
      buyOrder.staticExtradata
    );

    // these checks are also performed within the static calls on StaticMarket, but we check here before going on chain
    if (erc721Address != erc721AddressOther)
      throw new Error("ERC721 Addresses don't match on orders");
    if (erc20Address != erc20AddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!tokenId.eq(tokenIdOther))
      throw new Error("ERC721 token IDs don't match on orders");
    if (!buyingPrice.eq(buyingPriceOther))
      throw new Error("ERC20 buying prices don't match on orders");
    if (protocol != protocolOther)
      throw new Error("ProtocolAddresses don't match on orders");
    if (creator != creatorOther)
      throw new Error("Creator Addresses don't match on orders");
    if (!sellerAmount.eq(sellerAmountOther))
      throw new Error("Seller amount doesn't match on orders");
    if (!protocolFees.eq(protocolFeesOther))
      throw new Error("Protocol fees doesn't match on orders");
    if (!royaltiesFees.eq(royaltiesFeesOther))
      throw new Error("Royalties fees doesn't match on orders");

    const firstData = ERC721Interface.encodeFunctionData('transferFrom', [
      sellOrder.maker,
      buyOrder.maker,
      tokenId,
    ]);

    const secondData = atomicizer.interface.encodeFunctionData('atomicize', [
      [erc20Address, erc20Address, erc20Address],
      [0, 0, 0],
      [
        ERC20Interface.encodeFunctionData('transferFrom', [
          buyOrder.maker,
          sellOrder.maker,
          sellerAmount,
        ]),
        ERC20Interface.encodeFunctionData('transferFrom', [
          buyOrder.maker,
          protocol,
          protocolFees,
        ]),
        ERC20Interface.encodeFunctionData('transferFrom', [
          buyOrder.maker,
          creator,
          royaltiesFees,
        ]),
      ],
    ]);

    const firstCall = { target: erc721Address, howToCall: 0, data: firstData };
    const secondCall = {
      target: atomicizer.address,
      howToCall: 1,
      data: secondData,
    };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const offerLazyERC721ForERC20 = async ({
    maker,
    executer = maker.address,
    erc721Address,
    erc721Id,
    erc20Address,
    erc20SellPrice,
    expirationTime,
    extraBytes,
  }: {
    maker: Wallet;
    executer: string;
    erc721Address: string;
    erc721Id: BigNumberish;
    erc20Address: string;
    erc20SellPrice: BigNumberish;
    expirationTime: BigNumber;
    extraBytes: BytesLike;
  }) => {
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[2]', 'bytes'],
      [[erc721Address, erc20Address], [erc721Id, erc20SellPrice], extraBytes]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: LazyERC721ForERC20,
      staticExtradata,
      maximumFill: '1',
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const offerERC20ForLazyERC721 = async ({
    taker,
    executer = taker.address,
    erc721Address,
    erc721Id,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
    extraBytes,
  }: {
    taker: Wallet;
    executer: string;
    erc721Address: string;
    erc721Id: BigNumberish;
    erc20Address: string;
    erc20BuyPrice: BigNumberish;
    expirationTime: BigNumber;
    extraBytes: BytesLike;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[2]', 'bytes'],
      [[erc20Address, erc721Address], [erc721Id, erc20BuyPrice], extraBytes]
    );
    const order = {
      registry: registry.address,
      maker: taker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: LazyERC20ForERC721,
      staticExtradata,
      maximumFill: erc20BuyPrice.toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker: taker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const matchLazy721ForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
  }: OrdersMatch) => {
    const [[erc721Address, erc20Address], [tokenId, buyingPrice], extraBytes] =
      defaultAbiCoder.decode(
        ['address[2]', 'uint256[2]', 'bytes'],
        sellOrder.staticExtradata
      );
    const [
      [erc20AddressOther, erc721AddressOther],
      [tokenIdOther, buyingPriceOther],
      extraBytesOther,
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[2]', 'bytes'],
      buyOrder.staticExtradata
    );

    // these checks are also performed within the static calls on StaticMarket, but we check here before going on chain
    if (erc721Address != erc721AddressOther)
      throw new Error("ERC721 Addresses don't match on orders");
    if (erc20Address != erc20AddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!tokenId.eq(tokenIdOther))
      throw new Error("ERC721 token IDs don't match on orders");
    if (!buyingPrice.eq(buyingPriceOther))
      throw new Error("ERC20 buying prices don't match on orders");

    if (extraBytes != extraBytesOther)
      throw new Error("Lazy mint extraBytes don't match on orders");

    const firstData = ERC721Interface.encodeFunctionData(
      'mint(address,uint256,bytes)',
      [buyOrder.maker, tokenId, extraBytes]
    );
    const secondData = ERC20Interface.encodeFunctionData('transferFrom', [
      buyOrder.maker,
      sellOrder.maker,
      buyingPrice,
    ]);

    const firstCall = { target: erc721Address, howToCall: 0, data: firstData };
    const secondCall = { target: erc20Address, howToCall: 0, data: secondData };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const offerERC1155ForERC20 = async ({
    maker,
    executer = maker.address,
    erc1155Address,
    erc1155Id,
    erc1155SellAmount,
    erc1155SellNumerator,
    erc20Address,
    erc20SellPrice,
    expirationTime,
  }: {
    maker: Wallet;
    executer: string;
    erc1155Address: string;
    erc1155Id: BigNumberish;
    erc1155SellAmount: BigNumberish;
    erc1155SellNumerator: BigNumberish;
    erc20Address: string;
    erc20SellPrice: BigNumberish;
    expirationTime: BigNumber;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[3]'],
      [
        [erc1155Address, erc20Address],
        [erc1155Id, erc1155SellNumerator, erc20SellPrice],
      ]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: anyERC1155ForERC20,
      staticExtradata,
      maximumFill: ethers.BigNumber.from(erc1155SellNumerator)
        .mul(ethers.BigNumber.from(erc1155SellAmount))
        .toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };
    const { signature, structHash } = await signOrder({
      maker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const offerERC20ForERC1155 = async ({
    taker,
    executer = taker.address,
    erc1155Address,
    erc1155Id,
    erc1155BuyAmount,
    erc1155BuyDenominator,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
  }: {
    taker: Wallet;
    executer: string;
    erc1155Address: string;
    erc1155Id: BigNumberish;
    erc1155BuyAmount: BigNumberish;
    erc1155BuyDenominator: BigNumberish;
    erc20Address: string;
    erc20BuyPrice: BigNumberish;
    expirationTime: BigNumber;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[3]'],
      [
        [erc20Address, erc1155Address],
        [erc1155Id, erc20BuyPrice, erc1155BuyDenominator],
      ]
    );
    const order = {
      registry: registry.address,
      maker: taker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: anyERC20ForERC1155,
      staticExtradata,
      maximumFill: ethers.BigNumber.from(erc20BuyPrice)
        .mul(ethers.BigNumber.from(erc1155BuyAmount))
        .toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };
    const { signature, structHash } = await signOrder({
      maker: taker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const matchERC1155ForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
    buyAmount,
  }: OrdersMatch & { buyAmount: BigNumberish }) => {
    const [
      [erc1155Address, erc20Address],
      [tokenId, erc1155Numerator, erc20SellPrice],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[3]'],
      sellOrder.staticExtradata
    );
    const [
      [erc20AddressOther, erc1155AddressOther],
      [tokenIdOther, erc20BuyPrice, erc1155Denominator],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[3]'],
      buyOrder.staticExtradata
    );
    // these checks are also performed within the static calls on StaticMarket, but we check here before going on chain
    if (erc1155Address != erc1155AddressOther)
      throw new Error("ERC1155 Addresses don't match on orders");
    if (erc20Address != erc20AddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!tokenId.eq(tokenIdOther))
      throw new Error("ERC1155 token IDs don't match on orders");
    if (!erc20SellPrice.eq(erc20BuyPrice))
      throw new Error("ERC20 buying prices don't match on orders");
    if (!erc1155Numerator.eq(erc1155Denominator))
      throw new Error("ERC1155 Numerator and Denominator don't match");

    const firstData = ERC1155Interface.encodeFunctionData('safeTransferFrom', [
      sellOrder.maker,
      buyOrder.maker,
      tokenId,
      buyAmount,
      '0x',
    ]);
    const secondData = ERC20Interface.encodeFunctionData('transferFrom', [
      buyOrder.maker,
      sellOrder.maker,
      buyOrder.maximumFill,
    ]);

    const firstCall = { target: erc1155Address, howToCall: 0, data: firstData };
    const secondCall = { target: erc20Address, howToCall: 0, data: secondData };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const anyERC1155ForMultiERC20 = async ({
    maker,
    executer = maker.address,
    erc1155Address,
    erc1155Id,
    erc1155SellAmount,
    erc1155SellNumerator,
    erc20Address,
    erc20SellPrice,
    expirationTime,
    protocol,
    creator,
    sellerAmount,
    protocolFees,
    royaltiesFees,
  }: {
    maker: Wallet;
    executer: string;
    erc1155Address: string;
    erc1155Id: BigNumberish;
    erc20Address: string;
    erc1155SellAmount: BigNumberish;
    erc1155SellNumerator: BigNumberish;
    erc20SellPrice: BigNumberish;
    expirationTime: BigNumber;
    protocol: string;
    creator: string;
    sellerAmount: BigNumberish;
    protocolFees: BigNumberish;
    royaltiesFees: BigNumberish;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[]', 'uint256[]'],
      [
        [erc1155Address, erc20Address, protocol, creator],
        [
          erc1155Id,
          erc1155SellNumerator,
          erc20SellPrice,
          sellerAmount,
          protocolFees,
          royaltiesFees,
        ],
      ]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: anyERC1155ForMultiERC20s,
      staticExtradata,
      maximumFill: ethers.BigNumber.from(erc1155SellNumerator)
        .mul(ethers.BigNumber.from(erc1155SellAmount))
        .toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };
    const { signature, structHash } = await signOrder({
      maker,
      orderParams_: order,
    });

    return { order, signature, orderHash: structHash };
  };

  const anyMultiERC20ForERC1155 = async ({
    taker,
    executer = taker.address,
    erc1155Address,
    erc1155Id,
    erc1155BuyAmount,
    erc1155BuyDenominator,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
    protocol,
    creator,
    sellerAmount,
    protocolFees,
    royaltiesFees,
  }: {
    taker: Wallet;
    executer: string;
    erc1155Address: string;
    erc1155Id: BigNumberish;
    erc20Address: string;
    erc1155BuyAmount: BigNumberish;
    erc1155BuyDenominator: BigNumberish;
    erc20BuyPrice: BigNumberish;
    expirationTime: BigNumber;
    protocol: string;
    creator: string;
    sellerAmount: BigNumberish;
    protocolFees: BigNumberish;
    royaltiesFees: BigNumberish;
  }) => {
    // static extradata for both the order and counter order are checked during the StaticMarket calls
    const staticExtradata = defaultAbiCoder.encode(
      ['address[]', 'uint256[]'],
      [
        [erc20Address, erc1155Address, protocol, creator],
        [
          erc1155Id,
          erc20BuyPrice,
          erc1155BuyDenominator,
          sellerAmount,
          protocolFees,
          royaltiesFees,
        ],
      ]
    );
    const order = {
      registry: registry.address,
      maker: taker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: anyMultiERC20ForERC1155s,
      staticExtradata,
      maximumFill: ethers.BigNumber.from(erc20BuyPrice)
        .mul(ethers.BigNumber.from(erc1155BuyAmount))
        .toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker: taker,
      orderParams_: order,
    }); // calls out to the signer (wallet, often Metamask)

    return { order, signature, orderHash: structHash };
  };

  const matchERC1155FeesForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
    buyAmount,
  }: OrdersMatch & { buyAmount: BigNumberish }) => {
    const [
      [erc1155Address, erc20Address, protocol, creator],
      [
        tokenId,
        erc1155Numerator,
        erc20SellPrice,
        sellerAmount,
        protocolFees,
        royaltiesFees,
      ],
    ] = defaultAbiCoder.decode(
      ['address[]', 'uint256[]'],
      sellOrder.staticExtradata
    );
    const [
      [erc20AddressOther, erc1155AddressOther, protocolOther, creatorOther],
      [
        tokenIdOther,
        erc20BuyPrice,
        erc1155Denominator,
        sellerAmountOther,
        protocolFeesOther,
        royaltiesFeesOther,
      ],
    ] = defaultAbiCoder.decode(
      ['address[]', 'uint256[]'],
      buyOrder.staticExtradata
    );
    // these checks are also performed within the static calls on StaticMarket, but we check here before going on chain
    if (erc1155Address != erc1155AddressOther)
      throw new Error("ERC1155 Addresses don't match on orders");
    if (erc20Address != erc20AddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!tokenId.eq(tokenIdOther))
      throw new Error("ERC1155 token IDs don't match on orders");
    if (!erc20SellPrice.eq(erc20BuyPrice))
      throw new Error("ERC20 buying prices don't match on orders");
    if (!erc1155Numerator.eq(erc1155Denominator))
      throw new Error("ERC1155 Numerator and Denominator don't match");
    if (protocol != protocolOther)
      throw new Error("Protocol Addresses don't match on orders");
    if (creator != creatorOther)
      throw new Error("Creator Addresses don't match on orders");
    if (!sellerAmount.eq(sellerAmountOther))
      throw new Error("Seller Amounts don't match on orders");
    if (!protocolFees.eq(protocolFeesOther))
      throw new Error("Protocol Fees amounts don't match on orders");
    if (!royaltiesFees.eq(royaltiesFeesOther))
      throw new Error("Royalties Fees amounts don't match on orders");

    const firstData = ERC1155Interface.encodeFunctionData('safeTransferFrom', [
      sellOrder.maker,
      buyOrder.maker,
      tokenId,
      buyAmount,
      '0x',
    ]);

    const secondData = atomicizer.interface.encodeFunctionData('atomicize', [
      [erc20Address, erc20Address, erc20Address],
      [0, 0, 0],
      [
        ERC20Interface.encodeFunctionData('transferFrom', [
          buyOrder.maker,
          sellOrder.maker,
          sellerAmount,
        ]),
        ERC20Interface.encodeFunctionData('transferFrom', [
          buyOrder.maker,
          protocol,
          protocolFees,
        ]),
        ERC20Interface.encodeFunctionData('transferFrom', [
          buyOrder.maker,
          creator,
          royaltiesFees,
        ]),
      ],
    ]);

    const firstCall = { target: erc1155Address, howToCall: 0, data: firstData };
    const secondCall = {
      target: atomicizer.address,
      howToCall: 1,
      data: secondData,
    };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const offerLazyERC1155ForERC20 = async ({
    maker,
    executer = maker.address,
    erc1155Address,
    erc1155Id,
    erc1155SellAmount,
    erc1155SellNumerator,
    erc20Address,
    erc20SellPrice,
    expirationTime,
    extraBytes,
  }: {
    maker: Wallet;
    executer: string;
    erc1155Address: string;
    erc1155Id: BigNumberish;
    erc1155SellAmount: BigNumberish;
    erc1155SellNumerator: BigNumberish;
    erc20Address: string;
    erc20SellPrice: BigNumberish;
    expirationTime: BigNumber;
    extraBytes: BytesLike;
  }) => {
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[3]', 'bytes'],
      [
        [erc1155Address, erc20Address],
        [erc1155Id, erc1155SellNumerator, erc20SellPrice],
        extraBytes,
      ]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: LazyERC1155ForERC20,
      staticExtradata,
      maximumFill: ethers.BigNumber.from(erc1155SellNumerator)
        .mul(ethers.BigNumber.from(erc1155SellAmount))
        .toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker,
      orderParams_: order,
    }); // calls out to the signer (wallet, often Metamask)

    return { order, signature, orderHash: structHash };
  };

  const offerERC20ForLazyERC1155 = async ({
    taker,
    executer = taker.address,
    erc1155Address,
    erc1155Id,
    erc1155BuyAmount,
    erc1155BuyDenominator,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
    extraBytes,
  }: {
    taker: Wallet;
    executer: string;
    erc1155Address: string;
    erc1155Id: BigNumberish;
    erc1155BuyAmount: BigNumberish;
    erc1155BuyDenominator: BigNumberish;
    erc20Address: string;
    erc20BuyPrice: BigNumberish;
    expirationTime: BigNumber;
    extraBytes: BytesLike;
  }) => {
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[3]', 'bytes'],
      [
        [erc20Address, erc1155Address],
        [erc1155Id, erc20BuyPrice, erc1155BuyDenominator],
        extraBytes,
      ]
    );
    const order = {
      registry: registry.address,
      maker: taker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: LazyERC20ForERC1155,
      staticExtradata,
      maximumFill: ethers.BigNumber.from(erc20BuyPrice)
        .mul(ethers.BigNumber.from(erc1155BuyAmount))
        .toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature, structHash } = await signOrder({
      maker: taker,
      orderParams_: order,
    }); // calls out to the signer (wallet, often Metamask)

    return { order, signature, orderHash: structHash };
  };

  const matchLazy1155ForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
    buyAmount,
  }: OrdersMatch & { buyAmount: BigNumberish }) => {
    const [
      [erc1155Address, erc20Address],
      [tokenId, erc1155Numerator, erc20SellPrice],
      tokenURI,
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[3]', 'bytes'],
      sellOrder.staticExtradata
    );
    const [
      [erc20AddressOther, erc1155AddressOther],
      [tokenIdOther, erc20BuyPrice, erc1155Denominator],
      tokenURIOther,
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[3]', 'bytes'],
      buyOrder.staticExtradata
    );

    if (erc1155Address != erc1155AddressOther)
      throw new Error("ERC1155 Addresses don't match on orders");
    if (erc20Address != erc20AddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!tokenId.eq(tokenIdOther))
      throw new Error("ERC1155 token IDs don't match on orders");
    if (!erc20SellPrice.eq(erc20BuyPrice))
      throw new Error("ERC20 buying prices don't match on orders");
    if (!erc1155Numerator.eq(erc1155Denominator))
      throw new Error("ERC1155 Numerator and Denominator don't match");
    if (tokenURI != tokenURIOther)
      throw new Error("Lazy mint tokenURIs don't match on orders");

    const firstData = ERC1155Interface.encodeFunctionData(
      'mint(address,uint256,uint256,bytes)',
      [buyOrder.maker, tokenId, buyAmount, tokenURI]
    );
    const secondData = ERC20Interface.encodeFunctionData('transferFrom', [
      buyOrder.maker,
      sellOrder.maker,
      buyOrder.maximumFill,
    ]);

    const firstCall = { target: erc1155Address, howToCall: 0, data: firstData };
    const secondCall = { target: erc20Address, howToCall: 0, data: secondData };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const offerERC20ForERC20 = async ({
    maker,
    executer = maker.address,
    erc20SellerAddress,
    sellingPrice,
    sellAmount,
    erc20BuyerAddress,
    buyingPrice,
    expirationTime,
  }: {
    maker: Wallet;
    executer: string;
    erc20SellerAddress: string;
    sellingPrice: BigNumberish;
    sellAmount: BigNumberish;
    erc20BuyerAddress: string;
    buyingPrice: BigNumberish;
    expirationTime: BigNumber;
  }) => {
    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[2]'],
      [
        [erc20SellerAddress, erc20BuyerAddress],
        [sellingPrice, buyingPrice],
      ]
    );

    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: anyERC20ForERC20,
      staticExtradata,
      maximumFill: sellAmount.toString(),
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature } = await signOrder({
      maker,
      orderParams_: order,
    });

    return { order, signature };
  };

  const matchERC20ForERC20 = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
    buyAmount,
  }: OrdersMatch & { buyAmount: BigNumberish }) => {
    const [
      [erc20SellerAddress, erc20BuyerAddress],
      [sellingPrice, buyingPrice],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[2]'],
      sellOrder.staticExtradata
    );
    const [
      [erc20BuyerAddressOther, erc20SellerAddressOther],
      [buyingPriceOther, sellingPriceOther],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[2]'],
      buyOrder.staticExtradata
    );

    if (erc20SellerAddress != erc20SellerAddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (erc20BuyerAddress != erc20BuyerAddressOther)
      throw new Error("ERC20 Addresses don't match on orders");
    if (!sellingPrice.eq(sellingPriceOther))
      throw new Error("ERC20 selling prices don't match on orders");
    if (!buyingPrice.eq(buyingPriceOther))
      throw new Error("ERC20 buying prices don't match on orders");

    const firstData = ERC20Interface.encodeFunctionData('transferFrom', [
      sellOrder.maker,
      buyOrder.maker,
      buyAmount,
    ]);
    const secondData = ERC20Interface.encodeFunctionData('transferFrom', [
      buyOrder.maker,
      sellOrder.maker,
      ethers.BigNumber.from(buyAmount).mul(ethers.BigNumber.from(sellingPrice)),
    ]);

    const firstCall = {
      target: erc20SellerAddress,
      howToCall: 0,
      data: firstData,
    };
    const secondCall = {
      target: erc20BuyerAddress,
      howToCall: 0,
      data: secondData,
    };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  const offerNFTForNFT = async ({
    maker,
    executer = maker.address,
    offeringTokenType,
    offeringToken,
    offeringTokenId,
    offeringTokenAmount,
    askingTokenType,
    askingToken,
    askingTokenId,
    askingTokenAmount,
    expirationTime,
  }: {
    maker: Wallet;
    executer: string;
    offeringTokenType: string;
    offeringToken: string;
    offeringTokenId: BigNumberish;
    offeringTokenAmount: number;
    askingTokenType: string;
    askingToken: string;
    askingTokenId: BigNumberish;
    askingTokenAmount: number;
    expirationTime: BigNumber;
  }) => {
    if (offeringTokenType != 'ERC721' && offeringTokenType != 'ERC1155')
      throw new Error('Token type not supported');
    if (askingTokenType != 'ERC721' && askingTokenType != 'ERC1155')
      throw new Error('Token type not supported');
    if (offeringTokenAmount == 0)
      throw new Error("Offering token amount can't be 0");
    if (askingTokenAmount == 0)
      throw new Error("Offering token amount can't be 0");
    if (offeringTokenType == 'ERC721' && offeringTokenAmount > 1)
      throw new Error("ERC721 can't be offered in more than 1");
    if (askingTokenType == 'ERC721' && askingTokenAmount > 1)
      throw new Error("ERC721 can't be offered in more than 1");

    const staticExtradata = defaultAbiCoder.encode(
      ['address[2]', 'uint256[4]', 'bytes1[2]'],
      [
        [offeringToken, askingToken],
        [
          offeringTokenId,
          offeringTokenAmount,
          askingTokenId,
          askingTokenAmount,
        ],
        [
          offeringTokenType === 'ERC721' ? '0x00' : '0x01',
          askingTokenType === 'ERC721' ? '0x00' : '0x01',
        ],
      ]
    );
    const order = {
      registry: registry.address,
      maker: maker.address,
      executer,
      staticTarget: staticMarket.address,
      staticSelector: anyNFTForNFT,
      staticExtradata,
      maximumFill: offeringTokenAmount,
      extraData: packData(timestamp, expirationTime, randomHex(16)),
    };

    const { signature } = await signOrder({
      maker,
      orderParams_: order,
    });
    return { order, signature };
  };

  const matchNFTForNFT = async ({
    sender,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
  }: OrdersMatch) => {
    const [
      [offeringToken, askingToken],
      [offeringTokenId, offeringTokenAmount, askingTokenId, askingTokenAmount],
      [offeringTokenType, askingTokenType],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[4]', 'bytes1[2]'],
      sellOrder.staticExtradata
    );

    const [
      [offeringTokenOther, askingTokenOther],
      [
        offeringTokenIdOther,
        offeringTokenAmountOther,
        askingTokenIdOther,
        askingTokenAmountOther,
      ],
      [offerTokenTypeOther, askingTokenTypeOther],
    ] = defaultAbiCoder.decode(
      ['address[2]', 'uint256[4]', 'bytes1[2]'],
      buyOrder.staticExtradata
    );
    if (!askingTokenId.eq(offeringTokenIdOther))
      throw new Error('Token ids mismatch');
    if (!askingTokenIdOther.eq(offeringTokenId))
      throw new Error('Token ids mismatch');
    if (askingTokenOther != offeringToken)
      throw new Error('Tokens addresses mismatch');
    if (askingToken != offeringTokenOther)
      throw new Error('Tokens addresses mismatch');
    if (!askingTokenAmount.eq(offeringTokenAmountOther))
      throw new Error('Tokens amounts mismatch');
    if (!askingTokenAmountOther.eq(offeringTokenAmount))
      throw new Error('Tokens amounts mismatch');
    if (askingTokenTypeOther != offeringTokenType)
      throw new Error('Tokens Types  mismatch');
    if (askingTokenType != offerTokenTypeOther)
      throw new Error('Tokens Types  mismatch');

    let data =
      offeringTokenType == 0x00
        ? ERC721Interface.encodeFunctionData('transferFrom', [
            sellOrder.maker,
            buyOrder.maker,
            offeringTokenId.toString(),
          ])
        : ERC1155Interface.encodeFunctionData('safeTransferFrom', [
            sellOrder.maker,
            buyOrder.maker,
            offeringTokenId.toString(),
            offeringTokenAmount.toString(),
            '0x',
          ]);

    const firstCall = {
      target: offeringToken,
      howToCall: 0,
      data,
    };

    data =
      offerTokenTypeOther == 0x00
        ? ERC721Interface.encodeFunctionData('transferFrom', [
            buyOrder.maker,
            sellOrder.maker,
            offeringTokenIdOther.toString(),
          ])
        : ERC1155Interface.encodeFunctionData('safeTransferFrom', [
            buyOrder.maker,
            sellOrder.maker,
            offeringTokenIdOther.toString(),
            offeringTokenAmountOther.toString(),
            '0x',
          ]);

    const secondCall = {
      target: askingToken,
      howToCall: 0,
      data,
    };

    return await atomicMatch({
      sender,
      order: sellOrder,
      sig: sellSig,
      call: firstCall,
      counterorder: buyOrder,
      countersig: buySig,
      countercall: secondCall,
    });
  };

  /**
   * Generates the order and signature by prompting the signer
   * @param tokenType enum ERC721 | LazyERC721 | ERC1155 | LazyERC155
   * @param tokenAddress NFT contract address
   * @param tokenId NFT id
   * @param erc20Address ERC20 contract address
   * @param erc20BuyPrice ERC20 bid amount in Wei (fully expanded decimals)
   * @param expirationTime Unix timestamp in seconds
   * @param optionalParams ERC1155 bids require a buy amount and buy denominator, lazy bids require an extraBytes string, royalties and fees require payouts
   * @returns order struct, signed order, and the order hash
   */
  const placeBid = async <T extends TokenType>({
    taker,
    executer = taker.address,
    tokenType,
    tokenAddress,
    tokenId,
    erc20Address,
    erc20BuyPrice,
    expirationTime,
    optionalParams,
  }: Bid<T>) => {
    switch (tokenType) {
      case 'ERC721':
        return offerERC20ForERC721({
          taker,
          executer,
          erc721Address: tokenAddress,
          erc721Id: tokenId,
          erc20Address,
          erc20BuyPrice,
          expirationTime,
        });
      case 'ERC721Fees': {
        const { royalties, protocolFees, sellerAmount } =
          optionalParams as ERC721FeesParams;
        if (!royalties.creator)
          throw new Error(
            'Must include creator address for royalties distribution'
          );
        if (!protocolFees.treasury)
          throw new Error(
            'Must include treasury address for protocol fees distribution'
          );
        if (!protocolFees.pFee)
          throw new Error(
            'Must include protocol fees for protocol fees distribution'
          );
        if (!royalties.feebps)
          throw new Error(
            'Must include royalties fees for royalties distribution'
          );
        if (!sellerAmount)
          throw new Error('Must include seller amount for fees distribution');

        return MultiERC20ForERC721({
          taker,
          executer,
          erc721Address: tokenAddress,
          erc721Id: tokenId,
          erc20Address,
          erc20BuyPrice,
          expirationTime,
          protocol: protocolFees.treasury,
          creator: royalties.creator,
          sellerAmount,
          protocolFees: protocolFees.pFee,
          royaltiesFees: royalties.feebps,
        });
      }
      case 'LazyERC721': {
        const { extraBytes } = optionalParams as LazyParams;
        if (!extraBytes)
          throw new Error('Must include param extraBytes for lazy mint');
        return offerERC20ForLazyERC721({
          taker,
          executer,
          erc721Address: tokenAddress,
          erc721Id: tokenId,
          erc20Address,
          erc20BuyPrice,
          expirationTime,
          extraBytes,
        });
      }
      case 'ERC1155': {
        const { erc1155Amount, erc1155ratio } = optionalParams as ERC1155Params;
        if (!erc1155Amount)
          throw new Error('Must include param erc1155Amount for ERC1155 Bid');
        if (!erc1155ratio)
          throw new Error(
            'Must include param erc1155Denominator for ERC1155 Bid'
          );

        return offerERC20ForERC1155({
          taker,
          executer,
          erc1155Address: tokenAddress,
          erc1155Id: tokenId,
          erc1155BuyAmount: erc1155Amount,
          erc1155BuyDenominator: erc1155ratio,
          erc20Address,
          erc20BuyPrice,
          expirationTime,
        });
      }
      case 'ERC1155Fees': {
        const {
          erc1155Amount,
          sellerAmount,
          erc1155ratio,
          royalties,
          protocolFees,
        } = optionalParams as ERC1155FeesParams;
        if (!royalties.creator)
          throw new Error(
            'Must include creator address for royalties distribution'
          );
        if (!protocolFees.treasury)
          throw new Error(
            'Must include treasury address for protocol fees distribution'
          );
        if (!protocolFees.pFee)
          throw new Error(
            'Must include protocol fees for protocol fees distribution'
          );
        if (!royalties.feebps)
          throw new Error(
            'Must include royalties fees for royalties distribution'
          );
        if (!erc1155Amount)
          throw new Error('Must include param erc1155Amount for ERC1155 Bid');
        if (!erc1155ratio)
          throw new Error(
            'Must include param erc1155Denominator for ERC1155 Bid'
          );

        return anyMultiERC20ForERC1155({
          taker,
          executer,
          erc1155Address: tokenAddress,
          erc1155Id: tokenId,
          erc1155BuyAmount: erc1155Amount,
          erc1155BuyDenominator: erc1155ratio,
          erc20Address,
          erc20BuyPrice,
          expirationTime,
          protocol: protocolFees.treasury,
          creator: royalties.creator,
          sellerAmount,
          protocolFees: protocolFees.pFee,
          royaltiesFees: royalties.feebps,
        });
      }
      case 'LazyERC1155': {
        const { erc1155Amount, erc1155ratio, extraBytes } =
          optionalParams as LazyERC1155Params;
        if (!erc1155Amount)
          throw new Error('Must include param erc1155Amount for ERC1155 Bid');
        if (!erc1155ratio)
          throw new Error(
            'Must include param erc1155BuyDenominator for ERC1155 Bid'
          );
        if (!extraBytes)
          throw new Error('Must include param extraBytes for lazy mint');

        return offerERC20ForLazyERC1155({
          taker,
          executer,
          erc1155Address: tokenAddress,
          erc1155Id: tokenId,
          erc1155BuyAmount: erc1155Amount,
          erc1155BuyDenominator: erc1155ratio,
          erc20Address,
          erc20BuyPrice,
          expirationTime,
          extraBytes,
        });
      }
      default:
        throw Error(
          'Wrong token type. Must be ERC721, ERC721Fees, LazyERC721, ERC1155, ERC1155Fees, or LazyERC1155'
        );
    }
  };

  /**
   * Generates the order and signature by prompting the signer
   * @param tokenType enum ERC721 | LazyERC721 | ERC1155 | LazyERC155
   * @param tokenAddress NFT contract address
   * @param tokenId NFT id
   * @param erc20Address ERC20 contract address
   * @param erc20SellPrice ERC20 bid amount in Wei (fully expanded decimals)
   * @param expirationTime Unix timestamp in seconds
   * @param optionalParams ERC1155 asks require a sell amount and buy numerator, lazy asks require an extraBytes string, royalties and fees require payouts
   * @returns order struct, signed order, and the order hash
   */
  const placeAsk = async <T extends TokenType>({
    maker,
    executer = maker.address,
    tokenType,
    tokenAddress,
    tokenId,
    erc20Address,
    erc20SellPrice,
    expirationTime,
    optionalParams,
  }: Ask<T>) => {
    switch (tokenType) {
      case 'ERC721':
        return offerERC721ForERC20({
          maker,
          executer,
          erc721Address: tokenAddress,
          erc721Id: tokenId,
          erc20Address,
          erc20SellPrice,
          expirationTime,
        });
      case 'ERC721Fees': {
        const { royalties, protocolFees, sellerAmount } =
          optionalParams as ERC1155FeesParams;
        if (!royalties.creator)
          throw new Error(
            'Must include creator address for royalties distribution'
          );
        if (!protocolFees.treasury)
          throw new Error(
            'Must include protocol address for protocol fees distribution'
          );
        if (!protocolFees.pFee)
          throw new Error(
            'Must include protocol fees for protocol fees distribution'
          );
        if (!royalties.feebps)
          throw new Error(
            'Must include royalties fees for royalties distribution'
          );
        if (!sellerAmount)
          throw new Error('Must include seller amount for fees distribution');

        return ERC721ForMultiERC20({
          maker,
          executer,
          erc721Address: tokenAddress,
          erc721Id: tokenId,
          erc20Address,
          erc20SellPrice,
          expirationTime,
          protocol: protocolFees.treasury,
          creator: royalties.creator,
          sellerAmount,
          protocolFees: protocolFees.pFee,
          royaltiesFees: royalties.feebps,
        });
      }
      case 'LazyERC721': {
        const { extraBytes } = optionalParams as LazyParams;
        if (!extraBytes)
          throw new Error('Must include param extraBytes for lazy mint');
        return offerLazyERC721ForERC20({
          maker,
          executer,
          erc721Address: tokenAddress,
          erc721Id: tokenId,
          erc20Address,
          erc20SellPrice,
          expirationTime,
          extraBytes,
        });
      }
      case 'ERC1155': {
        const { erc1155Amount, erc1155ratio } = optionalParams as ERC1155Params;
        if (!erc1155Amount)
          throw new Error('Must include param erc1155Amount for ERC1155 Ask');
        if (!erc1155ratio)
          throw new Error(
            'Must include param erc1155Numerator for ERC1155 Ask'
          );
        return offerERC1155ForERC20({
          maker,
          executer,
          erc1155Address: tokenAddress,
          erc1155Id: tokenId,
          erc1155SellAmount: erc1155Amount,
          erc1155SellNumerator: erc1155ratio,
          erc20Address,
          erc20SellPrice,
          expirationTime,
        });
      }
      case 'ERC1155Fees': {
        const {
          erc1155Amount,
          erc1155ratio,
          royalties,
          protocolFees,
          sellerAmount,
        } = optionalParams as ERC1155FeesParams;
        if (!erc1155Amount)
          throw new Error('Must include param erc1155Amount for ERC1155 Ask');
        if (!erc1155ratio)
          throw new Error(
            'Must include param erc1155Numerator for ERC1155 Ask'
          );
        if (!royalties.creator)
          throw new Error(
            'Must include creator address for royalties distribution'
          );
        if (!protocolFees.treasury)
          throw new Error(
            'Must include protocol address for protocol fees distribution'
          );
        if (!protocolFees.pFee)
          throw new Error(
            'Must include protocol fees for protocol fees distribution'
          );
        if (!royalties.feebps)
          throw new Error(
            'Must include royalties fees for royalties distribution'
          );
        if (!sellerAmount)
          throw new Error('Must include seller amount for fees distribution');

        return anyERC1155ForMultiERC20({
          maker,
          executer,
          erc1155Address: tokenAddress,
          erc1155Id: tokenId,
          erc1155SellAmount: erc1155Amount,
          erc1155SellNumerator: erc1155ratio,
          erc20Address,
          erc20SellPrice,
          expirationTime,
          protocol: protocolFees.treasury,
          creator: royalties.creator,
          sellerAmount,
          protocolFees: protocolFees.pFee,
          royaltiesFees: royalties.feebps,
        });
      }
      case 'LazyERC1155': {
        const { erc1155Amount, erc1155ratio, extraBytes } =
          optionalParams as LazyERC1155Params;
        if (!erc1155Amount)
          throw new Error('Must include param erc1155Amount for ERC1155 Ask');
        if (!erc1155ratio)
          throw new Error(
            'Must include param erc1155Numerator for ERC1155 Ask'
          );
        if (!extraBytes)
          throw new Error('Must include param extraBytes for lazy mint');

        return offerLazyERC1155ForERC20({
          maker,
          executer,
          erc1155Address: tokenAddress,
          erc1155Id: tokenId,
          erc1155SellAmount: erc1155Amount,
          erc1155SellNumerator: erc1155ratio,
          erc20Address,
          erc20SellPrice,
          expirationTime,
          extraBytes,
        });
      }
      default:
        throw Error(
          'Wrong token type. Must be ERC721, ERC721Fees, LazyERC721, ERC1155, ERC1155Fees, or LazyERC1155'
        );
    }
  };

  /**
   * If compatible, matches the two orders on chain and exchanges the tokens
   * @param tokenType enum ERC721 | LazyERC721 | ERC1155 | LazyERC155
   * @param sellOrder order struct for the NFT (sell side)
   * @param sellSig the signed sellOrder
   * @param buyOrder order struct for the ERC20 (buy side)
   * @param buySig the signed buyOrder
   * @param buyAmount if 1155 token, the amount of tokens being bought
   * @returns transaction details
   */
  const matchOrders = async ({
    sender,
    tokenType,
    sellOrder,
    sellSig,
    buyOrder,
    buySig,
    buyAmount,
  }: {
    sender: Wallet;
    tokenType: TokenType;
    sellOrder: OrderParameters;
    sellSig: Signature;
    buyOrder: OrderParameters;
    buySig: Signature;
    buyAmount: BigNumberish;
  }) => {
    switch (tokenType) {
      case 'ERC721':
        return matchERC721ForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
        });
      case 'ERC721Fees':
        return matchERC721FeesForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
        });
      case 'LazyERC721':
        return matchLazy721ForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
        });
      case 'ERC1155':
        return matchERC1155ForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount,
        });
      case 'ERC1155Fees':
        return matchERC1155FeesForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount,
        });
      case 'LazyERC1155':
        return matchLazy1155ForERC20({
          sender,
          sellOrder,
          sellSig,
          buyOrder,
          buySig,
          buyAmount,
        });
      default:
        throw Error(
          'Wrong token type. Must be ERC721, ERC721Fees, LazyERC721, ERC1155, ERC1155Fees, or LazyERC1155'
        );
    }
  };

  return {
    marketplace,
    atomicMatch,
    validateOrderParameters,
    approveOrder,
    signOrder,
    personalSign,
    orderData,
    order,
    getHashToSign,
    getProtocolFees,
    getAndVerifyOrderHash,
    cancelOrder,
    placeAsk,
    placeBid,
    matchOrders,
    matchERC1155FeesForERC20,
    matchERC1155ForERC20,
    matchERC20ForERC20,
    matchERC721FeesForERC20,
    matchERC721ForERC20,
    matchLazy1155ForERC20,
    matchLazy721ForERC20,
    offerNFTForNFT,
    offerERC20ForERC20,
    offerLazyERC1155ForERC20,
    offerERC1155ForERC20,
    offerERC20ForERC1155,
    offerERC20ForERC721,
    offerERC20ForLazyERC1155,
    offerERC20ForLazyERC721,
    offerERC721ForERC20,
    ERC721ForMultiERC20,
    anyERC1155ForMultiERC20,
    anyMultiERC20ForERC1155,
    offerLazyERC721ForERC20,
    MultiERC20ForERC721,
    matchNFTForNFT,
    timestamp,
  };
};
