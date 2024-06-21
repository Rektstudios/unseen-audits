import type { TypedDataField } from 'ethers';

export const signedMint: {
  SignedMint: TypedDataField[];
  MintParams: TypedDataField[];
} = {
  SignedMint: [
    { name: 'minter', type: 'address' },
    { name: 'mintParams', type: 'MintParams' },
    { name: 'salt', type: 'uint256' },
  ],
  MintParams: [
    { name: 'startPrice', type: 'uint256' },
    { name: 'endPrice', type: 'uint256' },
    { name: 'startTime', type: 'uint256' },
    { name: 'endTime', type: 'uint256' },
    { name: 'maxTokenSupplyForStage', type: 'uint256' },
    { name: 'dropStageIndex', type: 'uint256' },
  ],
};

Object.freeze({
  signedMint,
});
