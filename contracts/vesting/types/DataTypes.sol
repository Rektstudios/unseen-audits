// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { UD2x18 } from "@prb/math/src/UD2x18.sol";

/**
 * @dev Structs used in UnseenVesting.
 */
library Lockup {
    /**
     * @dev Struct encapsulating the deposit, withdrawn,
     *      and refunded amounts, all denoted in units
     *      of uncn's decimals.
     */
    struct Amounts {
        // Initial amount deposited in the schedule, net of fees.
        uint128 deposited;
        // Cumulative amount withdrawn from the schedule.
        uint128 withdrawn;
        // Amount refunded to the sender. Unless the schedule was canceled, this is always zero.
        uint128 refunded;
    }

    /**
     * @dev Enum representing the different statuses of a schedule.
     */
    enum Status {
        PENDING, // Schedule created but not started; tokens are in a pending state.
        ONGOING, // Active schedule where tokens are currently being vested.
        SETTLED, // All tokens have been vested; recipient is due to withdraw them.
        CANCELED, // Canceled schedule; remaining tokens await recipient's withdrawal.
        DEPLETED // Depleted schedule; all tokens have been withdrawn and/or refunded.
    }

    /**
     * @dev Struct encapsulating the parameters for {UnseenVesting.createSchedule}
     *      function.
     */
    struct CreateSchedule {
        // Address creating the schedule, with the ability to cancel it.
        address sender;
        // Unix timestamp indicating the schedule's start.
        uint40 startTime;
        // Indicates if the schedule is cancelable.
        bool cancelable;
        // Address receiving uncn tokens.
        address recipient;
        // Indicates if the schedule NFT is transferable.
        bool transferable;
        // Total amount of uncn tokens to be paid.
        uint128 totalAmount;
        // Segments used to compose the custom vesting curve.
        Segment[] segments;
    }

    /**
     * @dev Struct encapsulating the time range.
     */
    struct Range {
        // Unix timestamp indicating the schedule's start.
        uint40 start;
        // Unix timestamp indicating the schedule's end.
        uint40 end;
    }

    /**
     * @dev Segment struct used in the Lockup Dynamic schedule.
     */
    struct Segment {
        // Amount of tokens to be vested in this segment, denoted in units of uncn's decimals.
        uint128 amount;
        // Exponent of this segment, denoted as a fixed-point number.
        UD2x18 exponent;
        // Unix timestamp indicating this segment's end.
        uint40 milestone;
    }

    /**
     * @dev Vesting Schedule.
     */
    struct Schedule {
        // Address creating the schedule, with the ability to cancel it.
        address sender;
        // Unix timestamp indicating the schedule's start.
        uint40 startTime;
        // Unix timestamp indicating the schedule's end.
        uint40 endTime;
        // Boolean indicating if the schedule is cancelable.
        bool isCancelable;
        // Boolean indicating if the schedule was canceled.
        bool wasCanceled;
        // Boolean indicating if the schedule is depleted.
        bool isDepleted;
        // Boolean indicating if the struct entity exists.
        bool isSchedule;
        // Boolean indicating if the schedule NFT is transferable.
        bool isTransferable;
        // Struct containing the deposit, withdrawn, and refunded amounts, all denoted in units of uncn's decimals.
        Amounts amounts;
        // Segments used to compose the custom vesting curve.
        Segment[] segments;
    }
}
