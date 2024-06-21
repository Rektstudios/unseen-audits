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
    values,
    calldatas,
    options = {},
  }: {
    targets: string[];
    values: BigNumberish[];
    calldatas: string[];
    options?: {};
  }) => {
    return atomicizer.atomicize(targets, values, calldatas, options);
  };

  return {
    atomicizer,
    atomicize,
  };
};
