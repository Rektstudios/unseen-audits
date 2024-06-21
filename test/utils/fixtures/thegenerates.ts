import { expect } from 'chai';
import {
  _TypedDataEncoder,
  defaultAbiCoder,
  id,
  keccak256,
  parseEther,
  splitSignature,
  verifyTypedData,
} from 'ethers/lib/utils';
import { ethers } from 'hardhat';

import type {
  ITheGenerates,
  TheGenerates,
  TheGeneratesConfigurer,
} from '@typechained';
import type { AwaitedObject } from '@utils/helpers';
import type { Leaf, MintData, mintPayload } from '@utils/types';
import type { BigNumberish, BytesLike, Wallet } from 'ethers';
import type { ConfigStructs } from 'typechained/contracts/shim/Shim';

import { ITheGenerates__factory } from '@typechained';
import { allowListElementsBuffer, createMerkleTree } from '@utils/allow-list';
import { deployContract } from '@utils/contracts';
import { randomHex, toPaddedBuffer } from '@utils/encoding';
import { MintType } from '@utils/types';
import { EIP712Domain } from 'eip-712-types/domain';
import { signedMint } from 'eip-712-types/mint';

export const theGeneratesFixture = async (
  configurer: TheGeneratesConfigurer,
  owner: Wallet
) => {
  const theGenerates: TheGenerates = await deployContract(
    'TheGenerates',
    owner,
    configurer.address,
    owner.address
  );

  const theGeneratesInterface: ITheGenerates = ITheGenerates__factory.connect(
    theGenerates.address,
    owner
  );

  const mintSelector = id('mint(bytes)').substring(0, 10);

  const params = (): AwaitedObject<ConfigStructs.MintParamsStruct> => ({
    startPrice: parseEther('0.1'),
    endPrice: parseEther('0.1'),
    maxTokenSupplyForStage: 100,
    dropStageIndex: 1,
    startTime: Math.round(Date.now() / 1000) - 1000,
    endTime: Math.round(Date.now() / 1000) + 5000,
  });

  const mintData = async (
    mintPayload: mintPayload,
    contract: string = theGenerates.address
  ): Promise<MintData> =>
    EIP712Domain(
      'TheGenerates',
      contract,
      '1.0',
      (await ethers.provider.getNetwork()).chainId
    ).then((domain) => ({
      domain,
      types: signedMint,
      mintPayload,
    }));

  const signMint = async ({
    minter,
    mintParams = params(),
    salt = randomHex(),
    signer,
    compact = true,
  }: {
    minter: Wallet;
    mintParams?: AwaitedObject<ConfigStructs.MintParamsStruct>;
    salt?: string;
    signer: Wallet;
    compact?: boolean;
  }) => {
    const signedMint = {
      nftContract: theGenerates.address,
      minter: minter.address,
      mintParams,
      salt,
    };

    const { domain, types, mintPayload } = await mintData(signedMint);

    const digest = _TypedDataEncoder.hash(domain, types, mintPayload);

    const signature = await signer
      ._signTypedData(domain, types, mintPayload)
      .then((sig) => (compact ? splitSignature(sig).compact : sig));

    // Verify recovered address matches signer address
    const verifiedAddress = verifyTypedData(
      domain,
      types,
      mintPayload,
      signature
    );

    expect(verifiedAddress).to.eq(signer.address);

    return { signature, salt, digest, mintParams };
  };

  const updateUnseenPayout = async ({
    payoutAddress,
    basisPoints = 1_000,
    options = {},
  }: {
    payoutAddress: string;
    basisPoints?: BigNumberish;
    options?: {};
  }) => {
    return theGeneratesInterface.updateUnseenPayout(
      {
        payoutAddress,
        basisPoints,
      },
      options
    );
  };

  const updateSigner = async ({
    caller = owner,
    signer,
    options = {},
  }: {
    caller?: Wallet;
    signer: Wallet;
    options?: {};
  }) => {
    return theGeneratesInterface
      .connect(caller)
      .updateSigner(signer.address, options);
  };

  const updatePaymentToken = async ({
    caller = owner,
    token,
    options = {},
  }: {
    caller?: Wallet;
    token: string;
    options?: {};
  }) => {
    return theGeneratesInterface
      .connect(caller)
      .updatePaymentToken(token, options);
  };

  const setMaxSupply = async ({
    caller = owner,
    supply,
  }: {
    caller?: Wallet;
    supply: BigNumberish;
  }) => {
    return theGenerates.connect(caller).setMaxSupply(supply);
  };

  const setProvenanceHash = async ({
    caller = owner,
    hash,
  }: {
    caller?: Wallet;
    hash: BytesLike;
  }) => {
    return theGenerates.connect(caller).setProvenanceHash(hash);
  };

  const setBaseUri = async ({
    caller = owner,
    uri,
  }: {
    caller?: Wallet;
    uri: string;
  }) => {
    return theGenerates.connect(caller).setBaseURI(uri);
  };

  const setContractUri = async ({
    caller = owner,
    uri,
  }: {
    caller?: Wallet;
    uri: string;
  }) => {
    return theGenerates.connect(caller).setContractURI(uri);
  };

  const emitBatchMetadataUpdate = async ({
    caller = owner,
    start,
    end,
  }: {
    caller?: Wallet;
    start: number;
    end: number;
  }) => {
    return theGenerates.connect(caller).emitBatchMetadataUpdate(start, end);
  };

  const updateRoyalties = async ({
    caller = owner,
    treasury,
    bps,
  }: {
    caller?: Wallet;
    treasury: string;
    bps: number;
  }) => {
    return theGenerates.connect(caller).setDefaultRoyalty(treasury, bps);
  };

  const updateAllowList = async ({
    caller = owner,
    root,
  }: {
    caller?: Wallet;
    root: BytesLike;
  }) => {
    return theGeneratesInterface
      .connect(caller)
      .updateAllowList(root.toString());
  };

  const getProvenanceHash = async () => {
    return theGenerates.provenanceHash();
  };

  const getBaseUri = async () => {
    return theGenerates.baseURI();
  };

  const getContractUri = async () => {
    return theGenerates.contractURI();
  };

  const getMaxSupply = async () => {
    return theGenerates.maxSupply();
  };

  const getRoyaltyInfo = async (id: number, salePrice: number) => {
    return theGenerates.royaltyInfo(id, salePrice);
  };

  const getUnseenSigner = async () => {
    return theGeneratesInterface.getSigner();
  };

  const getUnseenPayout = async () => {
    return theGeneratesInterface.getUnseenPayout();
  };

  const getPaymentToken = async () => {
    return theGeneratesInterface.getPaymentToken();
  };

  const getAllowListMerkleRoot = async () => {
    return theGeneratesInterface.getAllowListMerkleRoot();
  };

  const getDigestIsUsed = async (digest: string) => {
    return theGeneratesInterface.getDigestIsUsed(digest);
  };

  const getTokenUri = async (tokenId: number) => {
    return theGenerates.tokenURI(tokenId);
  };

  const mintParamsBuffer = (mintParams: ConfigStructs.MintParamsStruct) =>
    Buffer.concat(
      [
        mintParams.startPrice,
        mintParams.endPrice,
        mintParams.startTime,
        mintParams.endTime,
        mintParams.maxTokenSupplyForStage,
        mintParams.dropStageIndex,
      ].map(toPaddedBuffer)
    );

  const createMintOrder = async ({
    minter,
    mintType,
    quantity = 1,
    mintParams = params(),
    // Allow list
    proof,
    // Signed
    salt,
    signature,
    // Season
    publicDropIndex,
  }: {
    quantity?: BigNumberish;
    minter: string;
    mintType: MintType;
    startTime?: number;
    endTime?: number;
    mintParams?: AwaitedObject<ConfigStructs.MintParamsStruct>;
    proof?: string[];
    signature?: string;
    salt?: string;
    publicDropIndex?: number;
  }) => {
    let extraDataBuffer = Buffer.concat([
      Buffer.from([mintType]),
      Buffer.from(minter.slice(2), 'hex'),
      Buffer.from(quantity.toString(16).padStart(64, '0'), 'hex'),
    ]);

    switch (mintType) {
      case MintType.PUBLIC:
        if (publicDropIndex !== undefined) {
          extraDataBuffer = Buffer.concat([
            extraDataBuffer,
            Buffer.from(publicDropIndex.toString(16).padStart(2, '0'), 'hex'),
          ]);
        }
        break;
      case MintType.ALLOW_LIST:
        if (!mintParams)
          throw new Error('Mint params required for allow list mint');
        if (!proof) throw new Error('Proof required for allow list mint');
        extraDataBuffer = Buffer.concat([
          extraDataBuffer,
          mintParamsBuffer(mintParams),
          ...proof.map((p) => Buffer.from(p.slice(2), 'hex')),
        ]);
        break;
      case MintType.SIGNED:
        if (!mintParams)
          throw new Error('Mint params required for signed mint');
        if (!salt) throw new Error('Salt required for signed mint');
        if (!signature) throw new Error('Signature required for signed mint');
        extraDataBuffer = Buffer.concat([
          extraDataBuffer,
          mintParamsBuffer(mintParams),
          Buffer.from(salt.slice(2), 'hex'),
          Buffer.from(signature.slice(2), 'hex'),
        ]);
        break;
      default:
        break;
    }

    const context = '0x' + extraDataBuffer.toString('hex');
    const encodedParams = defaultAbiCoder.encode(['bytes'], [context]);
    const data = mintSelector + encodedParams.slice(2);

    return { context, data };
  };

  const mintSignedTokens = async ({
    minter,
    signer,
    quantity = 1,
  }: {
    minter: Wallet;
    signer: Wallet;
    quantity?: number;
  }) => {
    const transactions = [];
    let currentNonce = await minter.getTransactionCount();

    for (let i = 0; i < quantity; i++) {
      const { signature, salt, mintParams } = await signMint({
        minter,
        signer,
      });

      const { data } = await createMintOrder({
        quantity,
        publicDropIndex: undefined,
        minter: minter.address,
        mintType: MintType.SIGNED,
        signature,
        salt,
        mintParams,
      });

      // Create a transaction for each mint and push it to the transactions array
      const transaction = minter.sendTransaction({
        to: theGenerates.address,
        data,
        gasLimit: 180_000,
        nonce: currentNonce,
      });

      transactions.push(transaction);
      currentNonce++;
    }

    // If only one token is minted, return the single transaction instead of an array
    if (quantity === 1) {
      return transactions[0]; // Return the single transaction promise
    }

    return Promise.all(transactions); // Return promises for all transactions
  };

  const mintAllowListTokens = async ({
    minters,
    quantity = 1,
  }: {
    minters: Wallet[];
    quantity?: number;
  }) => {
    const { root, proof } = await createAllowListAndGetProof(minters, params());

    // Update the allow list of the token.
    await theGeneratesInterface.updateAllowList(root);

    const { data } = await createMintOrder({
      quantity,
      publicDropIndex: undefined,
      proof,
      minter: minters[0].address,
      mintType: MintType.ALLOW_LIST,
      mintParams: params(),
    });

    // Create a transaction for each mint and push it to the transactions array
    const transaction = await minters[0].sendTransaction({
      to: theGenerates.address,
      data,
      gasLimit: 180_000,
    });

    return transaction;
  };

  const mintPublicTokens = async ({
    minter,
    quantity = 1,
  }: {
    minter: Wallet;
    quantity?: number;
  }) => {
    const prevPublicDrop = await (
      theGeneratesInterface as ITheGenerates
    ).getPublicDrop();

    const temporaryPublicDrop: any = {
      startPrice: 0,
      endPrice: 0,
      startTime: Math.round(Date.now() / 1000) - 1000,
      endTime: Math.round(Date.now() / 1000) + 5000,
    };

    await (theGeneratesInterface as ITheGenerates).updatePublicDrop(
      temporaryPublicDrop
    );

    const { data } = await createMintOrder({
      quantity,
      publicDropIndex: undefined,
      minter: minter.address,
      mintType: MintType.PUBLIC,
    });

    const transaction = await minter.sendTransaction({
      to: theGenerates.address,
      data,
      gasLimit: 180_000,
    });

    await (theGeneratesInterface as ITheGenerates).updatePublicDrop(
      prevPublicDrop
    );

    return transaction;
  };

  const createAllowListAndGetProof = async (
    minters: Wallet[],
    mintParams: ConfigStructs.MintParamsStruct,
    minterIndexForProof = 0
  ) => {
    // Construct the leaves.
    const leaves = minters.map(
      (minter) => [minter.address, mintParams] as Leaf
    );

    // Encode the leaves.
    const elementsBuffer = allowListElementsBuffer(leaves);

    // Construct a merkle tree from the allow list elements.
    const merkleTree = createMerkleTree(elementsBuffer);

    // Get the merkle root.
    const root = merkleTree.getHexRoot();

    // Get the leaf at the specified index.
    const targetLeaf = Buffer.from(
      keccak256(elementsBuffer[minterIndexForProof]).slice(2),
      'hex'
    );
    const leafIndex = merkleTree.getLeafIndex(targetLeaf);
    const leaf = merkleTree.getLeaf(leafIndex);

    // Get the proof of the leaf to pass to the mint order.
    const proof = merkleTree.getHexProof(leaf);

    return { root, proof };
  };

  return {
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
    setMaxSupply,
    setBaseUri,
    setContractUri,
    setProvenanceHash,
    getProvenanceHash,
    emitBatchMetadataUpdate,
    updateRoyalties,
    getRoyaltyInfo,
    getBaseUri,
    getMaxSupply,
    getContractUri,
    getTokenUri,
    getAllowListMerkleRoot,
    createAllowListAndGetProof,
    mintPublicTokens,
    mintSignedTokens,
    mintAllowListTokens,
    getPaymentToken,
    updateAllowList,
  };
};
