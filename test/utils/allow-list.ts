import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';

import type { Leaf } from '@utils/types';

import { toPaddedBuffer } from '@utils/encoding';

const { keccak256 } = ethers.utils;

export const createMerkleTree = (leaves: Buffer[]) =>
  new MerkleTree(leaves, keccak256, {
    hashLeaves: true,
    sortLeaves: true,
    sortPairs: true,
  });

export const allowListElementsBuffer = (leaves: Leaf[]) =>
  leaves.map(([minter, mintParams]) =>
    Buffer.concat(
      [
        minter,
        mintParams.startPrice,
        mintParams.endPrice,
        mintParams.startTime,
        mintParams.endTime,
        mintParams.maxTokenSupplyForStage,
        mintParams.dropStageIndex,
      ].map(toPaddedBuffer)
    )
  );
