import type { GlobalMaker } from '@typechained';
import type { Contract, Wallet } from 'ethers';

import { globalMakerSigMakerOffsets } from '@constants';
import { deployContract } from '@utils/contracts';

export const globalMakerFixture = async (owner: Wallet, registry: Contract) => {
  const globalMaker: GlobalMaker = await deployContract(
    'GlobalMaker',
    owner,
    registry.address,
    globalMakerSigMakerOffsets.map((a) => a.sig),
    globalMakerSigMakerOffsets.map((a) => a.offset)
  );
  return {
    globalMaker,
  };
};
