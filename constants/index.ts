import { ethers } from 'ethers';
import ERC20ABI from 'artifacts/contracts/mock/MockERC20.sol/MockERC20.json';
import ERC721ABI from 'artifacts/contracts/mock/MockERC721.sol/MockERC721.json';
import ERC1155ABI from 'artifacts/contracts/mock/MockERC1155.sol/MockERC1155.json';
import AtomicizerABI from 'artifacts/contracts/marketplace/UnseenAtomicizer.sol/UnseenAtomicizer.json';
import { Sig } from '@utils/types';

const { HashZero, AddressZero } = ethers.constants;
const { id, Interface } = ethers.utils;

export const developmentChains: string[] = ['hardhat', 'localhost'];
export const ZERO_BYTES32 = HashZero;
export const ZERO_ADDRESS = AddressZero;
export const NATIVE_TOKEN = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
export const globalMakerSigMakerOffsets = [
  {
    sig: id('transferFrom(address,address,uint256)').substring(0, 10),
    offset: 4,
  },
  {
    sig: id(
      'safeTransferFrom(address,address,uint256,uint256,bytes)'
    ).substring(0, 10),
    offset: 4,
  },
  {
    sig: id('atomicize(address[],bytes[])').substring(0, 10),
    offset: 4,
  },
];
export const NULL_SIG: Sig = {
  v: 27,
  r: HashZero,
  s: HashZero,
};
export const anyERC1155ForERC20 = '0x5690367a';
export const anyERC20ForERC1155 = '0x2630b508';
export const ERC721ForERC20 = '0x635cd375';
export const ERC20ForERC721 = '0x857a3bdb';
export const anyERC20ForERC20 = '0x22b96a61';
export const LazyERC721ForERC20 = '0x021c7493';
export const LazyERC20ForERC721 = '0xa2cd034e';
export const LazyERC1155ForERC20 = '0x8f15f34a';
export const LazyERC20ForERC1155 = '0xbc79836d';
export const anyERC1155ForMultiERC20s = '0x2aa0191f';
export const anyMultiERC20ForERC1155s = '0x6ea40e61';
export const ERC721ForMultiERC20s = '0xd4773f24';
export const MultiERC20ForERC721s = '0x621d5ac7';
export const anyNFTForNFT = '0x002811ec';
export const noChecks_ = '0x57a5b31d'; // with params
export const noChecks = '0xd10b5256';
export const atomicize = '0x3083a708';

export const ERC20Interface = new Interface(ERC20ABI.abi);
export const ERC721Interface = new Interface(ERC721ABI.abi);
export const ERC1155Interface = new Interface(ERC1155ABI.abi);
export const AtomicizerInterface = new Interface(AtomicizerABI.abi);
