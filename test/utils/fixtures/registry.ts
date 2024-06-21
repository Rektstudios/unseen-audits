import { expect } from 'chai';

import type { AuthenticatedProxy, UnseenRegistry } from '@typechained';
import type { Wallet } from 'ethers';

import { ZERO_ADDRESS } from '@constants';
import { AuthenticatedProxy__factory } from '@typechained';
import { deployContract } from '@utils/contracts';

export const registryFixture = async (owner: Wallet) => {
  const registry: UnseenRegistry = await deployContract(
    'UnseenRegistry',
    owner,
    owner.address
  );

  const registerProxy = async (signer: Wallet) => {
    await registry.connect(signer).registerProxy();
    return registry.proxies(signer.address);
  };

  const registerProxyFor = async (signer: Wallet, address: string) => {
    await registry.connect(signer).registerProxyFor(address);
    return registry.proxies(address);
  };

  await registerProxy(owner);
  const ownerProxy = await registry.proxies(owner.address);

  const registerOrGetProxy = async (signer: Wallet) => {
    let proxy = await registry.proxies(signer.address);
    if (proxy == ZERO_ADDRESS) {
      await registry.connect(signer).registerProxy();
      proxy = await registry.proxies(signer.address);
    }
    expect(proxy).to.not.eq(ZERO_ADDRESS);
    return { proxy };
  };

  const getAuthenticatedProxy = async (signer: Wallet) => {
    const { proxy } = await registerOrGetProxy(signer);
    const authProxy: AuthenticatedProxy = AuthenticatedProxy__factory.connect(
      proxy,
      signer
    );
    return { proxy, authProxy };
  };

  return {
    registry,
    ownerProxy,
    registerOrGetProxy,
    getAuthenticatedProxy,
    registerProxy,
    registerProxyFor,
  };
};
