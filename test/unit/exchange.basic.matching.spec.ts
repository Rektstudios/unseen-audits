import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type {
  MockERC1271,
  MockUnseenStatic,
  UnseenExchange,
  UnseenRegistry,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { Call, OrderParameters } from '@utils/types';
import type { BigNumber, BigNumberish, Wallet } from 'ethers';

import { NULL_SIG, noChecks } from '@constants';
import { deployContract as deploy } from '@utils/contracts';
import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { duration } from '@utils/time';
import { packData } from 'utils/helper-functions';

describe(`marketplace Basic Matching - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let marketplace: UnseenExchange;
  let registry: UnseenRegistry;
  let staticMarket: MockUnseenStatic;
  let mock1271: MockERC1271;

  let cancelOrder: UnseenFixtures['cancelOrder'];
  let registerOrGetProxy: UnseenFixtures['registerOrGetProxy'];
  let registerProxyFor: UnseenFixtures['registerProxyFor'];
  let atomicMatch: UnseenFixtures['atomicMatch'];
  let orderData: UnseenFixtures['order'];
  let signOrder: UnseenFixtures['signOrder'];
  let personalSign: UnseenFixtures['personalSign'];
  let approveOrder: UnseenFixtures['approveOrder'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;
  let sender: Wallet;

  let order: OrderParameters;

  let timestamp: BigNumber;
  let extradata: BigNumberish;
  let call: Call;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    sender = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice, sender]) {
      await faucet(wallet.address, provider);
    }

    return { owner, bob, alice, sender };
  }

  before(async () => {
    ({ owner, bob, alice, sender } = await loadFixture(setupFixture));

    ({
      marketplace,
      registry,
      staticMarket,
      cancelOrder,
      registerOrGetProxy,
      order: orderData,
      atomicMatch,
      signOrder,
      personalSign,
      approveOrder,
      registerProxyFor,
    } = await unseenFixture(owner));

    mock1271 = await deploy('MockERC1271', bob);
    await registry.grantInitialExchangeAuthentication(marketplace.address);

    await registerOrGetProxy(bob);
    await registerOrGetProxy(alice);
    await registerProxyFor(owner, mock1271.address);
  });

  beforeEach(async function () {
    order = orderData(bob);
    ({ timestamp } = await unseenFixture(owner));
    extradata = packData(
      timestamp,
      timestamp.add(duration.hours(20)),
      randomHex(16)
    );
    call = {
      target: staticMarket.address,
      howToCall: 0,
      data: noChecks,
    };
  });

  context('marketplace basic matching', async function () {
    it('should not match orders with wrong resgitry', async function () {
      await expect(
        atomicMatch({
          sender: bob,
          order: { ...order, registry: bob.address },
          sig: NULL_SIG,
          call,
          counterorder: { ...order, extraData: extradata },
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(marketplace, 'RegistryNotAdded');
    });
    it('should not self match orders', async function () {
      await expect(
        atomicMatch({
          sender: bob,
          order,
          sig: NULL_SIG,
          call,
          counterorder: order,
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SelfMatchingIsProhibited');
    });
    it('does not match Reentrant orders', async function () {
      const data = marketplace.interface.encodeFunctionData('atomicMatch', [
        [
          order.registry,
          order.maker,
          order.executer,
          order.staticTarget,
          order.maximumFill,
          order.extraData,
          call.target,
          order.registry,
          order.maker,
          order.executer,
          order.staticTarget,
          order.maximumFill,
          order.extraData,
          call.target,
        ],
        [order.staticSelector, order.staticSelector],
        order.staticExtradata,
        call.data,
        order.staticExtradata,
        call.data,
        [call.howToCall, call.howToCall],
        defaultAbiCoder.encode(
          ['bytes', 'bytes'],
          [
            defaultAbiCoder.encode(
              ['uint8', 'bytes32', 'bytes32'],
              [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
            ),
            defaultAbiCoder.encode(
              ['uint8', 'bytes32', 'bytes32'],
              [NULL_SIG.v, NULL_SIG.r, NULL_SIG.s]
            ),
          ]
        ),
      ]);
      const secondCall = {
        target: marketplace.address,
        howToCall: 0,
        data,
      };
      await expect(
        atomicMatch({
          sender: bob,
          order,
          sig: NULL_SIG,
          call,
          counterorder: { ...order, extraData: extradata },
          countersig: NULL_SIG,
          countercall: secondCall,
        })
      ).to.be.revertedWithCustomError(marketplace, 'SecondCallFailed');
    });
    it('Matches any orders, ERC1271', async function () {
      const firstOrder = {
        ...order,
        maker: mock1271.address,
        executer: mock1271.address,
      };
      const { signature } = await signOrder({
        maker: bob,
        orderParams_: firstOrder,
      });
      await expect(
        atomicMatch({
          sender: bob,
          order: firstOrder,
          sig: signature,
          call,
          counterorder: order,
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.emit(marketplace, 'OrdersMatched');
    });
    it('does not match any orders with bad sig, ERC1271', async function () {
      const firstOrder = {
        ...order,
        maker: mock1271.address,
        executer: mock1271.address,
      };
      const { signature } = await signOrder({
        maker: bob,
        orderParams_: firstOrder,
      });
      await expect(
        atomicMatch({
          sender: bob,
          order: firstOrder,
          sig: { ...signature, v: 0 },
          call,
          counterorder: order,
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'FirstOrderFailedAuthorization'
      );
    });
    it('Matches orders with signature', async function () {
      const firstOrder = {
        ...order,
        extraData: extradata,
      };
      const [{ signature: sigFirstOrder }, { signature: sigSecondOrder }] =
        await Promise.all([
          signOrder({ maker: bob, orderParams_: firstOrder }),
          signOrder({ maker: bob, orderParams_: order }),
        ]);
      await expect(
        atomicMatch({
          sender,
          order: firstOrder,
          sig: sigFirstOrder,
          call,
          counterorder: order,
          countersig: sigSecondOrder,
          countercall: call,
        })
      ).to.emit(marketplace, 'OrdersMatched');
    });
    it('should not match with signature twice', async function () {
      const firstOrder = {
        ...order,
        extraData: extradata,
      };
      const [{ signature: sigFirstOrder }, { signature: sigSecondOrder }] =
        await Promise.all([
          signOrder({ maker: bob, orderParams_: firstOrder }),
          signOrder({ maker: bob, orderParams_: order }),
        ]);
      await atomicMatch({
        sender,
        order: firstOrder,
        sig: sigFirstOrder,
        call,
        counterorder: order,
        countersig: sigSecondOrder,
        countercall: call,
      });
      await expect(
        atomicMatch({
          sender,
          order: firstOrder,
          sig: sigFirstOrder,
          call,
          counterorder: order,
          countersig: sigSecondOrder,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'FirstOrderHasInvalidParams'
      );
    });
    it('should match orders with approval', async function () {
      const secondOrder = orderData(alice);
      await Promise.all([
        approveOrder({ maker: bob, orderParams: order }),
        approveOrder({ maker: alice, orderParams: secondOrder }),
      ]);
      await expect(
        atomicMatch({
          sender,
          order,
          sig: NULL_SIG,
          call,
          counterorder: secondOrder,
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.emit(marketplace, 'OrdersMatched');
    });
    it('does not match with invalid first order auth', async function () {
      const call = {
        target: staticMarket.address,
        howToCall: 0,
        data: noChecks,
      };
      const { signature } = await signOrder({
        maker: bob,
        orderParams_: order,
      });
      await expect(
        atomicMatch({
          sender,
          order,
          sig: NULL_SIG,
          call,
          counterorder: {
            ...order,
            extraData: extradata,
          },
          countersig: signature,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'FirstOrderFailedAuthorization'
      );
    });
    it('does not match with invalid second order auth', async function () {
      const { signature } = await signOrder({
        maker: bob,
        orderParams_: order,
      });
      await expect(
        atomicMatch({
          sender,
          order,
          sig: signature,
          call,
          counterorder: {
            ...order,
            extraData: extradata,
          },
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'SecondOrderFailedAuthorization'
      );
    });
    it('does not match with invalid first order params', async function () {
      const secondOrder = {
        ...order,
        extraData: extradata,
      };
      const [{ signature: sigFirstOrder }, { signature: sigSecondOrder }] =
        await Promise.all([
          signOrder({ maker: bob, orderParams_: order }),
          signOrder({ maker: bob, orderParams_: secondOrder }),
        ]);
      await cancelOrder({ maker: bob, orderParams: order });
      await expect(
        atomicMatch({
          sender,
          order,
          sig: sigFirstOrder,
          call,
          counterorder: secondOrder,
          countersig: sigSecondOrder,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'FirstOrderHasInvalidParams'
      );
    });
    it('does not match with invalid second order params', async function () {
      const secondOrder = {
        ...order,
        extraData: extradata,
      };
      const [{ signature: sigFirstOrder }, { signature: sigSecondOrder }] =
        await Promise.all([
          signOrder({ maker: bob, orderParams_: order }),
          signOrder({ maker: bob, orderParams_: secondOrder }),
        ]);
      await cancelOrder({ maker: bob, orderParams: secondOrder });
      await expect(
        atomicMatch({
          sender,
          order,
          sig: sigFirstOrder,
          call,
          counterorder: secondOrder,
          countersig: sigSecondOrder,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(
        marketplace,
        'SecondOrderHasInvalidParams'
      );
    });
    it('does not match with non existent first proxy', async function () {
      const secondOrder = {
        ...order,
        extraData: extradata,
      };
      const { signature: sigSecondOrder } = await signOrder({
        maker: bob,
        orderParams_: secondOrder,
      });
      await expect(
        atomicMatch({
          sender,
          order: { ...order, maker: sender.address, executer: sender.address },
          sig: NULL_SIG,
          call,
          counterorder: secondOrder,
          countersig: sigSecondOrder,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(marketplace, 'ProxyDoesNotExistForMaker');
    });
    it('does not match with non existent second proxy', async function () {
      const firstOrder = {
        ...order,
        extraData: extradata,
      };
      const { signature: sigFirstOrder } = await signOrder({
        maker: bob,
        orderParams_: firstOrder,
      });
      await expect(
        atomicMatch({
          sender,
          order: firstOrder,
          sig: sigFirstOrder,
          call,
          counterorder: {
            ...order,
            maker: sender.address,
            executer: sender.address,
          },
          countersig: NULL_SIG,
          countercall: call,
        })
      ).to.be.revertedWithCustomError(marketplace, 'ProxyDoesNotExistForMaker');
    });
    it('should not match with non existent target', async function () {
      const firstOrder = {
        ...order,
        extraData: extradata,
      };
      const [{ signature: sigFirstOrder }, { signature: sigSecondOrder }] =
        await Promise.all([
          signOrder({ maker: bob, orderParams_: firstOrder }),
          signOrder({ maker: bob, orderParams_: order }),
        ]);
      await expect(
        atomicMatch({
          sender,
          order: firstOrder,
          sig: sigFirstOrder,
          call: { ...call, target: owner.address },
          counterorder: order,
          countersig: sigSecondOrder,
          countercall: { ...call, target: owner.address },
        })
      ).to.be.revertedWithCustomError(marketplace, 'CallTargetDoesNotExist');
    });
    it('Matches orders signed with personal signOrder', async function () {
      const secondOrder = {
        ...order,
        maker: alice.address,
        executer: alice.address,
        extraData: extradata,
      };
      const [
        { signature: sigFirstOrder, suffix },
        { signature: sigSecondOrder, suffix: suffixSecondOrder },
      ] = await Promise.all([
        personalSign({ maker: bob, orderParams: order }),
        personalSign({ maker: alice, orderParams: secondOrder }),
      ]);
      await expect(
        atomicMatch({
          sender: alice,
          order,
          sig: { ...sigFirstOrder, suffix },
          call,
          counterorder: secondOrder,
          countersig: { ...sigSecondOrder, suffix: suffixSecondOrder },
          countercall: call,
        })
      ).to.emit(marketplace, 'OrdersMatched');
    });
  });
});
