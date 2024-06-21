import type {
  BigNumber,
  BigNumberish,
  BytesLike,
  Signature,
  TypedDataDomain,
  TypedDataField,
  Wallet,
} from 'ethers';
import type { ConfigStructs } from 'typechained/contracts/shim/Shim';

export type Leaf = [minter: string, mintParams: ConfigStructs.MintParamsStruct];

export const enum MintType {
  PUBLIC,
  ALLOW_LIST,
  SIGNED,
}

export type TokenType =
  | 'ERC721'
  | 'ERC721Fees'
  | 'LazyERC721'
  | 'ERC1155'
  | 'ERC1155Fees'
  | 'LazyERC1155';

export type mintPayload = {
  nftContract: string;
  minter: string;
  mintParams: ConfigStructs.MintParamsStruct;
  salt: string;
};

export type MintData = {
  domain: TypedDataDomain;
  types: {
    SignedMint: TypedDataField[];
    MintParams: TypedDataField[];
  };
  mintPayload: mintPayload;
};

export type PermitData = {
  domain: TypedDataDomain;
  types: { Permit: TypedDataField[] };
  message: any;
};

export type OrderParameters = {
  registry: string;
  maker: string;
  executer: string;
  staticTarget: string;
  staticSelector: string;
  staticExtradata: BytesLike;
  maximumFill: BigNumberish;
  extraData: BigNumberish;
};

export type OrderData = {
  domain: TypedDataDomain;
  types: {
    Order: TypedDataField[];
  };
  orderParams: OrderParameters;
};

export type ProtocolFees = {
  treasury: string;
  pFee: BigNumberish;
};

export type Royalties = {
  creator: string;
  feebps: BigNumberish;
};

export type Sig = {
  v: number;
  r: string;
  s: string;
};

export type BaseAdvancedMatchingOptions = {
  tokenId: BigNumberish;
  buyTokenId?: BigNumberish;
  sellingPrice: BigNumber;
  sellingNumerator?: number;
  buyingPrice: BigNumber;
  buyingDenominator?: BigNumberish;
  erc20MintAmount: BigNumberish;
  maker: Wallet;
  taker: Wallet;
  sender: Wallet;
  txCount?: number;
  protocolFees?: ProtocolFees;
  royalties?: Royalties;
  extraBytes?: BytesLike;
};

export type AdvancedMatchingOptionsForNFT = {
  tokenGive: BigNumberish;
  tokenGiveType: 'ERC1155' | 'ERC721';
  tokenGiveAmount: number;
  tokenGet: BigNumberish;
  tokenGetType: 'ERC1155' | 'ERC721';
  tokenGetAmount: number;
  maker: Wallet;
  taker: Wallet;
};

export type AdvancedMatchingOptionsForERC20 = Omit<
  BaseAdvancedMatchingOptions,
  'tokenId' | 'erc20MintAmount'
> & {
  sellAmount: BigNumberish;
  buyAmount: number;
  buyPriceOffset?: number;
  erc20MintAmountSeller: BigNumberish;
  erc20MintAmountBuyer: BigNumberish;
  sender: Wallet;
};

export type AdvancedMatchingOptionsForERC1155 = BaseAdvancedMatchingOptions & {
  sellAmount: BigNumberish;
  buyAmount: number;
  erc1155MintAmount: BigNumberish;
  sender: Wallet;
};

export type AdvancedMatchingOptions = {
  ERC20: AdvancedMatchingOptionsForERC20;
  ERC721: BaseAdvancedMatchingOptions;
  ERC1155: AdvancedMatchingOptionsForERC1155;
  NFT: AdvancedMatchingOptionsForNFT;
};

export type Call = {
  target: string;
  howToCall: BigNumberish;
  data: BytesLike;
};

export type OrdersMatch = {
  sender: Wallet;
  sellOrder: OrderParameters;
  sellSig: Signature;
  buyOrder: OrderParameters;
  buySig: Signature;
};
export type AtomicMatch = {
  sender: Wallet;
  order: OrderParameters;
  sig: Sig & { suffix?: string };
  call: Call;
  counterorder: OrderParameters;
  countersig: Sig & { suffix?: string };
  countercall: Call;
};

export type BaseOptionalParams = {
  protocolFees: ProtocolFees;
  royalties: Royalties;
};

export type ERC721FeesParams = BaseOptionalParams & {
  sellerAmount: BigNumberish;
};

export type LazyParams = {
  extraBytes: BytesLike;
};

export type ERC1155Params = {
  erc1155Amount: BigNumberish;
  erc1155ratio: BigNumberish;
};

export type ERC1155FeesParams = ERC1155Params &
  BaseOptionalParams & {
    sellerAmount: BigNumberish;
  };

export type LazyERC1155Params = ERC1155Params & LazyParams;

export type OptionalParams = {
  ERC721: undefined;
  ERC721Fees: ERC721FeesParams;
  LazyERC721: LazyParams;
  ERC1155: ERC1155Params;
  ERC1155Fees: ERC1155FeesParams;
  LazyERC1155: LazyERC1155Params;
};

export type Bid<T extends TokenType> = {
  taker: Wallet;
  executer?: string;
  tokenType: T;
  tokenAddress: string;
  tokenId: BigNumberish;
  erc20Address: string;
  erc20BuyPrice: BigNumberish;
  expirationTime: BigNumber;
  optionalParams: OptionalParams[T];
};

export type Ask<T extends TokenType> = {
  maker: Wallet;
  executer?: string;
  tokenType: T;
  tokenAddress: string;
  tokenId: BigNumberish;
  erc20Address: string;
  erc20SellPrice: BigNumberish;
  expirationTime: BigNumber;
  optionalParams: OptionalParams[T];
};

export type Segments = {
  amount: BigNumberish;
  exponent: BigNumberish;
  milestone: BigNumberish;
};

export type ScheduleParams = {
  sender: string;
  recipient: string;
  startTime: BigNumberish;
  cancelable: boolean;
  transferable: boolean;
  segments: Segments[];
  totalAmount: BigNumberish;
};
