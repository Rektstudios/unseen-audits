// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { UD60x18, ud } from "@prb/math/src/UD60x18.sol";
import { Lockup } from "../types/DataTypes.sol";
import { Errors } from "./Errors.sol";

/// @title Helpers
/// @notice Library with helper functions needed across the UnseenVesting contracts.
library Helpers {
    /// @dev Checks the parameters of the {UnseenVesting-_createSchedule} function.
    function checkCreateSchedule(
        uint128 depositAmount,
        Lockup.Segment[] memory segments,
        uint256 maxSegmentCount,
        uint40 startTime
    ) internal view {
        // Checks: the deposit amount is not zero.
        if (depositAmount == 0) {
            revert Errors.DepositAmountZero();
        }

        // Checks: the segment count is not zero.
        uint256 segmentCount = segments.length;
        if (segmentCount == 0) {
            revert Errors.SegmentCountMismatch();
        }

        // Checks: the segment count is not greater than the maximum allowed.
        if (segmentCount > maxSegmentCount) {
            revert Errors.SegmentCountTooHigh(segmentCount);
        }

        // Checks: requirements of segments variables.
        _checkSegments(segments, depositAmount, startTime);
    }

    /// @dev Checks that:
    ///
    /// 1. The first milestone is strictly greater than the start time.
    /// 2. The milestones are ordered chronologically.
    /// 3. There are no duplicate milestones.
    /// 4. The deposit amount is equal to the sum of all segment amounts.
    function _checkSegments(
        Lockup.Segment[] memory segments,
        uint128 depositAmount,
        uint40 startTime
    ) private view {
        // Checks: the start time is strictly less than the first segment milestone.
        if (startTime >= segments[0].milestone) {
            revert Errors.StartTimeNotLessThanFirstSegmentMilestone(
                startTime,
                segments[0].milestone
            );
        }

        // Pre-declare the variables needed in the for loop.
        uint128 segmentAmountsSum;
        uint40 currentMilestone;
        uint40 previousMilestone;

        // Iterate over the segments to:
        //
        // 1. Calculate the sum of all segment amounts.
        // 2. Check that the milestones are ordered.
        uint256 count = segments.length;
        for (uint256 i; i < count; ) {
            // Add the current segment amount to the sum.
            segmentAmountsSum += segments[i].amount;

            // Checks: the current milestone is strictly greater than the previous milestone.
            currentMilestone = segments[i].milestone;
            if (currentMilestone <= previousMilestone) {
                revert Errors.SegmentMilestonesNotOrdered(
                    i,
                    previousMilestone,
                    currentMilestone
                );
            }

            // Make the current milestone the previous milestone of the next loop iteration.
            previousMilestone = currentMilestone;

            // Increment the loop iterator.
            unchecked {
                ++i;
            }
        }

        // Checks: the last milestone is in the future.
        // When the loop exits, the current milestone is the last milestone, i.e. the schedule's end time.
        uint40 currentTime = uint40(block.timestamp);
        if (currentTime >= currentMilestone) {
            revert Errors.EndTimeNotInTheFuture(currentTime, currentMilestone);
        }

        // Checks: the deposit amount is equal to the segment amounts sum.
        if (depositAmount != segmentAmountsSum) {
            revert Errors.DepositAmountNotEqualToSegmentAmountsSum(
                depositAmount,
                segmentAmountsSum
            );
        }
    }
}
