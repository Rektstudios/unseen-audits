import type { FeeCollector } from '@typechained';
import type { Wallet } from 'ethers';

import { deployContract } from '@utils/contracts';

export const feeCollectorFixture = async (owner: Wallet) => {
  const feeCollector: FeeCollector = await deployContract(
    'FeeCollector',
    owner,
    owner.address
  );
  return {
    feeCollector,
  };
};
