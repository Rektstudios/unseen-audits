// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { UD60x18 } from "@prb/math/src/UD60x18.sol";

/**
 * @title  Errors
 * @notice Library containing all custom errors
 *         the protocol may revert with.
 */
library Errors {
    /**
     * @notice Thrown when trying to delegate call
     *         to a function that disallows delegate calls.
     */
    error DelegateCall();

    /**
     * @notice Thrown when trying to create a schedule with a
     *         zero deposit amount.
     */
    error DepositAmountZero();

    /**
     * @notice Thrown when trying to create a schedule with
     *         an end time not in the future.
     */
    error EndTimeNotInTheFuture(uint40 currentTime, uint40 endTime);

    /**
     * @notice Thrown when the schedule's sender tries
     *         to withdraw to an address other than the recipient's.
     */
    error InvalidSenderWithdrawal(
        uint256 scheduleId,
        address sender,
        address to
    );

    /**
     * @notice Thrown when trying to transfer schedule NFT
     *         when transferability is disabled.
     */
    error NotTransferable(uint256 tokenId);

    /**
     * @notice Thrown when the id references a null schedule.
     */
    error Null(uint256 scheduleId);

    /**
     * @notice Thrown when trying to withdraw an amount
     *         greater than the withdrawable amount.
     */
    error Overdraw(
        uint256 scheduleId,
        uint128 amount,
        uint128 withdrawableAmount
    );

    /**
     * @notice Thrown when trying to cancel or renounce
     *         a canceled schedule.
     */
    error ScheduleCanceled(uint256 scheduleId);

    /**
     * @notice Thrown when trying to cancel, renounce,
     *         or withdraw from a depleted schedule.
     */
    error ScheduleDepleted(uint256 scheduleId);

    /**
     * @notice Thrown when trying to cancel or renounce
     *         a schedule that is not cancelable.
     */
    error ScheduleNotCancelable(uint256 scheduleId);

    /**
     * @notice Thrown when trying to burn a schedule that is not depleted.
     */
    error ScheduleNotDepleted(uint256 scheduleId);

    /**
     * @notice Thrown when trying to cancel or renounce a settled schedule.
     */
    error ScheduleSettled(uint256 scheduleId);

    /**
     * @notice Thrown when `msg.sender` lacks authorization to perform an action.
     */
    error Vesting_Unauthorized(uint256 scheduleId, address caller);

    /**
     * @notice Thrown when trying to withdraw zero uncn tokens from a schedule.
     */
    error WithdrawAmountZero(uint256 scheduleId);

    /**
     * @notice Thrown when trying to withdraw from multiple
     *         schedules and the number of schedule ids does
     *         not match the number of withdraw amounts.
     */
    error WithdrawArrayCountsNotEqual(
        uint256 scheduleIdsCount,
        uint256 amountsCount
    );

    /**
     * @notice Thrown when trying to withdraw to the zero address.
     */
    error WithdrawToZeroAddress();

    /**
     * @notice Thrown when trying to create a schedule with a
     *         deposit amount not equal to the sum of the
     *         segment amounts.
     */
    error DepositAmountNotEqualToSegmentAmountsSum(
        uint128 depositAmount,
        uint128 segmentAmountsSum
    );

    /**
     * @notice Thrown when trying to create a schedule with
     *         more segments than the maximum allowed.
     */
    error SegmentCountTooHigh(uint256 count);

    /**
     * @notice Thrown when trying to create a schedule with no segments.
     */
    error SegmentCountMismatch();

    /**
     * @notice Thrown when trying to create a schedule with
     *         unordered segment milestones.
     */
    error SegmentMilestonesNotOrdered(
        uint256 index,
        uint40 previousMilestone,
        uint40 currentMilestone
    );

    /**
     * @notice Thrown when trying to create a schedule with
     *         a start time not strictly less than the first
     *         segment milestone.
     */
    error StartTimeNotLessThanFirstSegmentMilestone(
        uint40 startTime,
        uint40 firstSegmentMilestone
    );

    /**
     * @notice Thrown when NFTDescriptor address is zero.
     */
    error NFTDescriptorIsZeroAddress();

    /**
     * @notice Thrown when the batch size for creating schedules is zero.
     */
    error BatchSizeZero();

    /**
     * @notice Thrown when uncn token address is zero.
     */
    error UNCNIsZeroAddress();
}
