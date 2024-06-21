import type { JsonRpcProvider } from '@ethersproject/providers';
import type { Signer } from 'ethers';

import { faucet } from '@utils/faucet';

export const impersonate = async (
  address: string,
  provider: JsonRpcProvider
) => {
  await provider.send('hardhat_impersonateAccount', [address]);
  await faucet(address, provider);
};

export const stopImpersonation = async (
  address: string,
  provider: JsonRpcProvider
) => {
  await provider.send('hardhat_stopImpersonatingAccount', [address]);
};

export const whileImpersonating = async <T>(
  address: string,
  provider: JsonRpcProvider,
  // eslint-disable-next-line no-unused-vars
  fn: (impersonatedSigner: Signer) => T
) => {
  await impersonate(address, provider);
  const impersonatedSigner = await provider.getSigner(address);
  const result = await fn(impersonatedSigner);
  await stopImpersonation(address, provider);
  return result;
};
