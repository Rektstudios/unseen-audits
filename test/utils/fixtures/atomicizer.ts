import type { UnseenAtomicizer } from '@typechained';
import type { BigNumberish, Wallet } from 'ethers';

import { deployContract } from '@utils/contracts';

export const atomicizerFixture = async (owner: Wallet) => {
  const atomicizer: UnseenAtomicizer = await deployContract(
    'UnseenAtomicizer',
    owner
  );
  const atomicize = async ({
    targets,
    calldatas,
    options = {},
  }: {
    targets: string[];
    calldatas: string[];
    options?: {};
  }) => {
    return atomicizer.atomicize(targets, calldatas, options);
  };

  return {
    atomicizer,
    atomicize,
  };
};
