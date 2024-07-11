// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Lockup } from "../types/DataTypes.sol";
import { IVestingLockup } from "./IVestingLockup.sol";

/**
 * @title  IUnseenVesting
 * @author decapitator (0xdecapitator)
 * @notice Creates and manages dynamic vesting schedules.
 */
interface IUnseenVesting is IVestingLockup {
    /**
     * @notice Emitted when a schedule is created.
     * @param scheduleId   The id of the newly created schedule.
     * @param funder       The address which has funded the schedule.
     * @param sender       The address from which to deposit uncn tokens,
     *                     who will have the ability to cancel the schedule.
     * @param recipient    The address toward which to vest the tokens.
     * @param amounts      The deposit amount, denoted in units of uncn's
     *                     decimals.
     * @param cancelable   Boolean indicating whether the schedule will be
     *                     cancelable or not.
     * @param transferable Boolean indicating whether the schedule NFT is
     *                     transferable or not.
     * @param segments     The segments the protocol uses to compose the
     *                     custom vesting curve.
     * @param range        Struct containing (i) the schedule's start time
     *                     and (ii) end time, both as Unix timestamps.
     */
    event CreateSchedule(
        uint256 scheduleId,
        address funder,
        address indexed sender,
        address indexed recipient,
        uint256 amounts,
        bool cancelable,
        bool transferable,
        Lockup.Segment[] segments,
        Lockup.Range range
    );

    /**
     * @notice The maximum number of segments allowed in a schedule.
     * @dev This is initialized at construction time and cannot be changed later.
     */
    function MAX_SEGMENT_COUNT() external view returns (uint256);

    /**
     * @notice Retrieves the schedule's range, which is a struct
     *         containing (i) the schedule's start time and (ii)
     *         end time, both as Unix timestamps.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId The schedule id for the query.
     */
    function getRange(
        uint256 scheduleId
    ) external view returns (Lockup.Range memory range);

    /**
     * @notice Retrieves the segments the protocol uses to compose
     *         the custom vesting curve.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId The schedule id for the query.
     */
    function getSegments(
        uint256 scheduleId
    ) external view returns (Lockup.Segment[] memory segments);

    /**
     * @notice Retrieves the schedule entity.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId The schedule id for the query.
     */
    function getSchedule(
        uint256 scheduleId
    ) external view returns (Lockup.Schedule memory schedule);

    /**
     * @notice Calculates the amount vested to the recipient,
     *         denoted in units of uncn's decimals.
     *         When the schedule is warm, the vesting function is:
     *         f(x) = x^{exp} * csa + \Sigma(esa)
     *         Where:
     *         - $x$ is the elapsed time divided by the total time
     *           in the current segment.
     *         - $exp$ is the current segment exponent.
     *         - $csa$ is the current segment amount.
     *         - $\Sigma(esa)$ is the sum of all elapsed segments' amounts.
     *         Upon cancellation of the schedule, the amount vested is calculated
     *         as the difference between the deposited amount and the refunded amount.
     *         Ultimately, when the schedule becomes depleted, the vested amount
     *         is equivalent to the total amount withdrawn.
     *
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId The schedule id for the query.
     */
    function vestedAmountOf(
        uint256 scheduleId
    ) external view returns (uint128 vestedAmount);

    /**
     * @notice Creates a schedule with the provided segment milestones,
     *         implying the end time from the last milestone.
     *         The schedule is funded by `msg.sender` and is wrapped
     *         in an ERC-721 NFT.
     *         Notes:
     *         - As long as the segment milestones are arranged in ascending
     *           order, it is not an error for some of them to be in the past.
     *         Requirements:
     *         - Must not be delegate called.
     *         -`params.totalAmount` must be greater than zero.
     *         -`params.segments` must have at least one segment,
     *           but not more than `MAX_SEGMENT_COUNT`.
     *         -`params.startTime` must be less than the first segment's milestone.
     *         - The segment milestones must be arranged in ascending order.
     *         - The last segment milestone (i.e. the schedule's end time)
     *           must be in the future.
     *         - The sum of the segment amounts must equal the deposit amount.
     *         -`params.recipient` must not be the zero address.
     *         -`msg.sender` must have allowed this contract to spend at
     *           least `params.totalAmount` of uncn tokens.
     *
     * @dev    Emits a {Transfer} and {CreateSchedule} event.
     * @param  params Struct encapsulating the function parameters,
     *         which are documented in {DataTypes}.
     * @return scheduleId The id of the newly created schedule.
     */
    function createSchedule(
        Lockup.CreateSchedule calldata params
    ) external returns (uint256 scheduleId);

    /**
     * @notice Batch Create schedules using createMultiSchedules.
     *         Requirements::
     *         - There must be at least one element in `schedulesParams`.
     *         - All requirements from {IUnseenVesting.createSchedule}
     *           must be met for each schedule.
     * @param  schedulesParams An array of structs, each encapsulating
     *         a subset of the parameters of
     *         {UnseenVesting.createMultiSchedules}.
     * @return scheduleIds The ids of the newly created schedules.
     */
    function createMultiSchedules(
        Lockup.CreateSchedule[] calldata schedulesParams
    ) external returns (uint256[] memory scheduleIds);
}
