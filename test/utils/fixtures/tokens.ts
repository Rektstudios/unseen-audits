import { expect } from 'chai';

import type { JsonRpcSigner } from '@ethersproject/providers';
import type { MockERC1155, MockERC20, MockERC721, WETH } from '@typechained';
import type { BigNumber, BigNumberish, Contract, Wallet } from 'ethers';

import { ZERO_ADDRESS } from '@constants';
import { deployContract } from '@utils/contracts';
import { random128, randomBN, toBN } from '@utils/encoding';
import { minRandom } from '@utils/helpers';

export const fixtureERC20 = async (signer: JsonRpcSigner | Wallet) => {
  const mockERC20: MockERC20 = await deployContract('MockERC20', signer);

  const mint20 = async (
    signer: Wallet | Contract,
    tokenAmount: BigNumberish
  ) => {
    const amount = toBN(tokenAmount);
    await mockERC20.mint(signer.address, amount);
  };

  const mintAndApproveERC20 = async (
    signer: Wallet,
    spender: string,
    tokenAmount: BigNumberish
  ) => {
    const amount = toBN(tokenAmount);
    // signer mints ERC20
    await mockERC20.mint(signer.address, amount);

    // Approves spender to tokens
    await expect(mockERC20.connect(signer).approve(spender, amount))
      .to.emit(mockERC20, 'Approval')
      .withArgs(signer.address, spender, tokenAmount);
  };

  return {
    mockERC20,
    mint20,
    mintAndApproveERC20,
  };
};

export const fixtureWETH = async (signer: JsonRpcSigner | Wallet) => {
  const WETH: WETH = await deployContract('WETH', signer);

  const depositETH = async (
    signer: JsonRpcSigner | Wallet,
    tokenAmount: BigNumberish
  ) => {
    const amount = toBN(tokenAmount);
    await WETH.connect(signer).deposit({ value: amount });
  };

  const withdrawETH = async (tokenAmount: BigNumberish) => {
    const amount = toBN(tokenAmount);
    await WETH.connect(signer).withdraw(amount);
  };

  return {
    WETH,
    depositETH,
    withdrawETH,
  };
};

export const fixtureERC721 = async (signer: JsonRpcSigner | Wallet) => {
  const mockERC721: MockERC721 = await deployContract('MockERC721', signer);

  const set721ApprovalForAll = (
    signer: Wallet,
    spender: string,
    approved = true,
    contract = mockERC721
  ) => {
    return expect(contract.connect(signer).setApprovalForAll(spender, approved))
      .to.emit(contract, 'ApprovalForAll')
      .withArgs(signer.address, spender, approved);
  };

  const mint721 = async (signer: Wallet | Contract, id?: BigNumberish) => {
    const nftId = id ? toBN(id) : randomBN();
    await mockERC721['mint(address,uint256)'](signer.address, nftId);
    return nftId;
  };

  const mint721s = async (signer: Wallet | Contract, count: number) => {
    const arr = [];
    for (let i = 0; i < count; i++) arr.push(await mint721(signer));
    return arr;
  };

  const mintAndApprove721 = async (
    signer: Wallet,
    spender: string,
    id?: BigNumberish
  ) => {
    await set721ApprovalForAll(signer, spender, true);
    return mint721(signer, id);
  };

  return {
    mockERC721,
    set721ApprovalForAll,
    mint721,
    mint721s,
    mintAndApprove721,
  };
};

export const fixtureERC1155 = async (signer: JsonRpcSigner | Wallet) => {
  const mockERC1155: MockERC1155 = await deployContract('MockERC1155', signer);

  const set1155ApprovalForAll = (
    signer: Wallet,
    spender: string,
    approved = true,
    token = mockERC1155
  ) => {
    return expect(token.connect(signer).setApprovalForAll(spender, approved))
      .to.emit(token, 'ApprovalForAll')
      .withArgs(signer.address, spender, approved);
  };

  const mint1155 = async (
    signer: Wallet,
    multiplier = 1,
    token = mockERC1155,
    id?: BigNumberish,
    amt?: BigNumberish
  ) => {
    const nftId = id ? toBN(id) : randomBN();
    const amount = amt ? toBN(amt) : toBN(randomBN(4));
    await token['mint(address,uint256,uint256)'](
      signer.address,
      nftId,
      amount.mul(multiplier)
    );
    return { nftId, amount };
  };

  const mintAndApprove1155 = async (
    signer: Wallet,
    spender: string,
    multiplier = 1,
    id?: BigNumberish,
    amt?: BigNumberish
  ) => {
    const { nftId, amount } = await mint1155(
      signer,
      multiplier,
      mockERC1155,
      id,
      amt
    );
    await set1155ApprovalForAll(signer, spender, true);
    return { nftId, amount };
  };

  return {
    mockERC1155,
    set1155ApprovalForAll,
    mint1155,
    mintAndApprove1155,
  };
};

export const tokensFixture = async (signer: JsonRpcSigner | Wallet) => {
  const erc20 = await fixtureERC20(signer);
  const weth = await fixtureWETH(signer);
  const erc721 = await fixtureERC721(signer);
  const erc1155 = await fixtureERC1155(signer);
  const { mockERC1155: mockERC1155Two } = await fixtureERC1155(signer);
  const tokenByType = [
    {
      address: ZERO_ADDRESS,
    } as any, // ETH
    erc20.mockERC20,
    erc721.mockERC721,
    erc1155.mockERC1155,
  ];
  const createTransferWithApproval = async (
    contract: MockERC20 | MockERC1155 | MockERC721,
    receiver: Wallet,
    itemType: 0 | 1 | 2 | 3,
    approvalAddress: string,
    from: string,
    to: string
  ) => {
    let identifier: BigNumber = toBN(0);
    let amount: BigNumber = toBN(0);
    const token = contract.address;

    switch (itemType) {
      case 0:
        break;
      case 1: // ERC20
        amount = minRandom(100);
        await (contract as MockERC20).mint(receiver.address, amount);

        // Receiver approves spender to transfer tokens
        await expect(
          (contract as MockERC20)
            .connect(receiver)
            .approve(approvalAddress, amount)
        )
          .to.emit(contract, 'Approval')
          .withArgs(receiver.address, approvalAddress, amount);
        break;
      case 2: // ERC721
        amount = toBN(1);
        identifier = randomBN();
        await (contract as MockERC721)['mint(address,uint256)'](
          receiver.address,
          identifier
        );

        // Receiver approves spender to transfer tokens
        await erc721.set721ApprovalForAll(
          receiver,
          approvalAddress,
          true,
          contract as MockERC721
        );
        break;
      case 3: // ERC1155
        identifier = random128();
        amount = minRandom(1);
        await (contract as MockERC1155)['mint(address,uint256,uint256)'](
          receiver.address,
          identifier,
          amount
        );

        // Receiver approves spender to transfer tokens
        await erc1155.set1155ApprovalForAll(
          receiver,
          approvalAddress,
          true,
          contract as MockERC1155
        );
        break;
    }
    return { itemType, token, from, to, identifier, amount };
  };
  return {
    ...erc20,
    ...weth,
    ...erc721,
    ...erc1155,
    mockERC1155Two,
    tokenByType,
    createTransferWithApproval,
  };
};
