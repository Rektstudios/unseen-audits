import type { TypedDataDomain } from 'ethers';

export const EIP712Domain = async (
  name: string,
  contract: string,
  version: string,
  chainId: number
): Promise<TypedDataDomain> => ({
  name,
  version,
  chainId,
  verifyingContract: contract,
});

Object.freeze({
  EIP712Domain,
});
