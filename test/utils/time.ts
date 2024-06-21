import { mine, mineUpTo, time } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';

import type { NumberLike } from '@nomicfoundation/hardhat-network-helpers/dist/src/types';

import { mapValues } from '@utils/helpers';

export const clock = {
  blocknumber: () => time.latestBlock().then(ethers.BigNumber.from),
  timestamp: () => time.latest().then(ethers.BigNumber.from),
};

export const increaseBy = {
  blockNumber: mine,
  timestamp: (delay: NumberLike | Date, mine = true) =>
    time
      .latest()
      .then((clock) => increaseTo.timestamp(clock + Number(delay), mine)),
};
export const increaseTo = {
  blocknumber: mineUpTo,
  timestamp: (to: NumberLike | Date, mine = true) =>
    mine ? time.increaseTo(to) : time.setNextBlockTimestamp(to),
};

export const duration = mapValues(
  time.duration,
  (fn) => (n: number) => ethers.BigNumber.from(fn(Number(n)))
);
