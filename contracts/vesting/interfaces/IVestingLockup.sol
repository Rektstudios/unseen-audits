// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC20 } from "@openzeppelin-4.9.6/contracts/token/ERC20/IERC20.sol";
import { IERC721Metadata } from "@openzeppelin-4.9.6/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import { Lockup } from "../types/DataTypes.sol";
import { IUnseenVestingNFTDescriptor } from "./IUnseenVestingNFTDescriptor.sol";

/**
 * @title  IVestingLockup
 * @author decapitator (0xdecapitator)
 * @notice Interface for Vesting Lockup Contract
 */
interface IVestingLockup is IERC721Metadata {
    /**
     * @notice Emitted when a schedule is canceled.
     * @param  scheduleId       The id of the schedule.
     * @param  sender           The address of the schedule's sender.
     * @param  recipient        The address of the schedule's recipient.
     * @param  senderAmount     The amount of uncn refunded to the schedule's
     *                          sender, denoted in units of uncn's decimals.
     * @param  recipientAmount  The amount of uncn left for the schedule's
     *                          recipient to withdraw, denoted in units of
     *                          uncn's decimals.
     */
    event CancelLockupSchedule(
        uint256 scheduleId,
        address indexed sender,
        address indexed recipient,
        uint128 senderAmount,
        uint128 recipientAmount
    );

    /**
     * @notice Emitted when a sender gives up the right to cancel a schedule.
     * @param  scheduleId  The id of the schedule.
     */
    event RenounceLockupSchedule(uint256 indexed scheduleId);

    /**
     * @notice Emitted when the admin sets a new NFT descriptor contract.
     * @param  admin             The address of the current contract admin.
     * @param  oldNFTDescriptor  The address of the old NFT descriptor contract.
     * @param  newNFTDescriptor  The address of the new NFT descriptor contract.
     */
    event SetNFTDescriptor(
        address indexed admin,
        IUnseenVestingNFTDescriptor oldNFTDescriptor,
        IUnseenVestingNFTDescriptor newNFTDescriptor
    );

    /**
     * @notice Emitted when uncn tokens are withdrawn from a schedule.
     * @param  scheduleId  The id of the schedule.
     * @param  to          The address that has received the withdrawn uncn
     *                     tokens.
     * @param  amount      The amount of uncn tokens withdrawn, denoted in units
     *                     of uncn's decimals.
     */
    event WithdrawFromLockupSchedule(
        uint256 indexed scheduleId,
        address indexed to,
        uint128 amount
    );

    /**
     * @notice Retrieves Unseen vested token.
     * @return The IERC20 instance of the Unseen vested token.
     */
    function UNCN() external view returns (IERC20);

    /**
     * @notice Retrieves the amount deposited in the schedule, denoted in units
     *         of uncn's decimals.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return depositedAmount The amount deposited.
     */
    function getDepositedAmount(
        uint256 scheduleId
    ) external view returns (uint128 depositedAmount);

    /**
     * @notice Retrieves the schedule's end time, which is a Unix timestamp.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return endTime The end time.
     */
    function getEndTime(
        uint256 scheduleId
    ) external view returns (uint40 endTime);

    /**
     * @notice Retrieves the schedule's recipient.
     * @dev    Reverts if the NFT has been burned.
     * @param  scheduleId  The schedule id for the query.
     * @return recipient The recipient address.
     */
    function getRecipient(
        uint256 scheduleId
    ) external view returns (address recipient);

    /**
     * @notice Retrieves the amount refunded to the sender after a cancellation,
     *         denoted in units of uncn's decimals. This amount is always zero
     *         unless the schedule was canceled.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return refundedAmount The refunded amount.
     */
    function getRefundedAmount(
        uint256 scheduleId
    ) external view returns (uint128 refundedAmount);

    /**
     * @notice Retrieves the schedule's sender.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return sender The sender address.
     */
    function getSender(
        uint256 scheduleId
    ) external view returns (address sender);

    /**
     * @notice Retrieves the schedule's start time, which is a Unix timestamp.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return startTime The start time.
     */
    function getStartTime(
        uint256 scheduleId
    ) external view returns (uint40 startTime);

    /**
     * @notice Retrieves the amount withdrawn from the schedule, denoted in
     *         units of uncn's decimals.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return withdrawnAmount The withdrawn amount.
     */
    function getWithdrawnAmount(
        uint256 scheduleId
    ) external view returns (uint128 withdrawnAmount);

    /**
     * @notice Retrieves a flag indicating whether the schedule can be canceled.
     *         When the schedule is cold, this flag is always `false`.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The cancelable flag.
     */
    function isCancelable(
        uint256 scheduleId
    ) external view returns (bool result);

    /**
     * @notice Retrieves a flag indicating whether the schedule is cold, i.e.
     *         settled, canceled, or depleted.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The cold flag.
     */
    function isCold(uint256 scheduleId) external view returns (bool result);

    /**
     * @notice Retrieves a flag indicating whether the schedule is depleted.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The depleted flag.
     */
    function isDepleted(uint256 scheduleId) external view returns (bool result);

    /**
     * @notice Retrieves a flag indicating whether the schedule exists.
     * @dev    Does not revert if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The exists flag.
     */
    function isSchedule(uint256 scheduleId) external view returns (bool result);

    /**
     * @notice Retrieves a flag indicating whether the schedule NFT can be
     *         transferred.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The transferable flag.
     */
    function isTransferable(
        uint256 scheduleId
    ) external view returns (bool result);

    /**
     * @notice Retrieves a flag indicating whether the schedule is warm, i.e.
     *         either pending or vesting.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The warm flag.
     */
    function isWarm(uint256 scheduleId) external view returns (bool result);

    /**
     * @notice Counter for schedule ids, used in the create functions.
     * @return The next schedule id.
     */
    function nextScheduleId() external view returns (uint256);

    /**
     * @notice Calculates the amount that the sender would be refunded if the
     *         schedule were canceled, denoted in units of uncn's decimals.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return refundableAmount The refundable amount.
     */
    function refundableAmountOf(
        uint256 scheduleId
    ) external view returns (uint128 refundableAmount);

    /**
     * @notice Retrieves the schedule's status.
     * @param  scheduleId  The schedule id for the query.
     * @return status The schedule status.
     */
    function statusOf(
        uint256 scheduleId
    ) external view returns (Lockup.Status status);

    /**
     * @notice Calculates the amount vested to the recipient, denoted in units
     *         of uncn's decimals.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return vestedAmount The vested amount.
     */
    function vestedAmountOf(
        uint256 scheduleId
    ) external view returns (uint128 vestedAmount);

    /**
     * @notice Retrieves a flag indicating whether the schedule was canceled.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return result The canceled flag.
     */
    function wasCanceled(
        uint256 scheduleId
    ) external view returns (bool result);

    /**
     * @notice Calculates the amount that the recipient can withdraw from the
     *         schedule, denoted in units of uncn's decimals.
     * @dev    Reverts if `scheduleId` references a null schedule.
     * @param  scheduleId  The schedule id for the query.
     * @return withdrawableAmount The withdrawable amount.
     */
    function withdrawableAmountOf(
        uint256 scheduleId
    ) external view returns (uint128 withdrawableAmount);

    /**
     * @notice Burns the NFT associated with the schedule.
     * @dev    Emits a {Transfer} event.
     *         Requirements:
     *         - Must not be delegate called.
     *         - `scheduleId` must reference a depleted schedule.
     *         - The NFT must exist.
     *         - `msg.sender` must be either the NFT owner or an approved third
     *           party.
     * @param  scheduleId  The id of the schedule NFT to burn.
     */
    function burn(uint256 scheduleId) external;

    /**
     * @notice Cancels the schedule and refunds any remaining uncn tokens to the
     *         sender.
     * @dev    Emits a {Transfer}, {CancelLockupSchedule}, and {MetadataUpdate}
     *         event.
     *         Notes:
     *         - If there any uncn tokens left for the recipient to withdraw,
     *           the schedule is marked as canceled. Otherwise, the schedule is
     *           marked as depleted.
     *         - This function attempts to invoke a hook on the recipient, if
     *           the resolved address is a contract.
     *         Requirements:
     *         - Must not be delegate called.
     *         - The schedule must be warm and cancelable.
     *         - `msg.sender` must be the schedule's sender.
     * @param  scheduleId  The id of the schedule to cancel.
     */
    function cancel(uint256 scheduleId) external;

    /**
     * @notice Cancels multiple schedules and refunds any remaining uncn tokens
     *         to the sender.
     * @dev    Emits multiple {Transfer}, {CancelLockupSchedule}, and
     *         {MetadataUpdate} events.
     *         Notes:
     *         - Refer to the notes in {cancel}.
     *         Requirements:
     *         - All requirements from {cancel} must be met for each schedule.
     * @param  scheduleIds  The ids of the schedules to cancel.
     */
    function cancelMultiple(uint256[] calldata scheduleIds) external;

    /**
     * @notice Removes the right of the schedule's sender to cancel the
     *         schedule.
     * @dev    Emits a {RenounceLockupSchedule} and {MetadataUpdate} event.
     *         Notes:
     *         - This is an irreversible operation.
     *         - This function attempts to invoke a hook on the schedule's
     *           recipient, provided that the recipient is a contract.
     *         Requirements:
     *         - Must not be delegate called.
     *         - `scheduleId` must reference a warm schedule.
     *         - `msg.sender` must be the schedule's sender.
     *         - The schedule must be cancelable.
     * @param  scheduleId  The id of the schedule to renounce.
     */
    function renounce(uint256 scheduleId) external;

    /**
     * @notice Sets a new NFT descriptor contract, which produces the URI
     *         describing the Unseen vesting schedule NFTs.
     * @dev    Emits a {SetNFTDescriptor} and {BatchMetadataUpdate} event.
     *         Notes:
     *         - Does not revert if the NFT descriptor is the same.
     *         Requirements:
     *         - `msg.sender` must be the contract admin.
     * @param  newNFTDescriptor  The address of the new NFT descriptor contract.
     */
    function setNFTDescriptor(
        IUnseenVestingNFTDescriptor newNFTDescriptor
    ) external;

    /**
     * @notice Withdraws the provided amount of uncn tokens from the schedule to
     *         the `to` address.
     * @dev    Emits a {Transfer}, {WithdrawFromLockupSchedule}, and
     *         {MetadataUpdate} event.
     *         Notes:
     *         - This function attempts to invoke a hook on the schedule's
     *           recipient, provided that the recipient is a contract and
     *           `msg.sender` is either the sender or an approved operator.
     *         Requirements:
     *         - Must not be delegate called.
     *         - `scheduleId` must not reference a null or depleted schedule.
     *         - `msg.sender` must be the schedule's sender, the schedule's
     *           recipient or an approved third party.
     *         - `to` must be the recipient if `msg.sender` is the schedule's
     *           sender.
     *         - `to` must not be the zero address.
     *         - `amount` must be greater than zero and must not exceed the
     *           withdrawable amount.
     * @param  scheduleId  The id of the schedule to withdraw from.
     * @param  to          The address receiving the withdrawn uncn tokens.
     * @param  amount      The amount to withdraw, denoted in units of uncn's
     *                     decimals.
     */
    function withdraw(uint256 scheduleId, address to, uint128 amount) external;

    /**
     * @notice Withdraws the maximum withdrawable amount from the schedule to
     *         the provided address `to`.
     * @dev    Emits a {Transfer}, {WithdrawFromLockupSchedule}, and
     *         {MetadataUpdate} event.
     *         Notes:
     *         - Refer to the notes in {withdraw}.
     *         Requirements:
     *         - Refer to the requirements in {withdraw}.
     * @param  scheduleId  The id of the schedule to withdraw from.
     * @param  to          The address receiving the withdrawn uncn tokens.
     */
    function withdrawMax(uint256 scheduleId, address to) external;

    /**
     * @notice Withdraws the maximum withdrawable amount from the schedule to
     *         the current recipient, and transfers the NFT to `newRecipient`.
     * @dev    Emits a {WithdrawFromLockupSchedule} and a {Transfer} event.
     *         Notes:
     *         - If the withdrawable amount is zero, the withdrawal is skipped.
     *         - Refer to the notes in {withdraw}.
     *         Requirements:
     *         - `msg.sender` must be the schedule's recipient.
     *         - Refer to the requirements in {withdraw}.
     *         - Refer to the requirements in {IERC721.transferFrom}.
     * @param  scheduleId      The id of the schedule NFT to transfer.
     * @param  newRecipient    The address of the new owner of the schedule NFT.
     */
    function withdrawMaxAndTransfer(
        uint256 scheduleId,
        address newRecipient
    ) external;

    /**
     * @notice Withdraws uncn tokens from schedules to the provided address `to`.
     * @dev    Emits multiple {Transfer}, {WithdrawFromLockupSchedule}, and
     *         {MetadataUpdate} events.
     *         Notes:
     *         - This function attempts to call a hook on the recipient of each
     *           schedule, unless `msg.sender` is the recipient.
     *         Requirements:
     *         - All requirements from {withdraw} must be met for each schedule.
     *         - There must be an equal number of `scheduleIds` and `amounts`.
     * @param  scheduleIds  The ids of the schedules to withdraw from.
     * @param  to           The address receiving the withdrawn uncn tokens.
     * @param  amounts      The amounts to withdraw, denoted in units of uncn's
     *                      decimals.
     */
    function withdrawMultiple(
        uint256[] calldata scheduleIds,
        address to,
        uint128[] calldata amounts
    ) external;
}
