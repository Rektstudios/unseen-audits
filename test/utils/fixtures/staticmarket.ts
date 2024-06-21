import type { MockUnseenStatic } from '@typechained';
import type { Contract, Wallet } from 'ethers';

import { deployContract } from '@utils/contracts';

export const staticMarketFixture = async (
  owner: Wallet,
  atomicizer: Contract
) => {
  const staticMarket: MockUnseenStatic = await deployContract(
    'MockUnseenStatic',
    owner,
    atomicizer.address
  );
  return {
    staticMarket,
  };
};
