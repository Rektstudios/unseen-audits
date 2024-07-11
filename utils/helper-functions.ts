import { BigNumber, BigNumberish, Wallet } from 'ethers/lib/ethers';
import { hexlify, randomBytes } from 'ethers/lib/utils';
import fs from 'fs';
import { ethers, network } from 'hardhat';
import path from 'path';

export const packData = (
  listingTime: BigNumber,
  expirationTime: BigNumber,
  salt: string
) =>
  listingTime
    .or(expirationTime.shl(64))
    .or(BigNumber.from(salt).shl(128))
    .toString();

export const validTokenID = (signer: Wallet) =>
  ethers.BigNumber.from(signer.address).mul(ethers.BigNumber.from(2).pow(96));

export const randomHex = (bytes = 16) => hexlify(randomBytes(bytes));

export const random128 = () => BigInt(randomHex(16));

export const toBigNumber = (num: number) =>
  ethers.BigNumber.from(num.toLocaleString('fullwide', { useGrouping: false }));

export const LoadSchedules = () => {
  try {
    const filePath = path.join(
      __dirname,
      `../data/${network.name}.vesting.json`
    );

    if (!fs.existsSync(filePath)) {
      console.log(`Schedules file not found for network: ${network.name}`);
      return null;
    }

    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(
      `An error occurred while loading schedules for network: ${network.name}`,
      error
    );
    return null;
  }
};
