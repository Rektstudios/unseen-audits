import { ethers } from 'hardhat';

import type { BigNumberish, Contract } from 'ethers';

import { randomBN, toBN } from '@utils/encoding';

export const minRandom = (min: BigNumberish) => randomBN(10).add(min);

export type AwaitedObject<T> = {
  [K in keyof T]: Awaited<T[K]>;
};

export const mapValues = <T, U>(
  obj: Record<string, T>,
  // eslint-disable-next-line no-unused-vars
  fn: (value: T) => U
): Record<string, U> =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

export const getCustomRevertSelector = (customErrorString: string) =>
  ethers.utils
    .keccak256(ethers.utils.toUtf8Bytes(customErrorString))
    .slice(0, 10);

//TODO add an optional signer
export const deployContract = async <C extends Contract>(
  name: string,
  ...args: any[]
): Promise<C> => {
  const factory = await ethers.getContractFactory(name);
  const c = await factory.deploy(...(args || []));
  await c.deployed();
  return c as C;
};

export const expectedPrice = ({
  startPrice,
  endPrice,
  startTime,
  endTime,
  blockTimestamp,
}: {
  startPrice: BigNumberish;
  endPrice: BigNumberish;
  startTime: BigNumberish;
  endTime: BigNumberish;
  blockTimestamp: BigNumberish;
}) => {
  const duration = toBN(endTime).sub(startTime);
  const elapsed = toBN(blockTimestamp).sub(startTime);
  const remaining = duration.sub(elapsed);
  const totalBeforeDivision = toBN(startPrice)
    .mul(remaining)
    .add(toBN(endPrice).mul(elapsed));
  const price = totalBeforeDivision.div(duration);
  return price;
};
