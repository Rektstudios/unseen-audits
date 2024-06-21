import { ethers } from 'hardhat';

import type { Wallet } from 'ethers';

import { atomicizerFixture } from '@fixtures/atomicizer';
import { configurerFixture } from '@fixtures/configurer';
import { marketplaceFixture } from '@fixtures/exchange';
import { feeCollectorFixture } from '@fixtures/feecollector';
import { globalMakerFixture } from '@fixtures/globalmaker';
import { registryFixture } from '@fixtures/registry';
import { staticMarketFixture } from '@fixtures/staticmarket';
import { unseenVestingFixture } from '@fixtures/vesting';
import { theGeneratesFixture } from '@fixtures/thegenerates';
import { tokensFixture } from '@fixtures/tokens';

export { configurerFixture } from '@fixtures/configurer';
export { marketplaceFixture } from '@fixtures/exchange';
export { feeCollectorFixture } from '@fixtures/feecollector';
export { atomicizerFixture } from '@fixtures/atomicizer';
export { globalMakerFixture } from '@fixtures/globalmaker';
export { registryFixture } from '@fixtures/registry';
export { staticMarketFixture } from '@fixtures/staticmarket';
export { theGeneratesFixture } from '@fixtures/thegenerates';
export {
  fixtureERC20,
  fixtureWETH,
  fixtureERC721,
  fixtureERC1155,
  tokensFixture,
} from '@fixtures/tokens';
export { unseenVestingFixture } from '@fixtures/vesting';

const { provider } = ethers;

export const unseenFixture = async (owner: Wallet) => {
  const EIP1271WalletFactory = await ethers.getContractFactory('MockERC1271');
  const { chainId } = await provider.getNetwork();

  const { feeCollector } = await feeCollectorFixture(owner);

  const { atomicizer, atomicize } = await atomicizerFixture(owner);

  const { staticMarket } = await staticMarketFixture(owner, atomicizer);

  const {
    registry,
    ownerProxy,
    registerOrGetProxy,
    getAuthenticatedProxy,
    registerProxy,
    registerProxyFor,
  } = await registryFixture(owner);

  const { globalMaker } = await globalMakerFixture(owner, registry);

  const { configurer } = await configurerFixture(owner as any);

  const {
    theGenerates,
    theGeneratesInterface,
    params,
    signMint,
    mintData,
    updateUnseenPayout,
    updatePaymentToken,
    updateSigner,
    createMintOrder,
    getUnseenSigner,
    getUnseenPayout,
    getDigestIsUsed,
    createAllowListAndGetProof,
    mintPublicTokens,
    mintSignedTokens,
    mintAllowListTokens,
    setMaxSupply,
    getMaxSupply,
    setBaseUri,
    setContractUri,
    setProvenanceHash,
    getProvenanceHash,
    emitBatchMetadataUpdate,
    updateRoyalties,
    getRoyaltyInfo,
    getBaseUri,
    getContractUri,
    getTokenUri,
    getPaymentToken,
    updateAllowList,
    getAllowListMerkleRoot,
  } = await theGeneratesFixture(configurer, owner);

  const {
    mockERC20,
    mint20,
    mintAndApproveERC20,
    WETH,
    depositETH,
    withdrawETH,
    mockERC721,
    set721ApprovalForAll,
    mint721,
    mint721s,
    mintAndApprove721,
    mockERC1155,
    set1155ApprovalForAll,
    mint1155,
    mintAndApprove1155,
    mockERC1155Two,
    tokenByType,
    createTransferWithApproval,
  } = await tokensFixture(owner as any);

  const {
    unseenVesting,
    vestingNFTDescriptor,
    createSchedule,
    createMultiSchedules,
    schedules,
  } = await unseenVestingFixture(owner, mockERC20);

  const {
    marketplace,
    timestamp,
    getAndVerifyOrderHash,
    signOrder,
    orderData,
    order,
    getHashToSign,
    validateOrderParameters,
    approveOrder,
    personalSign,
    getProtocolFees,
    cancelOrder,
    atomicMatch,
    placeBid,
    placeAsk,
    matchOrders,
    matchERC1155FeesForERC20,
    matchERC1155ForERC20,
    matchERC20ForERC20,
    matchERC721FeesForERC20,
    matchERC721ForERC20,
    matchLazy1155ForERC20,
    matchLazy721ForERC20,
    offerNFTForNFT,
    offerERC20ForERC20,
    offerLazyERC1155ForERC20,
    offerERC1155ForERC20,
    offerERC20ForERC1155,
    offerERC20ForERC721,
    offerERC20ForLazyERC1155,
    offerERC20ForLazyERC721,
    offerERC721ForERC20,
    ERC721ForMultiERC20,
    anyERC1155ForMultiERC20,
    anyMultiERC20ForERC1155,
    offerLazyERC721ForERC20,
    MultiERC20ForERC721,
    matchNFTForNFT,
  } = await marketplaceFixture(
    owner,
    registry,
    staticMarket,
    atomicizer,
    feeCollector
  );

  return {
    EIP1271WalletFactory,
    chainId,
    mockERC20,
    mockERC721,
    mockERC1155,
    mockERC1155Two,
    WETH,
    tokenByType,
    feeCollector,
    atomicizer,
    configurer,
    theGenerates,
    theGeneratesInterface,
    registry,
    ownerProxy,
    marketplace,
    staticMarket,
    globalMaker,
    unseenVesting,
    vestingNFTDescriptor,
    schedules,
    createSchedule,
    createMultiSchedules,
    registerOrGetProxy,
    getAuthenticatedProxy,
    mint20,
    mintAndApproveERC20,
    depositETH,
    withdrawETH,
    set721ApprovalForAll,
    mint721,
    mint721s,
    mintAndApprove721,
    set1155ApprovalForAll,
    mint1155,
    mintAndApprove1155,
    createTransferWithApproval,
    params,
    signMint,
    mintData,
    createAllowListAndGetProof,
    mintPublicTokens,
    mintSignedTokens,
    mintAllowListTokens,
    createMintOrder,
    setMaxSupply,
    getMaxSupply,
    setBaseUri,
    setContractUri,
    getAllowListMerkleRoot,
    updateUnseenPayout,
    updatePaymentToken,
    updateSigner,
    emitBatchMetadataUpdate,
    updateRoyalties,
    getUnseenSigner,
    getUnseenPayout,
    getDigestIsUsed,
    getRoyaltyInfo,
    getBaseUri,
    getContractUri,
    getTokenUri,
    getPaymentToken,
    setProvenanceHash,
    getProvenanceHash,
    updateAllowList,
    atomicize,
    registerProxy,
    registerProxyFor,
    getAndVerifyOrderHash,
    signOrder,
    orderData,
    order,
    getHashToSign,
    validateOrderParameters,
    approveOrder,
    personalSign,
    getProtocolFees,
    cancelOrder,
    atomicMatch,
    placeBid,
    placeAsk,
    matchOrders,
    matchERC1155FeesForERC20,
    matchERC1155ForERC20,
    matchERC20ForERC20,
    matchERC721FeesForERC20,
    matchERC721ForERC20,
    matchLazy1155ForERC20,
    matchLazy721ForERC20,
    offerNFTForNFT,
    matchNFTForNFT,
    offerERC20ForERC20,
    offerLazyERC1155ForERC20,
    offerERC1155ForERC20,
    offerERC20ForERC1155,
    offerERC20ForERC721,
    offerERC20ForLazyERC1155,
    offerERC20ForLazyERC721,
    offerERC721ForERC20,
    ERC721ForMultiERC20,
    anyERC1155ForMultiERC20,
    anyMultiERC20ForERC1155,
    offerLazyERC721ForERC20,
    MultiERC20ForERC721,
    timestamp,
  };
};

export type UnseenFixtures = Awaited<ReturnType<typeof unseenFixture>>;
