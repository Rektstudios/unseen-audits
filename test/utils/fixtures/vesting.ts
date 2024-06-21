import type { UnseenVesting, UnseenVestingNFTDescriptor } from '@typechained';
import type { ScheduleParams } from '@utils/types';
import type { Contract, Wallet } from 'ethers';

import { deployContract } from '@utils/contracts';
import { LoadSchedules } from 'utils/helper-functions';

export const unseenVestingFixture = async (owner: Wallet, token: Contract) => {
  const schedules = LoadSchedules();

  const vestingNFTDescriptor: UnseenVestingNFTDescriptor = await deployContract(
    'UnseenVestingNFTDescriptor',
    owner
  );

  const unseenVesting: UnseenVesting = await deployContract(
    'UnseenVesting',
    owner,
    owner.address,
    vestingNFTDescriptor.address,
    5,
    token.address
  );

  const createSchedule = async ({
    caller = owner,
    schedule,
  }: {
    caller?: Wallet;
    schedule: ScheduleParams;
  }) => {
    return await unseenVesting.connect(caller).createSchedule(schedule);
  };

  const createMultiSchedules = async ({
    caller = owner,
    schedules,
  }: {
    caller?: Wallet;
    schedules: ScheduleParams[];
  }) => {
    return await unseenVesting.connect(caller).createMultiSchedules(schedules);
  };

  return {
    unseenVesting,
    vestingNFTDescriptor,
    createMultiSchedules,
    createSchedule,
    schedules,
  };
};
