// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { PRBMathCastingUint128 as CastingUint128 } from "@prb/math/src/casting/Uint128.sol";
import { PRBMathCastingUint40 as CastingUint40 } from "@prb/math/src/casting/Uint40.sol";
import { SD59x18 } from "@prb/math/src/SD59x18.sol";
import { VestingLockup } from "./abstracts/VestingLockup.sol";
import { IVestingLockup } from "./interfaces/IVestingLockup.sol";
import { IUnseenVesting } from "./interfaces/IUnseenVesting.sol";
import { IUnseenVestingNFTDescriptor } from "./interfaces/IUnseenVestingNFTDescriptor.sol";
import { Errors } from "./libraries/Errors.sol";
import { Helpers } from "./libraries/Helpers.sol";
import { Lockup } from "./types/DataTypes.sol";
import { ReentrancyGuard } from "solady/src/utils/ReentrancyGuard.sol";

/*

$$$$$$$\            $$\         $$\            $$$$$$\    $$\                     $$\ $$\                     
$$  __$$\           $$ |        $$ |          $$  __$$\   $$ |                    $$ |\__|                    
$$ |  $$ | $$$$$$\  $$ |  $$\ $$$$$$\         $$ /  \__|$$$$$$\   $$\   $$\  $$$$$$$ |$$\  $$$$$$\   $$$$$$$\ 
$$$$$$$  |$$  __$$\ $$ | $$  |\_$$  _|        \$$$$$$\  \_$$  _|  $$ |  $$ |$$  __$$ |$$ |$$  __$$\ $$  _____|
$$  __$$< $$$$$$$$ |$$$$$$  /   $$ |           \____$$\   $$ |    $$ |  $$ |$$ /  $$ |$$ |$$ /  $$ |\$$$$$$\  
$$ |  $$ |$$   ____|$$  _$$<    $$ |$$\       $$\   $$ |  $$ |$$\ $$ |  $$ |$$ |  $$ |$$ |$$ |  $$ | \____$$\ 
$$ |  $$ |\$$$$$$$\ $$ | \$$\   \$$$$  |      \$$$$$$  |  \$$$$  |\$$$$$$  |\$$$$$$$ |$$ |\$$$$$$  |$$$$$$$  |
\__|  \__| \_______|\__|  \__|   \____/        \______/    \____/  \______/  \_______|\__| \______/ \_______/   

*/

/**
 * @title  UnseenVesting
 * @author decapitator (0xdecapitator)
 * @notice Manages UNCN vesting securely.
 *         Ensures fair, scheduled distribution to recipients.
 */
contract UnseenVesting is ReentrancyGuard, IUnseenVesting, VestingLockup {
    using CastingUint128 for uint128;
    using CastingUint40 for uint40;
    using SafeERC20 for IERC20;

    // Defines the number of milestones in the token
    // release schedule, such as lockup, cliff, and
    // linear release segments.
    uint256 public immutable override MAX_SEGMENT_COUNT;

    // Unseen uncn token contract.
    IERC20 public immutable override UNCN;

    // Unseen vesting schedules mapped by ids.
    mapping(uint256 id => Lockup.Schedule schedule) private _schedules;

    /**
     * @dev Deploys Unseen Vesting contract.
     * @param initialOwner The address of the initial contract owner.
     * @param initialNFTDescriptor The address of the NFT descriptor contract.
     * @param maxSegmentCount The maximum number of segments allowed in a schedule.
     */
    constructor(
        address initialOwner,
        IUnseenVestingNFTDescriptor initialNFTDescriptor,
        uint256 maxSegmentCount,
        address uncn
    )
        payable
        ERC721("UNSEEN VESTING", "UNCN-VESTING")
        VestingLockup(initialOwner, initialNFTDescriptor)
    {
        if (maxSegmentCount < 4) {
            revert Errors.SegmentCountMismatch();
        }

        MAX_SEGMENT_COUNT = maxSegmentCount;

        nextScheduleId = 1;

        if (uncn == address(0)) revert Errors.UNCNIsZeroAddress();

        UNCN = IERC20(uncn);
    }

    /**
     * @dev Retrieves the deposited amount associated with a schedule.
     * @param scheduleId The ID of the schedule.
     * @return depositedAmount The amount deposited in the schedule.
     */
    function getDepositedAmount(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (uint128 depositedAmount)
    {
        depositedAmount = _schedules[scheduleId].amounts.deposited;
    }

    /**
     * @dev Retrieves the end time of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return endTime The end time of the schedule.
     */
    function getEndTime(
        uint256 scheduleId
    ) external view override notNull(scheduleId) returns (uint40 endTime) {
        endTime = _schedules[scheduleId].endTime;
    }

    /**
     * @dev Retrieves the range (start and end times) of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return range The range of the schedule.
     */
    function getRange(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (Lockup.Range memory range)
    {
        range = Lockup.Range({
            start: _schedules[scheduleId].startTime,
            end: _schedules[scheduleId].endTime
        });
    }

    /**
     * @dev Retrieves the refunded amount associated with a schedule.
     * @param scheduleId The ID of the schedule.
     * @return refundedAmount The amount refunded in the schedule.
     */
    function getRefundedAmount(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (uint128 refundedAmount)
    {
        refundedAmount = _schedules[scheduleId].amounts.refunded;
    }

    /**
     * @dev Retrieves the segments of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return segments The segments of the schedule.
     */
    function getSegments(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (Lockup.Segment[] memory segments)
    {
        segments = _schedules[scheduleId].segments;
    }

    /**
     * @dev Retrieves the sender address associated with a schedule.
     * @param scheduleId The ID of the schedule.
     * @return sender The address of the sender.
     */
    function getSender(
        uint256 scheduleId
    ) external view override notNull(scheduleId) returns (address sender) {
        sender = _schedules[scheduleId].sender;
    }

    /**
     * @dev Retrieves the start time of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return startTime The start time of the schedule.
     */
    function getStartTime(
        uint256 scheduleId
    ) external view override notNull(scheduleId) returns (uint40 startTime) {
        startTime = _schedules[scheduleId].startTime;
    }

    /**
     * @dev Retrieves the full details of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return schedule The schedule details.
     */
    function getSchedule(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (Lockup.Schedule memory schedule)
    {
        schedule = _schedules[scheduleId];

        // Settled schedules cannot be canceled.
        if (_statusOf(scheduleId) == Lockup.Status.SETTLED) {
            schedule.isCancelable = false;
        }
    }

    /**
     * @dev Retrieves the amount withdrawn from a schedule.
     * @param scheduleId The ID of the schedule.
     * @return withdrawnAmount The amount withdrawn from the schedule.
     */
    function getWithdrawnAmount(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (uint128 withdrawnAmount)
    {
        withdrawnAmount = _schedules[scheduleId].amounts.withdrawn;
    }

    /**
     * @dev Checks if a schedule is cancelable.
     * @param scheduleId The ID of the schedule.
     * @return result True if the schedule is cancelable; otherwise, false.
     */
    function isCancelable(
        uint256 scheduleId
    ) external view override notNull(scheduleId) returns (bool result) {
        if (_statusOf(scheduleId) != Lockup.Status.SETTLED) {
            result = _schedules[scheduleId].isCancelable;
        }
    }

    /**
     * @dev Checks if a schedule is transferable.
     * @param scheduleId The ID of the schedule.
     * @return result True if the schedule is transferable; otherwise, false.
     */
    function isTransferable(
        uint256 scheduleId
    )
        public
        view
        override(IVestingLockup, VestingLockup)
        notNull(scheduleId)
        returns (bool result)
    {
        result = _schedules[scheduleId].isTransferable;
    }

    /**
     * @dev Checks if a schedule is depleted.
     * @param scheduleId The ID of the schedule.
     * @return result True if the schedule is depleted; otherwise, false.
     */
    function isDepleted(
        uint256 scheduleId
    )
        public
        view
        override(IVestingLockup, VestingLockup)
        notNull(scheduleId)
        returns (bool result)
    {
        result = _schedules[scheduleId].isDepleted;
    }

    /**
     * @dev Checks if an NFT ID corresponds to a schedule.
     * @param scheduleId The ID of the schedule.
     * @return result True if the NFT ID corresponds to a schedule; otherwise, false.
     */
    function isSchedule(
        uint256 scheduleId
    )
        public
        view
        override(IVestingLockup, VestingLockup)
        returns (bool result)
    {
        result = _schedules[scheduleId].isSchedule;
    }

    /**
     * @dev Retrieves the refundable amount from a schedule.
     * @param scheduleId The ID of the schedule.
     * @return refundableAmount The refundable amount from the schedule.
     */
    function refundableAmountOf(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (uint128 refundableAmount)
    {
        // These checks are needed because {_calculateVestedAmount} does not look up the schedule's status. Note that
        // checking for `isCancelable` also checks if the schedule `wasCanceled` thanks to the protocol invariant that
        // canceled schedules are not cancelable anymore.
        if (
            _schedules[scheduleId].isCancelable &&
            !_schedules[scheduleId].isDepleted
        ) {
            refundableAmount =
                _schedules[scheduleId].amounts.deposited -
                _calculateVestedAmount(scheduleId);
        }
        // Otherwise, the result is implicitly zero.
    }

    /**
     * @dev Retrieves the status of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return status The status of the schedule.
     */
    function statusOf(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (Lockup.Status status)
    {
        status = _statusOf(scheduleId);
    }

    /**
     * @dev Retrieves the vested amount from a schedule.
     * @param scheduleId The ID of the schedule.
     * @return vestedAmount The vested amount from the schedule.
     */
    function vestedAmountOf(
        uint256 scheduleId
    )
        public
        view
        override(IVestingLockup, IUnseenVesting)
        notNull(scheduleId)
        returns (uint128 vestedAmount)
    {
        vestedAmount = _vestedAmountOf(scheduleId);
    }

    /**
     * @dev Checks if a schedule was canceled.
     * @param scheduleId The ID of the schedule.
     * @return result True if the schedule was canceled; otherwise, false.
     */
    function wasCanceled(
        uint256 scheduleId
    )
        public
        view
        override(IVestingLockup, VestingLockup)
        notNull(scheduleId)
        returns (bool result)
    {
        result = _schedules[scheduleId].wasCanceled;
    }

    /**
     * @dev Batch creates schedules with the specified parameters.
     * @param schedulesParams The parameters for creating the schedules.
     * @return scheduleIds The IDs of the newly created schedules.
     */
    function createMultiSchedules(
        Lockup.CreateSchedule[] calldata schedulesParams
    )
        external
        override
        noDelegateCall
        nonReentrant
        onlyOwner
        returns (uint256[] memory scheduleIds)
    {
        // Check that the schedules count is not zero.
        uint256 schedulesCount = schedulesParams.length;
        if (schedulesCount == 0) {
            revert Errors.BatchSizeZero();
        }

        // Create a schedule for each element in the parameter array.
        scheduleIds = new uint256[](schedulesCount);
        for (uint256 i; i < schedulesCount; ) {
            scheduleIds[i] = _createSchedule(schedulesParams[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Creates a new schedule with the specified parameters.
     * @param params The parameters for creating the schedule.
     * @return scheduleId The ID of the newly created schedule.
     */
    function createSchedule(
        Lockup.CreateSchedule calldata params
    )
        external
        override
        noDelegateCall
        nonReentrant
        onlyOwner
        returns (uint256 scheduleId)
    {
        // Checks, Effects and Interactions: create the schedule.
        scheduleId = _createSchedule(params);
    }

    /**
     * @dev Calculates the vested amount without looking up the schedule's status.
     * @param scheduleId The ID of the schedule.
     * @return The vested amount.
     */
    function _calculateVestedAmount(
        uint256 scheduleId
    ) internal view returns (uint128) {
        // If the start time is in the future, return zero.
        uint40 currentTime = uint40(block.timestamp);
        if (_schedules[scheduleId].startTime >= currentTime) {
            return 0;
        }

        // If the end time is not in the future, return the deposited amount.
        uint40 endTime = _schedules[scheduleId].endTime;
        if (endTime <= currentTime) {
            return _schedules[scheduleId].amounts.deposited;
        }

        if (_schedules[scheduleId].segments.length > 1) {
            // If there is more than one segment, it may be necessary to iterate over all of them.
            return _calculateVestedAmountForMultipleSegments(scheduleId);
        } else {
            // Otherwise, there is only one segment, and the calculation is simpler.
            return _calculateVestedAmountForOneSegment(scheduleId);
        }
    }

    /**
     * @dev Calculates the vested amount for a schedule with multiple segments.
     * @param scheduleId The ID of the schedule.
     * @notice 1. Normalization to 18 decimals is not needed because there is no
     *            mix of amounts with different decimals.
     *         2. The schedule's start time must be in the past so that the
     *            calculations below do not overflow.
     *         3. The schedule's end time must be in the future so that the loop
     *            below does not panic with an "index out of bounds" error.
     * @return The vested amount.
     */
    function _calculateVestedAmountForMultipleSegments(
        uint256 scheduleId
    ) internal view returns (uint128) {
        unchecked {
            uint40 currentTime = uint40(block.timestamp);
            Lockup.Schedule memory schedule = _schedules[scheduleId];

            // Sum the amounts in all segments that precede the current time.
            uint128 previousSegmentAmounts;
            uint40 currentSegmentMilestone = schedule.segments[0].milestone;
            uint256 index = 0;
            while (currentSegmentMilestone < currentTime) {
                previousSegmentAmounts += schedule.segments[index].amount;
                index++;
                currentSegmentMilestone = schedule.segments[index].milestone;
            }

            // After exiting the loop, the current segment is at `index`.
            SD59x18 currentSegmentAmount = schedule
                .segments[index]
                .amount
                .intoSD59x18();
            SD59x18 currentSegmentExponent = schedule
                .segments[index]
                .exponent
                .intoSD59x18();
            currentSegmentMilestone = schedule.segments[index].milestone;

            uint40 previousMilestone;
            if (index > 0) {
                // When the current segment's index is greater than or equal to 1, it implies that the segment is not
                // the first. In this case, use the previous segment's milestone.
                previousMilestone = schedule.segments[index - 1].milestone;
            } else {
                // Otherwise, the current segment is the first, so use the start time as the previous milestone.
                previousMilestone = schedule.startTime;
            }

            // Calculate how much time has passed since the segment started, and the total time of the segment.
            SD59x18 elapsedSegmentTime = (currentTime - previousMilestone)
                .intoSD59x18();
            SD59x18 totalSegmentTime = (currentSegmentMilestone -
                previousMilestone).intoSD59x18();

            // Divide the elapsed segment time by the total duration of the segment.
            SD59x18 elapsedSegmentTimePercentage = elapsedSegmentTime.div(
                totalSegmentTime
            );

            // Calculate the vested amount using the special formula.
            SD59x18 multiplier = elapsedSegmentTimePercentage.pow(
                currentSegmentExponent
            );
            SD59x18 segmentVestedAmount = multiplier.mul(currentSegmentAmount);

            // Although the segment vested amount should never exceed the total segment amount, this condition is
            // checked without asserting to avoid locking funds in case of a bug. If this situation occurs, the
            // amount vested in the segment is considered zero (except for past withdrawals), and the segment is
            // effectively voided.
            if (segmentVestedAmount.gt(currentSegmentAmount)) {
                return
                    previousSegmentAmounts > schedule.amounts.withdrawn
                        ? previousSegmentAmounts
                        : schedule.amounts.withdrawn;
            }

            // Calculate the total vested amount by adding the previous segment amounts and the amount vested in
            // the current segment. Casting to uint128 is safe due to the if statement above.
            return
                previousSegmentAmounts +
                uint128(segmentVestedAmount.intoUint256());
        }
    }

    /**
     * @dev Calculates the vested amount for a schedule with one segment.
     * @param scheduleId The ID of the schedule.
     * @return The vested amount.
     */
    function _calculateVestedAmountForOneSegment(
        uint256 scheduleId
    ) internal view returns (uint128) {
        unchecked {
            // Calculate how much time has passed since the schedule started, and the schedule's total duration.
            SD59x18 elapsedTime = (uint40(block.timestamp) -
                _schedules[scheduleId].startTime).intoSD59x18();
            SD59x18 totalTime = (_schedules[scheduleId].endTime -
                _schedules[scheduleId].startTime).intoSD59x18();

            // Divide the elapsed time by the schedule's total duration.
            SD59x18 elapsedTimePercentage = elapsedTime.div(totalTime);

            // Cast the schedule parameters to SD59x18.
            SD59x18 exponent = _schedules[scheduleId]
                .segments[0]
                .exponent
                .intoSD59x18();
            SD59x18 depositedAmount = _schedules[scheduleId]
                .amounts
                .deposited
                .intoSD59x18();

            // Calculate the vested amount using the special formula.
            SD59x18 multiplier = elapsedTimePercentage.pow(exponent);
            SD59x18 vestedAmount = multiplier.mul(depositedAmount);

            // Although the vested amount should never exceed the deposited amount, this condition is checked
            // without asserting to avoid locking funds in case of a bug. If this situation occurs, the withdrawn
            // amount is considered to be the vested amount, and the schedule is effectively frozen.
            if (vestedAmount.gt(depositedAmount)) {
                return _schedules[scheduleId].amounts.withdrawn;
            }

            // Cast the vested amount to uint128. This is safe due to the check above.
            return uint128(vestedAmount.intoUint256());
        }
    }

    /**
     * @dev Checks if the caller is the sender of the schedule.
     * @param scheduleId The ID of the schedule.
     * @return True if the caller is the sender; otherwise, false.
     */
    function _isCallerScheduleSender(
        uint256 scheduleId
    ) internal view override returns (bool) {
        return msg.sender == _schedules[scheduleId].sender;
    }

    /**
     * @dev Checks whether `msg.sender` is the schedule's recipient or an approved third party.
     * @param scheduleId The ID of the schedule.
     * @return True if the caller is approved.
     */
    function _isCallerScheduleRecipientOrApproved(
        uint256 scheduleId
    ) internal view override returns (bool) {
        address recipient = _ownerOf(scheduleId);
        return
            msg.sender == recipient ||
            isApprovedForAll({ owner: recipient, operator: msg.sender }) ||
            getApproved(scheduleId) == msg.sender;
    }

    /**
     * @dev Retrieves the status of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return The status of the schedule.
     */
    function _statusOf(
        uint256 scheduleId
    ) internal view override returns (Lockup.Status) {
        if (_schedules[scheduleId].isDepleted) {
            return Lockup.Status.DEPLETED;
        } else if (_schedules[scheduleId].wasCanceled) {
            return Lockup.Status.CANCELED;
        }

        if (block.timestamp < _schedules[scheduleId].startTime) {
            return Lockup.Status.PENDING;
        }

        if (
            _calculateVestedAmount(scheduleId) <
            _schedules[scheduleId].amounts.deposited
        ) {
            return Lockup.Status.ONGOING;
        } else {
            return Lockup.Status.SETTLED;
        }
    }

    /**
     * @dev Retrieves the vested amount of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return The vested amount.
     */
    function _vestedAmountOf(
        uint256 scheduleId
    ) internal view returns (uint128) {
        Lockup.Amounts memory amounts = _schedules[scheduleId].amounts;

        if (_schedules[scheduleId].isDepleted) {
            return amounts.withdrawn;
        } else if (_schedules[scheduleId].wasCanceled) {
            return amounts.deposited - amounts.refunded;
        }

        return _calculateVestedAmount(scheduleId);
    }

    /**
     * @dev Retrieves the withdrawable amount of a schedule.
     * @param scheduleId The ID of the schedule.
     * @return The withdrawable amount.
     */
    function _withdrawableAmountOf(
        uint256 scheduleId
    ) internal view override returns (uint128) {
        return
            _vestedAmountOf(scheduleId) -
            _schedules[scheduleId].amounts.withdrawn;
    }

    /**
     * @dev Retrieves the withdrawable amount of a schedule.
     * @param scheduleId The ID of the schedule.
     */
    function _cancel(uint256 scheduleId) internal override {
        // Calculate the vested amount.
        uint128 vestedAmount = _calculateVestedAmount(scheduleId);

        // Retrieve the amounts from storage.
        Lockup.Amounts memory amounts = _schedules[scheduleId].amounts;

        // Checks: the schedule is not settled.
        if (vestedAmount >= amounts.deposited) {
            revert Errors.ScheduleSettled(scheduleId);
        }

        // Checks: the schedule is cancelable.
        if (!_schedules[scheduleId].isCancelable) {
            revert Errors.ScheduleNotCancelable(scheduleId);
        }

        // Calculate the sender's and the recipient's amount.
        uint128 senderAmount = amounts.deposited - vestedAmount;
        uint128 recipientAmount = vestedAmount - amounts.withdrawn;

        // Effects: mark the schedule as canceled.
        _schedules[scheduleId].wasCanceled = true;

        // Effects: make the schedule not cancelable anymore, because a schedule can only be canceled once.
        _schedules[scheduleId].isCancelable = false;

        // Effects: If there are no uncn left for the recipient to withdraw, mark the schedule as depleted.
        if (recipientAmount == 0) {
            _schedules[scheduleId].isDepleted = true;
        }

        // Effects: set the refunded amount.
        _schedules[scheduleId].amounts.refunded = senderAmount;

        // Retrieve the sender and the recipient from storage.
        address sender = _schedules[scheduleId].sender;
        address recipient = _ownerOf(scheduleId);

        // Interactions: refund the sender.
        UNCN.safeTransfer({ to: sender, value: senderAmount });

        // Log the cancellation.
        emit IVestingLockup.CancelLockupSchedule(
            scheduleId,
            sender,
            recipient,
            senderAmount,
            recipientAmount
        );

        // Emits an ERC-4906 event to trigger an update of the NFT metadata.
        emit MetadataUpdate({ _tokenId: scheduleId });
    }

    /**
     * @dev Creates a new schedule.
     * @param params Parameters for creating the schedule.
     * @return scheduleId The ID of the created schedule.
     */
    function _createSchedule(
        Lockup.CreateSchedule memory params
    ) internal returns (uint256 scheduleId) {
        // Checks: validate the user-provided parameters.
        Helpers.checkCreateSchedule(
            params.totalAmount,
            params.segments,
            MAX_SEGMENT_COUNT,
            params.startTime
        );

        // Load the schedule id in a variable.
        scheduleId = nextScheduleId;

        // Effects: create the schedule.
        Lockup.Schedule storage schedule = _schedules[scheduleId];
        schedule.amounts.deposited = params.totalAmount;
        schedule.isCancelable = params.cancelable;
        schedule.isTransferable = params.transferable;
        schedule.isSchedule = true;
        schedule.sender = params.sender;

        unchecked {
            // The segment count cannot be zero at this point.
            uint256 segmentCount = params.segments.length;
            schedule.endTime = params.segments[segmentCount - 1].milestone;
            schedule.startTime = params.startTime;

            for (uint256 i; i < segmentCount; ) {
                schedule.segments.push(params.segments[i]);

                ++i;
            }

            // Effects: bump the next schedule id.
            nextScheduleId++;
        }

        // Effects: mint the NFT to the recipient.
        _safeMint({ to: params.recipient, tokenId: scheduleId });

        // Interactions: transfer the deposit.
        unchecked {
            UNCN.safeTransferFrom({
                from: msg.sender,
                to: address(this),
                value: params.totalAmount
            });
        }

        // Log the newly created schedule.
        emit IUnseenVesting.CreateSchedule({
            scheduleId: scheduleId,
            funder: msg.sender,
            sender: params.sender,
            recipient: params.recipient,
            amounts: params.totalAmount,
            cancelable: params.cancelable,
            transferable: params.transferable,
            segments: params.segments,
            range: Lockup.Range({
                start: schedule.startTime,
                end: schedule.endTime
            })
        });
    }

    /**
     * @dev Renounces a schedule by making it not cancelable.
     * @param scheduleId The ID of the schedule to renounce.
     */
    function _renounce(uint256 scheduleId) internal override {
        // Checks: the schedule is cancelable.
        if (!_schedules[scheduleId].isCancelable) {
            revert Errors.ScheduleNotCancelable(scheduleId);
        }

        // Effects: renounce the schedule by making it not cancelable.
        _schedules[scheduleId].isCancelable = false;
    }

    /**
     * @dev Withdraws funds from a schedule.
     * @param scheduleId The ID of the schedule to withdraw from.
     * @param to The address to withdraw to.
     * @param amount The amount to withdraw.
     */
    function _withdraw(
        uint256 scheduleId,
        address to,
        uint128 amount
    ) internal override {
        // Effects: update the withdrawn amount.
        _schedules[scheduleId].amounts.withdrawn =
            _schedules[scheduleId].amounts.withdrawn +
            amount;

        // Retrieve the amounts from storage.
        Lockup.Amounts memory amounts = _schedules[scheduleId].amounts;

        // Using ">=" instead of "==" for additional safety reasons. In the event of an unforeseen increase in the
        // withdrawn amount, the schedule will still be marked as depleted.
        if (amounts.withdrawn >= amounts.deposited - amounts.refunded) {
            // Effects: mark the schedule as depleted.
            _schedules[scheduleId].isDepleted = true;

            // Effects: make the schedule not cancelable anymore, because a depleted schedule cannot be canceled.
            _schedules[scheduleId].isCancelable = false;
        }

        // Interactions: perform the UNCN {ERC-20} transfer.
        UNCN.safeTransfer({ to: to, value: amount });

        // Log the withdrawal.
        emit IVestingLockup.WithdrawFromLockupSchedule(scheduleId, to, amount);
    }
}

/*

$$\   $$\                                                   
$$ |  $$ |                                                  
$$ |  $$ |$$$$$$$\   $$$$$$$\  $$$$$$\   $$$$$$\  $$$$$$$\  
$$ |  $$ |$$  __$$\ $$  _____|$$  __$$\ $$  __$$\ $$  __$$\ 
$$ |  $$ |$$ |  $$ |\$$$$$$\  $$$$$$$$ |$$$$$$$$ |$$ |  $$ |
$$ |  $$ |$$ |  $$ | \____$$\ $$   ____|$$   ____|$$ |  $$ |
\$$$$$$  |$$ |  $$ |$$$$$$$  |\$$$$$$$\ \$$$$$$$\ $$ |  $$ |
 \______/ \__|  \__|\_______/  \_______| \_______|\__|  \__|   

*/
