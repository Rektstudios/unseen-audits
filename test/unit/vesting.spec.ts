import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ethers, network } from 'hardhat';

import type {
  MockERC20,
  UnseenVesting,
  UnseenVestingNFTDescriptor,
} from '@typechained';
import type { UnseenFixtures } from '@utils/fixtures';
import type { ScheduleParams } from '@utils/types';
import type { Wallet } from 'ethers';

import { randomHex } from '@utils/encoding';
import { faucet } from '@utils/faucet';
import { unseenFixture } from '@utils/fixtures';
import { deployContract } from '@utils/helpers';
import { clock, duration, increaseTo } from '@utils/time';

const { AddressZero } = ethers.constants;

describe(`Vesting - (Unseen v${process.env.VERSION})`, async function () {
  const { provider } = ethers;

  let mockERC20: MockERC20;
  let unseenVesting: UnseenVesting;
  let vestingNFTDescriptor: UnseenVestingNFTDescriptor;
  let schedules: ScheduleParams[];
  let mockSchedule: ScheduleParams;
  let mint20: UnseenFixtures['mint20'];
  let createMultiSchedules: UnseenFixtures['createMultiSchedules'];
  let createSchedule: UnseenFixtures['createSchedule'];

  after(async () => {
    await network.provider.request({
      method: 'hardhat_reset',
    });
  });

  // Wallets
  let owner: Wallet;
  let bob: Wallet;
  let alice: Wallet;

  let amount: BigNumber;

  async function setupFixture() {
    owner = new ethers.Wallet(randomHex(32), provider);
    bob = new ethers.Wallet(randomHex(32), provider);
    alice = new ethers.Wallet(randomHex(32), provider);
    for (const wallet of [owner, bob, alice]) {
      await faucet(wallet.address, provider);
    }

    return {
      owner,
      bob,
      alice,
    };
  }

  before(async () => {
    ({ owner, bob, alice } = await loadFixture(setupFixture));
  });

  beforeEach(async function () {
    ({
      mockERC20,
      mint20,
      unseenVesting,
      vestingNFTDescriptor,
      schedules,
      createSchedule,
      createMultiSchedules,
    } = await unseenFixture(owner));

    const timestamp = await clock.timestamp();

    mockSchedule = {
      sender: owner.address,
      recipient: bob.address,
      totalAmount: parseEther('100000000'),
      startTime: timestamp.add(duration.hours(1)),
      cancelable: true,
      transferable: true,
      segments: [
        {
          amount: parseEther('50000000'),
          exponent: parseEther('1'),
          milestone: timestamp.add(duration.hours(1).add(duration.seconds(1))),
        },
        {
          amount: parseEther('50000000'),
          exponent: parseEther('1'),
          milestone: timestamp.add(duration.hours(2)),
        },
      ],
    };

    amount = parseEther('1000000000');

    await mint20(owner, amount);

    expect(await mockERC20.balanceOf(owner.address)).to.eq(amount);

    /**
     * @note an equal amount of tokens should be approved to be spent
     *       by unseenVesting earlier to schedules creation
     */
    await mockERC20.connect(owner).approve(unseenVesting.address, amount);

    expect(
      await mockERC20.allowance(owner.address, unseenVesting.address)
    ).to.eq(amount);

    // @note update sender address
    schedules.forEach((schedule) => {
      schedule.sender = owner.address;
    });
  });

  context('constructor', function () {
    const testConstructor = async (expectedError: string, ...args: any[]) => {
      const deployment = deployContract('UnseenVesting', ...args);
      if (expectedError)
        await expect(deployment).to.be.revertedWithCustomError(
          unseenVesting,
          expectedError
        );
      else {
        const vesting = await deployment;
        expect(await vesting.owner()).to.eq(owner.address);
        expect(await vesting.UNCN()).to.eq(mockERC20.address);
        expect(await vesting.MAX_SEGMENT_COUNT()).to.eq(5);
      }
    };

    it('reverts if owner, vested token, nft descriptor or segmentCount is set to 0x0', async function () {
      const t = async (
        ownerToSet: string,
        nftDescriptor: string,
        maxSegmentCount: number,
        token: string,
        expectedError: string
      ) => {
        await testConstructor(
          expectedError,
          ownerToSet,
          nftDescriptor,
          maxSegmentCount,
          token
        );
      };
      await t(
        owner.address,
        vestingNFTDescriptor.address,
        5,
        AddressZero,
        'UNCNIsZeroAddress'
      );
      await t(
        AddressZero,
        vestingNFTDescriptor.address,
        5,
        mockERC20.address,
        'NewOwnerIsZeroAddress'
      );
      await t(
        owner.address,
        AddressZero,
        5,
        mockERC20.address,
        'NFTDescriptorIsZeroAddress'
      );
      await t(
        owner.address,
        vestingNFTDescriptor.address,
        0,
        mockERC20.address,
        'SegmentCountMismatch'
      );
      await t(
        owner.address,
        vestingNFTDescriptor.address,
        3,
        mockERC20.address,
        'SegmentCountMismatch'
      );
      await t(
        owner.address,
        vestingNFTDescriptor.address,
        5,
        mockERC20.address,
        ''
      );
    });
  });

  context('ownership and authority', async function () {
    it('only owner can create a schedule', async function () {
      await expect(
        createSchedule({ caller: bob, schedule: schedules[0] })
      ).to.be.revertedWithCustomError(unseenVesting, 'Unauthorized');

      const tx = await createSchedule({ schedule: schedules[0] });
      const receipt = await tx.wait();
      const event = receipt?.events?.find((e) => e.event === 'CreateSchedule');

      expect(event?.args?.recipient).to.eq(schedules[0].recipient);
      expect(event?.args?.amounts).to.eq(schedules[0].totalAmount);
      expect(event?.args?.cancelable).to.eq(schedules[0].cancelable);
      expect(event?.args?.transferable).to.eq(schedules[0].transferable);
      expect(event?.args?.sender).to.eq(schedules[0].sender);
      expect(event?.args?.range.start).to.eq(schedules[0].startTime);
      expect(event?.args?.range.end).to.eq(schedules[0].segments[3].milestone);
      expect(event?.args?.scheduleId).to.eq(1);
    });
    it('only owner can batch create schedules', async function () {
      await expect(
        createMultiSchedules({ caller: bob, schedules: [schedules[0]] })
      ).to.be.revertedWithCustomError(unseenVesting, 'Unauthorized');

      const tx = await createMultiSchedules({
        schedules: [schedules[0], schedules[1]],
      });

      const receipt = await tx.wait();

      const events = receipt.events?.filter(
        (e) => e.event === 'CreateSchedule'
      );

      if (events && events.length > 0) {
        for (let i = 0; i < events.length; i++) {
          const eventArgs = events[i].args;

          if (eventArgs) {
            expect(eventArgs.recipient).to.eq(schedules[i].recipient);
            expect(eventArgs.amounts).to.eq(schedules[i].totalAmount);
            expect(eventArgs.cancelable).to.eq(schedules[i].cancelable);
            expect(eventArgs.transferable).to.eq(schedules[i].transferable);
            expect(eventArgs.sender).to.eq(schedules[i].sender);

            if (eventArgs.range) {
              expect(eventArgs.range.start).to.eq(schedules[i].startTime);
              expect(eventArgs.range.end).to.eq(
                schedules[i].segments[schedules[i].segments.length - 1]
                  .milestone
              );
            }

            expect(eventArgs.scheduleId).to.eq(i + 1);
          }
        }
      } else {
        console.error(
          'No CreateSchedule events found or receipt.events is undefined.'
        );
      }
    });
    it('owner should provide at least 1 schedule when batch creating schedules', async function () {
      await expect(
        createMultiSchedules({ schedules: [] })
      ).to.be.revertedWithCustomError(unseenVesting, 'BatchSizeZero');
    });
    it('only sender can renounce a schedule', async function () {
      await expect(createSchedule({ schedule: schedules[0] })).to.emit(
        unseenVesting,
        'CreateSchedule'
      );
      await expect(
        unseenVesting.connect(bob).renounce(1)
      ).to.be.revertedWithCustomError(unseenVesting, 'Vesting_Unauthorized');
      await expect(unseenVesting.renounce(1))
        .to.emit(unseenVesting, 'RenounceLockupSchedule')
        .withArgs(1);

      expect(await unseenVesting.isCancelable(1)).to.be.false;
    });
    it('only sender can cancel a schedule', async function () {
      await createSchedule({ schedule: schedules[0] });
      await expect(
        unseenVesting.connect(bob).cancel(1)
      ).to.be.revertedWithCustomError(unseenVesting, 'Vesting_Unauthorized');
      await expect(unseenVesting.cancel(1))
        .to.emit(unseenVesting, 'CancelLockupSchedule')
        .withArgs(
          1,
          owner.address,
          schedules[0].recipient,
          schedules[0].totalAmount,
          0
        );

      expect(await unseenVesting.isDepleted(1)).to.be.true;

      expect(await mockERC20.balanceOf(owner.address)).to.eq(amount);
    });
    it('sender can cancel multiple schedules at a time', async function () {
      await createMultiSchedules({ schedules: [schedules[0], schedules[1]] });

      await expect(unseenVesting.cancelMultiple([1, 2])).to.emit(
        unseenVesting,
        'CancelLockupSchedule'
      );

      expect(await unseenVesting.isDepleted(1)).to.be.true;

      expect(await unseenVesting.isDepleted(2)).to.be.true;

      expect(await mockERC20.balanceOf(owner.address)).to.eq(amount);
    });
    it('sender cannot cancel notCancelable schedule', async function () {
      await createSchedule({ schedule: schedules[0] });
      await unseenVesting.renounce(1);
      await expect(unseenVesting.cancel(1)).to.be.revertedWithCustomError(
        unseenVesting,
        'ScheduleNotCancelable'
      );
    });
    it("only a depleted schedule's owner can burn it", async function () {
      await createSchedule({
        schedule: { ...schedules[0], recipient: bob.address },
      });

      await expect(
        unseenVesting.connect(bob).burn(1)
      ).to.be.revertedWithCustomError(unseenVesting, 'ScheduleNotDepleted');

      await unseenVesting.cancel(1);

      expect(await unseenVesting.isDepleted(1)).to.eq(true);

      await expect(unseenVesting.burn(1)).to.be.revertedWithCustomError(
        unseenVesting,
        'Vesting_Unauthorized'
      );

      await expect(unseenVesting.connect(bob).burn(1))
        .to.emit(unseenVesting, 'Transfer')
        .withArgs(bob.address, AddressZero, 1);
    });
    it('sender cannot renounce a renounced or notCancelable schedule', async function () {
      await createSchedule({ schedule: schedules[0] });
      await unseenVesting.renounce(1);

      expect(await unseenVesting.isCancelable(1)).to.be.false;

      await expect(unseenVesting.renounce(1)).to.be.revertedWithCustomError(
        unseenVesting,
        'ScheduleNotCancelable'
      );
    });
    it('sender cannot renounce non existant schedule', async function () {
      await expect(unseenVesting.renounce(0)).to.be.revertedWithCustomError(
        unseenVesting,
        'Null'
      );
    });
    it('sender cannot renounce depleted, canceled or setteled schedule', async function () {
      await createMultiSchedules({
        schedules: [
          mockSchedule,
          { ...mockSchedule, recipient: alice.address },
        ],
      });

      await increaseTo.timestamp(Number(mockSchedule.segments[0].milestone));

      await unseenVesting.cancel(1);

      await expect(unseenVesting.renounce(1)).to.be.revertedWithCustomError(
        unseenVesting,
        'ScheduleCanceled'
      );

      await unseenVesting.withdrawMax(1, bob.address);

      await expect(unseenVesting.renounce(1)).to.be.revertedWithCustomError(
        unseenVesting,
        'ScheduleDepleted'
      );

      await increaseTo.timestamp(Number(mockSchedule.segments[1].milestone));

      await expect(unseenVesting.renounce(2)).to.be.revertedWithCustomError(
        unseenVesting,
        'ScheduleSettled'
      );
    });
    it('only owner can set a new NFTDescriptor', async function () {
      await expect(
        unseenVesting.connect(bob).setNFTDescriptor(bob.address)
      ).to.be.revertedWithCustomError(unseenVesting, 'Unauthorized');

      await expect(unseenVesting.setNFTDescriptor(bob.address))
        .to.emit(unseenVesting, 'SetNFTDescriptor')
        .withArgs(owner.address, vestingNFTDescriptor.address, bob.address);
    });
    it('only recipient or sender can withdraw', async function () {
      await createSchedule({
        schedule: mockSchedule,
      });

      await increaseTo.timestamp(Number(mockSchedule.segments[0].milestone));

      await expect(
        unseenVesting.connect(alice).withdraw(1, alice.address, 1)
      ).to.be.revertedWithCustomError(unseenVesting, 'Vesting_Unauthorized');

      expect(await unseenVesting.withdrawableAmountOf(1)).to.gt(
        mockSchedule.segments[0].amount
      );

      await unseenVesting.withdraw(1, bob.address, 1);

      await unseenVesting.connect(bob).withdraw(1, bob.address, 1);

      expect(await mockERC20.balanceOf(bob.address)).to.eq(2);
    });
    it('sender or recipient cannot withdraw from depleted schedule nor to address 0 and not zero quantity', async function () {
      await createSchedule({
        schedule: mockSchedule,
      });

      await increaseTo.timestamp(Number(mockSchedule.segments[0].milestone));

      expect(await unseenVesting.withdrawableAmountOf(1)).to.eq(
        mockSchedule.segments[0].amount
      );

      // TODO get ride of to=address(0) check since no schedule can be created for
      // TODO address 0 as recipient and if withdrawer should be sender or recipient to be able to withdraw then this check is deadcode
      await expect(
        unseenVesting.withdraw(1, AddressZero, 1)
      ).to.be.revertedWithCustomError(unseenVesting, 'InvalidSenderWithdrawal');

      await expect(
        unseenVesting.withdraw(1, bob.address, 0)
      ).to.be.revertedWithCustomError(unseenVesting, 'WithdrawAmountZero');

      await unseenVesting.cancel(1);

      expect(await unseenVesting.isDepleted(1)).to.eq(false);

      const withdtawableAmount = await unseenVesting.withdrawableAmountOf(1);

      expect(await unseenVesting.getRefundedAmount(1)).to.eq(
        BigNumber.from(mockSchedule.totalAmount).sub(withdtawableAmount)
      );

      await unseenVesting
        .connect(bob)
        .withdraw(1, bob.address, withdtawableAmount);

      expect(await mockERC20.balanceOf(bob.address)).to.eq(withdtawableAmount);

      expect(await unseenVesting.isDepleted(1)).to.eq(true);

      await expect(
        unseenVesting.withdraw(1, bob.address, 1)
      ).to.be.revertedWithCustomError(unseenVesting, 'ScheduleDepleted');

      expect(await mockERC20.balanceOf(owner.address)).to.eq(
        amount.sub(withdtawableAmount)
      );
    });
  });

  context('get functions', async function () {
    it('schedules has correct params', async function () {
      await unseenVesting.createSchedule(schedules[0]);

      expect(await unseenVesting.getDepositedAmount(1)).to.eq(
        schedules[0].totalAmount
      );

      expect(await unseenVesting.getRefundedAmount(1)).to.eq(0);

      expect(await unseenVesting.getEndTime(1)).to.eq(
        schedules[0].segments[3].milestone
      );

      expect(await unseenVesting.getRange(1)).to.deep.eq([
        schedules[0].startTime,
        schedules[0].segments[3].milestone,
      ]);

      expect(await unseenVesting.getSender(1)).to.eq(owner.address);

      expect(await unseenVesting.getStartTime(1)).to.eq(schedules[0].startTime);

      expect(await unseenVesting.isCancelable(1)).to.eq(true);

      expect(await unseenVesting.isTransferable(1)).to.eq(true);

      expect(await unseenVesting.isSchedule(1)).to.eq(true);

      expect(await unseenVesting.isSchedule(2)).to.eq(false);
    });
    it("schedule's status is properly managed", async function () {
      await unseenVesting.createMultiSchedules([
        mockSchedule,
        { ...mockSchedule, recipient: alice.address },
      ]);

      expect(await unseenVesting.statusOf(1)).to.eq(0);

      await increaseTo.timestamp(Number(mockSchedule.segments[0].milestone));

      expect(await unseenVesting.statusOf(1)).to.eq(1);

      await unseenVesting.cancel(1);

      expect(await unseenVesting.statusOf(1)).to.eq(3);

      await unseenVesting.connect(bob).withdrawMax(1, bob.address);

      expect(await unseenVesting.statusOf(1)).to.eq(4);

      await increaseTo.timestamp(Number(mockSchedule.segments[1].milestone));

      expect(await unseenVesting.statusOf(2)).to.eq(2);

      await unseenVesting.connect(alice).withdrawMax(2, alice.address);
    });
  });

  context('real life scenario token vesting', async function () {
    it('owner creates all schedules', async function () {
      // TODO simulate Unseen schedules with time manipulation
      await createMultiSchedules({ schedules: schedules });
    });
  });
});
