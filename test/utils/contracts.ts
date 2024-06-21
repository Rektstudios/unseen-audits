import { ethers } from 'hardhat';

import type { JsonRpcSigner } from '@ethersproject/providers';
import type { Contract, Wallet } from 'ethers';

import 'dotenv/config';

export const deployContract = async <C extends Contract>(
  name: string,
  signer?: JsonRpcSigner | Wallet,
  ...args: any[]
): Promise<C> => {
  if (!signer) {
    signer = await ethers.provider.getSigner(0);
  }

  const f = await ethers.getContractFactory(name, signer);
  const c = await f.deploy(...(args || []));
  return c as C;
};
