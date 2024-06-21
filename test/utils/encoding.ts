import { expect } from 'chai';
import { randomBytes as nodeRandomBytes } from 'crypto';
import { ethers, utils } from 'ethers';
import { keccak256, solidityPack, toUtf8Bytes } from 'ethers/lib/utils';

import type { BigNumberish, ContractTransaction } from 'ethers';

const { BigNumber } = ethers;

const SeededRNG = require('./seeded-rng');

const GAS_REPORT_MODE = process.env.REPORT_GAS;

const hexRegex = /[A-Fa-fx]/g;

export const toPaddedBuffer = (data: any) =>
  Buffer.from(
    BigNumber.from(data).toHexString().slice(2).padStart(64, '0'),
    'hex'
  );

// eslint-disable-next-line no-unused-vars
let randomBytes: (n: number) => string;
if (GAS_REPORT_MODE) {
  const srng = SeededRNG.create('gas-report');
  randomBytes = srng.randomBytes;
} else {
  randomBytes = (n: number) => nodeRandomBytes(n).toString('hex');
}

export const toHex = (n: BigNumberish, numBytes: number = 0) => {
  const asHexString = BigNumber.isBigNumber(n)
    ? n.toHexString().slice(2)
    : typeof n === 'string'
    ? hexRegex.test(n)
      ? n.replace(/0x/, '')
      : Number(n).toString(16)
    : Number(n).toString(16);
  return `0x${asHexString.padStart(numBytes * 2, '0')}`;
};

export const toBN = (n: BigNumberish) => BigNumber.from(toHex(n));

export const randomBN = (bytes: number = 16) => toBN(randomHex(bytes));

export const randomHex = (bytes = 32) => `0x${randomBytes(bytes)}`;

export const random128 = () => toBN(randomHex(16));

export const toKey = (n: BigNumberish) => toHex(n, 32);

export const convertSignatureToEIP2098 = (signature: string) => {
  if (signature.length === 130) {
    return signature;
  }

  expect(signature.length, 'signature must be 64 or 65 bytes').to.eq(132);

  return utils.splitSignature(signature).compact;
};

export const ORDER_TYPEHASH = keccak256(
  toUtf8Bytes(
    'Order(address registry,address maker,address executer,address staticTarget,bytes4 staticSelector,bytes staticExtradata,uint256 maximumFill,uint256 extraData)'
  )
);

export const _getHashToSign = (domainHash: string, structHash: string) =>
  keccak256(
    solidityPack(
      ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
      ['0x19', '0x01', domainHash, structHash]
    )
  );

export const getInterfaceID = (contractInterface: utils.Interface) => {
  let interfaceID = ethers.constants.Zero;
  const functions: string[] = Object.keys(contractInterface.functions);
  for (let i = 0; i < functions.length; i++) {
    interfaceID = interfaceID.xor(contractInterface.getSighash(functions[i]));
  }
  return interfaceID;
};

export const baseFee = async (tx: ContractTransaction) => {
  const data = tx.data;
  const { gasUsed } = await tx.wait();
  const bytes = toHex(data)
    .slice(2)
    .match(/.{1,2}/g) as string[];
  const numZero = bytes.filter((b) => b === '00').length;
  return (
    gasUsed.toNumber() - (21000 + (numZero * 4 + (bytes.length - numZero) * 16))
  );
};
