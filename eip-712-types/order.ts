import type { TypedDataField } from 'ethers';

export const eip712Order: { Order: TypedDataField[] } = {
  Order: [
    { name: 'registry', type: 'address' },
    { name: 'maker', type: 'address' },
    { name: 'executer', type: 'address' },
    { name: 'staticTarget', type: 'address' },
    { name: 'staticSelector', type: 'bytes4' },
    { name: 'staticExtradata', type: 'bytes' },
    { name: 'maximumFill', type: 'uint256' },
    { name: 'extraData', type: 'uint256' },
  ],
};

Object.freeze({
  eip712Order,
});
