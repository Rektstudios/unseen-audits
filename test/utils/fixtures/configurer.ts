import type { JsonRpcSigner } from '@ethersproject/providers';
import type { TheGeneratesConfigurer } from '@typechained';
import type { Wallet } from 'ethers';

import { deployContract } from '@utils/contracts';

export const configurerFixture = async (signer: JsonRpcSigner | Wallet) => {
  const configurer: TheGeneratesConfigurer = await deployContract(
    'TheGeneratesConfigurer',
    signer
  );
  return {
    configurer,
  };
};
