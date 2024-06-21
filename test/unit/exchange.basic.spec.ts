import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { assert, expect } from 'chai';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type {
  FeeCollector,
  UnseenExchange,
  UnseenRegistry,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { OrderParameters } from '@utils/types';
import type { Wallet } from 'ethers';

import { NULL_SIG, ZERO_ADDRESS, ZERO_BYTES32 } from '@constants';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/helpers';
import { clock, duration } from '@utils/time';
import { packData } from 'utils/helper-functions';

describe(`Exchange Basic - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let marketplace: UnseenExchange;
  let feeCollector: FeeCollector;
  let registry: UnseenRegistry;

  let getAndVerifyOrderHash: UnseenFixtures['getAndVerifyOrderHash'];
  let signOrder: UnseenFixtures['signOrder'];
  let order: UnseenFixtures['order'];
  let getHashToSign: UnseenFixtures['getHashToSign'];
  let validateOrderParameters: UnseenFixtures['validateOrderParameters'];
  let approveOrder: UnseenFixtures['approveOrder'];
  let personalSign: UnseenFixtures['personalSign'];
  let cancelOrder: UnseenFixtures['cancelOrder'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;
  let bobOrder: OrderParameters;

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
  });

  beforeEach(async function () {
    ({
      marketplace,
      feeCollector,
      registry,
      getAndVerifyOrderHash,
      signOrder,
      order,
      getHashToSign,
      validateOrderParameters,
      approveOrder,
      personalSign,
      cancelOrder,
    } = await unseenFixture(owner));

    bobOrder = order(bob);
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('UnseenExchange', ...args);
      if (expectedError) {
        try {
          await expect(deployment).to.be.revertedWith(expectedError);
        } catch {
          await expect(deployment).to.be.revertedWithCustomError(
            marketplace,
            expectedError
          );
        }
      } else {
        const marketplace = await deployment;
        expect(await marketplace.owner()).to.eq(owner.address);
        expect(await marketplace.protocolFeeRecipient()).to.eq(
          feeCollector.address
        );
        expect(await marketplace.pFee()).to.eq(500);
        expect(await marketplace.registries(registry.address)).to.eq(true);
      }
    };
    it('reverts if owner or configurer is set to address 0', async function () {
      const t = async (
        registryToSet: string[],
        ownerToSet: string,
        treasury: string,
        pFee: number,
        expectedError: string
      ) => {
        await testConstructor(
          expectedError,
          registryToSet,
          ownerToSet,
          treasury,
          pFee
        );
      };
      await t(
        [],
        owner.address,
        feeCollector.address,
        500,
        'MinimumOneAddress'
      );
      await t(
        [ZERO_ADDRESS],
        owner.address,
        feeCollector.address,
        500,
        'RegistryIsZeroAddress'
      );
      await t(
        [registry.address],
        owner.address,
        ZERO_ADDRESS,
        500,
        'TreasuryIsZeroAddress'
      );
      await t(
        [registry.address],
        ZERO_ADDRESS,
        feeCollector.address,
        500,
        'NewOwnerIsZeroAddress'
      );
    });
  });
  context('marketplace access control', function () {
    it('only owner can change protocol fees params', async function () {
      await expect(
        marketplace.connect(bob).changeProtocolFeeRecipient(bob.address)
      ).to.be.revertedWithCustomError(marketplace, 'Unauthorized');
      await expect(
        marketplace.changeProtocolFeeRecipient(feeCollector.address)
      ).to.be.revertedWithCustomError(marketplace, 'AddressIsAlreadySet');
      await expect(
        marketplace.changeProtocolFeeRecipient(ZERO_ADDRESS)
      ).to.be.revertedWithCustomError(marketplace, 'AddressCannotBeZero');
      await expect(marketplace.changeProtocolFeeRecipient(bob.address))
        .to.emit(marketplace, 'ProtocolFeeRecipientUpdated')
        .withArgs(bob.address);

      await expect(
        marketplace.connect(bob).changeProtocolFee(500)
      ).to.be.revertedWithCustomError(marketplace, 'Unauthorized');
      await expect(
        marketplace.changeProtocolFee(500)
      ).to.be.revertedWithCustomError(marketplace, 'ValueIsAlreadySet');
      await expect(
        marketplace.changeProtocolFee(1001)
      ).to.be.revertedWithCustomError(marketplace, 'FeeMismatch');
      await marketplace.changeProtocolFee(750);
      expect(await marketplace.pFee()).to.eq(750);
    });
  });
  context('order hash', async function () {
    it('hashes order correctly', async function () {
      expect(await getAndVerifyOrderHash({ maker: bob })).to.not.eq(
        ZERO_BYTES32
      );
    });
    it('hashes order to sign correctly', async function () {
      expect(await getHashToSign({ maker: bob })).to.have.property('hashToSign')
        .that.is.not.empty;
    });
    it('does not allow set fill to same fill', async function () {
      const { orderHash } = await getAndVerifyOrderHash({ maker: bob });

      await expect(
        marketplace.setOrderFill(orderHash, '0')
      ).to.be.revertedWithCustomError(
        marketplace,
        'FillIsSetToTheDesiredValue'
      );
    });
  });
  context('order validation', async function () {
    it('validates valid order parameters', async function () {
      expect(await validateOrderParameters(bobOrder)).to.eq(true);
    });
    it('does not validate order parameters with invalid staticTarget', async function () {
      expect(
        await validateOrderParameters({
          ...bobOrder,
          staticTarget: ZERO_ADDRESS,
        })
      ).to.eq(false);
    });
    it('does not validate order parameters with listingTime > now', async function () {
      const timestamp = await clock.timestamp();
      assert.isFalse(
        await validateOrderParameters({
          ...bobOrder,
          extraData: packData(
            timestamp.add(duration.hours(1)),
            timestamp.add(duration.hours(100)),
            randomHex(16)
          ),
        }),
        'Should not have validated'
      );
    });
    it('does not validate order parameters with expirationTime < now', async function () {
      const timestamp = await clock.timestamp();
      assert.isFalse(
        await validateOrderParameters({
          ...bobOrder,
          extraData: packData(
            duration.hours(0),
            timestamp.sub(duration.hours(1)),
            randomHex(16)
          ),
        }),
        'Should not have validated'
      );
    });
    it('validates valid authorization by signature (signTypedData)', async function () {
      const { signature: sig, structHash } = await signOrder({
        maker: bob,
        orderParams_: bobOrder,
      });
      assert.isTrue(
        await marketplace.validateOrderAuthorization(
          structHash,
          bob.address,
          defaultAbiCoder.encode(
            ['uint8', 'bytes32', 'bytes32'],
            [sig.v, sig.r, sig.s]
          ),
          []
        ),
        'Should have validated'
      );
    });
    it('validates valid authorization by signature (personal_sign)', async function () {
      const { signature: sig, suffix } = await personalSign({
        maker: bob,
        orderParams: bobOrder,
      });
      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: bobOrder,
      });
      assert.isTrue(
        await marketplace.validateOrderAuthorization(
          orderHash,
          bob.address,
          defaultAbiCoder.encode(
            ['uint8', 'bytes32', 'bytes32'],
            [sig.v, sig.r, sig.s]
          ) + (suffix || ''),
          []
        ),
        'Should have validated'
      );
    });
    it('does not validate authorization by signature wih different prefix (personal_sign)', async function () {
      const { signature: sig } = await personalSign({
        maker: bob,
        orderParams: bobOrder,
      });
      const prefix = '1922';
      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: bobOrder,
      });
      assert.isFalse(
        await marketplace.validateOrderAuthorization(
          orderHash,
          bob.address,
          defaultAbiCoder.encode(
            ['uint8', 'bytes32', 'bytes32'],
            [sig.v, sig.r, sig.s]
          ) + prefix,
          []
        ),
        'Should have validated'
      );
    });
  });
  context('approval authorization', async function () {
    it('does not allow approval twice', async function () {
      await approveOrder({ maker: bob, orderParams: bobOrder });

      await expect(
        approveOrder({ maker: bob, orderParams: bobOrder })
      ).to.be.revertedWithCustomError(
        marketplace,
        'OrderHasAlreadyBeenApproved'
      );
    });
    it('does not allow approval from another user', async function () {
      await expect(
        approveOrder({
          maker: alice,
          orderParams: bobOrder,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SenderNotAuthorized');
    });
    it('validates valid authorization by approval', async function () {
      await approveOrder({ maker: bob, orderParams: bobOrder });
      const { orderHash } = await getAndVerifyOrderHash({
        maker: bob,
        orderParams_: bobOrder,
      });
      assert.isTrue(
        await marketplace.validateOrderAuthorization(
          orderHash,
          bob.address,
          ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'bytes32', 'bytes32'],
            [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
          ),
          []
        )
      );
    });
    it('validates valid authorization by hash-approval', async function () {
      await approveOrder({ maker: bob });
      const { orderHash } = await getAndVerifyOrderHash({ maker: bob });
      assert.isTrue(
        await marketplace
          .connect(alice)
          .validateOrderAuthorization(
            orderHash,
            alice.address,
            ethers.utils.defaultAbiCoder.encode(
              ['uint8', 'bytes32', 'bytes32'],
              [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
            ),
            []
          ),
        'Should have validated'
      );
    });
    it('validates valid authorization by maker', async function () {
      const { orderHash } = await getAndVerifyOrderHash({ maker: bob });
      assert.isTrue(
        await marketplace
          .connect(bob)
          .validateOrderAuthorization(
            orderHash,
            bob.address,
            ethers.utils.defaultAbiCoder.encode(
              ['uint8', 'bytes32', 'bytes32'],
              [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
            ),
            []
          ),
        'Should have validated'
      );
    });
    it('validates valid authorization by cache', async function () {
      const { orderHash } = await getAndVerifyOrderHash({ maker: bob });
      await marketplace.connect(bob).setOrderFill(orderHash, '2');
      assert.isTrue(
        await marketplace.validateOrderAuthorization(
          orderHash,
          bob.address,
          defaultAbiCoder.encode(
            ['uint8', 'bytes32', 'bytes32'],
            [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
          ),
          []
        ),
        'Should have validated'
      );
    });
    it('does not validate authorization without signature', async function () {
      const { orderHash } = await getAndVerifyOrderHash({ maker: bob });
      assert.isFalse(
        await marketplace.validateOrderAuthorization(
          orderHash,
          bob.address,
          ethers.utils.defaultAbiCoder.encode(
            ['uint8', 'bytes32', 'bytes32'],
            [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
          ),
          []
        ),
        'Should not have validated'
      );
    });
    it('does not validate cancelled order', async function () {
      await cancelOrder({ maker: bob, orderParams: bobOrder });
      assert.isFalse(
        await validateOrderParameters(bobOrder),
        'Should not have validated'
      );
    });
  });
  context('order cancelation', async function () {
    it('allows order cancellation by maker', async function () {
      const { orderHash, orderParams_ } = await getAndVerifyOrderHash({
        maker: bob,
      });
      await expect(cancelOrder({ maker: bob, orderParams: orderParams_ }))
        .to.emit(marketplace, 'OrderFillChanged')
        .withArgs(orderHash, bob.address, orderParams_.maximumFill);
      expect(await marketplace.fills(bob.address, orderHash)).to.eq(
        orderParams_.maximumFill
      );
    });
    it('does not allow order cancellation by non-maker', async function () {
      const { orderHash } = await getAndVerifyOrderHash({ maker: bob });
      await marketplace.setOrderFill(orderHash, '2');
      expect(await marketplace.fills(bob.address, orderHash)).to.eq(0);
      expect(await marketplace.fills(owner.address, orderHash)).to.eq(2);
    });
  });
});
