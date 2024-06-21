import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { assert, expect } from 'chai';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type { UnseenFixtures } from '@utils/fixtures';
import type { Wallet } from 'ethers';

import { ZERO_ADDRESS } from '@constants';
import {
  type MockERC1271,
  type MockERC20,
  type MockERC721,
  type MockSmartContractWallet,
  type UnseenExchange,
  type UnseenRegistry,
} from '@typechained';
import { deployContract as deploy } from '@utils/contracts';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/helpers';

describe(`Exchange Registry - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let mockERC721: MockERC721;
  let mock1271: MockERC1271;
  let registry: UnseenRegistry;
  let marketplace: UnseenExchange;
  let scWallet: MockSmartContractWallet;

  let registerProxy: UnseenFixtures['registerProxy'];
  let registerProxyFor: UnseenFixtures['registerProxyFor'];
  let getAuthenticatedProxy: UnseenFixtures['getAuthenticatedProxy'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;

  let ownerProxy: string;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, alice };
  }

  before(async () => {
    ({ owner, bob, alice } = await loadFixture(setupFixture));

    scWallet = await deploy('MockSmartContractWallet', owner);
    mock1271 = await deploy('MockERC1271', owner);
  });

  beforeEach(async function () {
    ({
      mockERC20,
      mockERC721,
      registry,
      ownerProxy,
      marketplace,
      getAuthenticatedProxy,
      registerProxy,
      registerProxyFor,
    } = await unseenFixture(owner));

    await registry.grantInitialExchangeAuthentication(marketplace.address);
    await mockERC20.mint(bob.address, 1000);
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('UnseenRegistry', ...args);
      if (expectedError)
        await expect(deployment).to.be.revertedWithCustomError(
          registry,
          expectedError
        );
      else {
        const registry = await deployment;
        expect(await registry.owner()).to.eq(owner.address);
        expect(await registry.initialAddressSet()).to.eq(false);
        await registry
          .connect(owner)
          .grantInitialExchangeAuthentication(marketplace.address);
        await expect(
          registry
            .connect(owner)
            .grantInitialExchangeAuthentication(marketplace.address)
        ).to.be.revertedWithCustomError(registry, 'AddressAlreadySet');
        expect(await registry.initialAddressSet()).to.eq(true);
        expect(await registry.authProxyImplementation()).to.not.eq(
          ZERO_ADDRESS
        );
      }
    };

    it('reverts if ownerToSet is address 0', async function () {
      const t = async (ownerToSet: string, expectedError: string) => {
        await testConstructor(expectedError, ownerToSet);
      };
      await t(ZERO_ADDRESS, 'NewOwnerIsZeroAddress');
      await t(owner.address, '');
    });
  });

  context('ownership and authority', function () {
    it('only owner can grant initial authentication ', async function () {
      await expect(
        registry
          .connect(bob)
          .grantInitialExchangeAuthentication(marketplace.address)
      ).to.be.revertedWithCustomError(registry, 'Unauthorized');
    });
    it('only owner can grant authentication', async function () {
      await expect(
        registry.connect(bob).grantAuthentication(marketplace.address)
      ).to.be.revertedWithCustomError(registry, 'Unauthorized');
      await expect(
        registry.grantAuthentication(marketplace.address)
      ).to.be.revertedWithCustomError(registry, 'ContractAlreadyAllowed');
      await expect(registry.grantAuthentication(bob.address))
        .to.emit(registry, 'AuthGranted')
        .withArgs(bob.address);
    });
    it('only owner can revoke authentication', async function () {
      await expect(
        registry.connect(bob).revokeAuthentication(marketplace.address)
      ).to.be.revertedWithCustomError(registry, 'Unauthorized');
      await expect(registry.revokeAuthentication(marketplace.address))
        .to.emit(registry, 'AuthRevoked')
        .withArgs(marketplace.address);
      await expect(
        registry.revokeAuthentication(marketplace.address)
      ).to.be.revertedWithCustomError(registry, 'ContractNotAllowed');
    });
  });

  context('registry', function () {
    it('register a proxy for eoa', async function () {
      expect(await registerProxy(bob)).to.not.eq(ZERO_ADDRESS);
    });
    it('register a proxy for mockERC1271', async function () {
      expect(await registerProxyFor(bob, mock1271.address)).to.not.eq(
        ZERO_ADDRESS
      );
    });
    it('register a proxy for smart contract wallet', async function () {
      expect(await registerProxyFor(bob, scWallet.address)).to.not.eq(
        ZERO_ADDRESS
      );
      const scWalletProxy = await registry.proxies(scWallet.address);
      assert.isOk(
        await scWallet.setApprovalForAll(
          scWalletProxy,
          mockERC721.address,
          true
        )
      );
    });
    it('proxy cannot receive receive ehters', async function () {
      await expect(
        owner.sendTransaction({
          to: ownerProxy,
          value: parseEther('1'),
          gasLimit: 100_000,
        })
      ).to.be.reverted;
    });
    it('allows proxy registration for another user', async function () {
      await registry.connect(bob).registerProxyFor(alice.address);
      const proxy = await registry.proxies(alice.address);
      expect(proxy).to.not.eq(ZERO_ADDRESS);
    });
    it('does not allow proxy registration for another user twice', async function () {
      await registry.connect(bob).registerProxyFor(alice.address);

      await expect(
        registry.connect(bob).registerProxyFor(alice.address)
      ).to.be.revertedWithCustomError(registry, 'UserAlreadyHasProxy');
    });
    it('allows proxy revocation', async function () {
      const { authProxy } = await getAuthenticatedProxy(bob);

      expect(await authProxy.owner()).to.eq(bob.address);
      expect(await authProxy.connect(bob).setRevoke(true))
        .to.emit(authProxy, 'Revoked')
        .withArgs(true);
    });
    it('does not allow proxy revocation from another account', async function () {
      const { authProxy } = await getAuthenticatedProxy(bob);

      await expect(
        authProxy.connect(alice).setRevoke(true, { gasLimit: 100_000 })
      ).to.be.revertedWithCustomError(authProxy, 'NotAuthorized');
    });
    it('should not allow proxy reinitialization', async function () {
      const { authProxy } = await getAuthenticatedProxy(bob);
      await expect(
        authProxy.initialize(
          registry.address,
          registry.address,
          authProxy.address,
          {
            gasLimit: 100_000,
          }
        )
      ).to.be.revertedWithCustomError(authProxy, 'AlreadyInitialized');
    });
    it('allows proxy ownership transfer', async function () {
      const { proxy, authProxy } = await getAuthenticatedProxy(bob);

      let owner = await authProxy.owner();
      await expect(
        authProxy
          .connect(alice)
          .transferProxyOwnership(alice.address, { gasLimit: 100_000 })
      ).to.be.revertedWithCustomError(authProxy, 'NotAuthorized');
      await authProxy.connect(bob).transferProxyOwnership(alice.address);

      const { proxy: AliceProxy } = await getAuthenticatedProxy(alice);

      expect(proxy).to.eq(AliceProxy);

      owner = await authProxy.owner();
      expect(owner).to.eq(alice.address);
    });
    it('allows ownership and access transfer', async function () {
      const { proxy, authProxy } = await getAuthenticatedProxy(bob);

      await expect(
        registry.connect(bob).transferAccessTo(bob.address, alice.address)
      ).to.be.revertedWithCustomError(registry, 'ProxyTransferNotAllowed');

      await expect(
        authProxy
          .connect(bob)
          .transferProxyOwnership(bob.address, { gasLimit: 100_000 })
      ).to.be.revertedWithCustomError(
        registry,
        'ProxyTransferDestinationExists'
      );

      await expect(
        authProxy
          .connect(bob)
          .transferProxyOwnership(ZERO_ADDRESS, { gasLimit: 100_000 })
      ).to.be.revertedWithCustomError(authProxy, 'OwnerIsZeroAddress');

      await expect(authProxy.connect(bob).transferProxyOwnership(alice.address))
        .to.not.be.reverted;

      expect(await registry.proxies(alice.address)).to.eq(proxy);

      expect(await authProxy.owner()).to.eq(alice.address);
    });
  });
});
