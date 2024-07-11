// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC4906 } from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Ownable } from "solady/src/auth/Ownable.sol";
import { IVestingLockup, IERC721Metadata } from "../interfaces/IVestingLockup.sol";
import { IUnseenVestingNFTDescriptor } from "../interfaces/IUnseenVestingNFTDescriptor.sol";
import { Errors } from "../libraries/Errors.sol";
import { Lockup } from "../types/DataTypes.sol";

/**
 * @title  VestingLockup
 * @author decapitator (0xdecapitator)
 * @notice Manages the creation and interaction of
 *         UnseenVesting schedules as ERC-721 (NFTs).
 *         It also provides functionality to cancel,
 *         withdraw from, and transfer these lockups.
 */
abstract contract VestingLockup is IERC4906, IVestingLockup, ERC721, Ownable {
    // The address of the original contract that was deployed.
    address private immutable ORIGINAL;

    // The next schedule id.
    uint256 public override nextScheduleId;

    /// @dev Contract that generates the non-fungible token URI.
    IUnseenVestingNFTDescriptor internal _nftDescriptor;

    /**
     * @notice Prevents delegate calls.
     */
    modifier noDelegateCall() {
        _preventDelegateCall();
        _;
    }

    /**
     * @notice Initializes the VestingLockup contract.
     * @param initialOwner The address of the initial contract owner.
     * @param initialNFTDescriptor The address of the initial
     *                             NFT descriptor.
     */
    constructor(
        address initialOwner,
        IUnseenVestingNFTDescriptor initialNFTDescriptor
    ) payable {
        ORIGINAL = address(this);

        if (address(initialNFTDescriptor) == address(0)) {
            revert Errors.NFTDescriptorIsZeroAddress();
        }

        _nftDescriptor = initialNFTDescriptor;

        if (initialOwner == address(0)) revert NewOwnerIsZeroAddress();

        _initializeOwner(initialOwner);
    }

    /**
     * @notice Checks that `scheduleId` does not reference
     *         a null schedule.
     * @param scheduleId The schedule id to check.
     */
    modifier notNull(uint256 scheduleId) {
        if (!isSchedule(scheduleId)) {
            revert Errors.Null(scheduleId);
        }
        _;
    }

    /**
     * @notice Retrieves the recipient of the schedule.
     * @param scheduleId The schedule id for the query.
     * @return recipient The address of the recipient.
     */
    function getRecipient(
        uint256 scheduleId
    ) external view override returns (address recipient) {
        _requireOwned({ tokenId: scheduleId });
        recipient = _ownerOf(scheduleId);
    }

    /**
     * @notice Checks if the schedule is cold (settled, canceled,
     *         or depleted).
     * @param scheduleId The schedule id for the query.
     * @return result True if the schedule is cold, false otherwise.
     */
    function isCold(
        uint256 scheduleId
    ) external view override notNull(scheduleId) returns (bool result) {
        Lockup.Status status = _statusOf(scheduleId);
        result =
            status == Lockup.Status.SETTLED ||
            status == Lockup.Status.CANCELED ||
            status == Lockup.Status.DEPLETED;
    }

    /**
     * @notice Checks if the schedule is depleted.
     * @param scheduleId The schedule id for the query.
     * @return result True if the schedule is depleted,
     *                false otherwise.
     */
    function isDepleted(
        uint256 scheduleId
    ) public view virtual override returns (bool result);

    /**
     * @notice Checks if the schedule exists.
     * @param scheduleId The schedule id for the query.
     * @return result True if the schedule exists, false otherwise.
     */
    function isSchedule(
        uint256 scheduleId
    ) public view virtual override returns (bool result);

    /**
     * @notice Checks if the schedule is warm (pending or ongoing).
     * @param scheduleId The schedule id for the query.
     * @return result True if the schedule is warm, false otherwise.
     */
    function isWarm(
        uint256 scheduleId
    ) external view override notNull(scheduleId) returns (bool result) {
        Lockup.Status status = _statusOf(scheduleId);
        result =
            status == Lockup.Status.PENDING ||
            status == Lockup.Status.ONGOING;
    }

    /**
     * @notice Retrieves the URI for the given schedule.
     * @param scheduleId The schedule id for the query.
     * @return uri The URI string.
     */
    function tokenURI(
        uint256 scheduleId
    )
        public
        view
        override(IERC721Metadata, ERC721)
        returns (string memory uri)
    {
        _requireOwned({ tokenId: scheduleId });
        uri = _nftDescriptor.tokenURI({
            unseenVesting: address(this),
            scheduleId: scheduleId
        });
    }

    /**
     * @notice Checks if the schedule was canceled.
     * @param scheduleId The schedule id for the query.
     * @return result True if the schedule was canceled,
     *                false otherwise.
     */
    function wasCanceled(
        uint256 scheduleId
    ) public view virtual override returns (bool result);

    /**
     * @notice Retrieves the withdrawable amount from the schedule.
     * @param scheduleId The schedule id for the query.
     * @return withdrawableAmount The amount that can be withdrawn.
     */
    function withdrawableAmountOf(
        uint256 scheduleId
    )
        external
        view
        override
        notNull(scheduleId)
        returns (uint128 withdrawableAmount)
    {
        withdrawableAmount = _withdrawableAmountOf(scheduleId);
    }

    /**
     * @notice Checks if the schedule is transferable.
     * @param scheduleId The schedule id for the query.
     * @return result True if the schedule is transferable,
     *                false otherwise.
     */
    function isTransferable(
        uint256 scheduleId
    ) public view virtual returns (bool);

    /**
     * @notice Burns the NFT associated with the schedule.
     * @param scheduleId The id of the schedule NFT to burn.
     */
    function burn(uint256 scheduleId) external override noDelegateCall {
        if (!isDepleted(scheduleId)) {
            revert Errors.ScheduleNotDepleted(scheduleId);
        }

        if (!_isCallerScheduleRecipientOrApproved(scheduleId)) {
            revert Errors.Vesting_Unauthorized(scheduleId, msg.sender);
        }

        _burn({ tokenId: scheduleId });
    }

    /**
     * @notice Cancels the schedule and refunds any remaining
     *         uncn tokens to the sender.
     * @param scheduleId The id of the schedule to cancel.
     */
    function cancel(uint256 scheduleId) public override noDelegateCall {
        if (isDepleted(scheduleId)) {
            revert Errors.ScheduleDepleted(scheduleId);
        } else if (wasCanceled(scheduleId)) {
            revert Errors.ScheduleCanceled(scheduleId);
        }

        if (!_isCallerScheduleSender(scheduleId)) {
            revert Errors.Vesting_Unauthorized(scheduleId, msg.sender);
        }

        _cancel(scheduleId);
    }

    /**
     * @notice Cancels multiple schedules and refunds any remaining
     *         uncn tokens to the sender.
     * @param scheduleIds The ids of the schedules to cancel.
     */
    function cancelMultiple(
        uint256[] calldata scheduleIds
    ) external override noDelegateCall {
        uint256 count = scheduleIds.length;
        for (uint256 i; i < count; ) {
            cancel(scheduleIds[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Renounces the right of the schedule's sender to
     *         cancel the schedule.
     * @param scheduleId The id of the schedule to renounce.
     */
    function renounce(
        uint256 scheduleId
    ) external override noDelegateCall notNull(scheduleId) {
        Lockup.Status status = _statusOf(scheduleId);
        if (status == Lockup.Status.DEPLETED) {
            revert Errors.ScheduleDepleted(scheduleId);
        } else if (status == Lockup.Status.CANCELED) {
            revert Errors.ScheduleCanceled(scheduleId);
        } else if (status == Lockup.Status.SETTLED) {
            revert Errors.ScheduleSettled(scheduleId);
        }

        if (!_isCallerScheduleSender(scheduleId)) {
            revert Errors.Vesting_Unauthorized(scheduleId, msg.sender);
        }

        _renounce(scheduleId);
        emit IVestingLockup.RenounceLockupSchedule(scheduleId);

        emit MetadataUpdate({ _tokenId: scheduleId });
    }

    /**
     * @notice Sets a new NFT descriptor contract, which produces
     *         the URI describing the Unseen vesting schedule NFTs.
     * @param newNFTDescriptor The address of the new NFT descriptor contract.
     */
    function setNFTDescriptor(
        IUnseenVestingNFTDescriptor newNFTDescriptor
    ) external override onlyOwner {
        IUnseenVestingNFTDescriptor oldNftDescriptor = _nftDescriptor;
        _nftDescriptor = newNFTDescriptor;

        emit IVestingLockup.SetNFTDescriptor({
            admin: msg.sender,
            oldNFTDescriptor: oldNftDescriptor,
            newNFTDescriptor: newNFTDescriptor
        });

        emit BatchMetadataUpdate({
            _fromTokenId: 1,
            _toTokenId: nextScheduleId - 1
        });
    }

    /**
     * @notice Withdraws the provided amount of uncn tokens from the
     *         schedule to the `to` address.
     * @param scheduleId The id of the schedule to withdraw from.
     * @param to The address receiving the withdrawn uncn tokens.
     * @param amount The amount to withdraw, denoted in units of
     *               uncn's decimals.
     */
    function withdraw(
        uint256 scheduleId,
        address to,
        uint128 amount
    ) public override noDelegateCall {
        if (isDepleted(scheduleId)) {
            revert Errors.ScheduleDepleted(scheduleId);
        }

        if (to == address(0)) {
            revert Errors.WithdrawToZeroAddress();
        }

        if (amount == 0) {
            revert Errors.WithdrawAmountZero(scheduleId);
        }

        bool isCallerScheduleSender = _isCallerScheduleSender(scheduleId);

        if (
            !isCallerScheduleSender &&
            !_isCallerScheduleRecipientOrApproved(scheduleId)
        ) {
            revert Errors.Vesting_Unauthorized(scheduleId, msg.sender);
        }

        address recipient = _ownerOf(scheduleId);

        if (isCallerScheduleSender && to != recipient) {
            revert Errors.InvalidSenderWithdrawal(scheduleId, msg.sender, to);
        }

        uint128 withdrawableAmount = _withdrawableAmountOf(scheduleId);
        if (amount > withdrawableAmount) {
            revert Errors.Overdraw(scheduleId, amount, withdrawableAmount);
        }

        _withdraw(scheduleId, to, amount);

        emit MetadataUpdate({ _tokenId: scheduleId });
    }

    /**
     * @notice Withdraws the maximum withdrawable amount from the
     *         schedule to the provided address `to`.
     * @param scheduleId The id of the schedule to withdraw from.
     * @param to The address receiving the withdrawn uncn tokens.
     */
    function withdrawMax(uint256 scheduleId, address to) external override {
        withdraw({
            scheduleId: scheduleId,
            to: to,
            amount: _withdrawableAmountOf(scheduleId)
        });
    }

    /**
     * @notice Withdraws the maximum withdrawable amount from the
     *         schedule to the current recipient, and transfers the
     *         NFT to `newRecipient`.
     * @param scheduleId The id of the schedule NFT to transfer.
     * @param newRecipient The address of the new owner of the schedule
     *                     NFT.
     */
    function withdrawMaxAndTransfer(
        uint256 scheduleId,
        address newRecipient
    ) external override noDelegateCall notNull(scheduleId) {
        address currentRecipient = _ownerOf(scheduleId);
        if (msg.sender != currentRecipient) {
            revert Errors.Vesting_Unauthorized(scheduleId, msg.sender);
        }

        uint128 withdrawableAmount = _withdrawableAmountOf(scheduleId);
        if (withdrawableAmount > 0) {
            withdraw({
                scheduleId: scheduleId,
                to: currentRecipient,
                amount: withdrawableAmount
            });
        }

        _transfer({
            from: currentRecipient,
            to: newRecipient,
            tokenId: scheduleId
        });
    }

    /**
     * @notice Withdraws uncn tokens from schedules to the provided
     *         address `to`.
     * @param scheduleIds The ids of the schedules to withdraw from.
     * @param to The address receiving the withdrawn uncn tokens.
     * @param amounts The amounts to withdraw, denoted in units of
     *                uncn's decimals.
     */
    function withdrawMultiple(
        uint256[] calldata scheduleIds,
        address to,
        uint128[] calldata amounts
    ) external override noDelegateCall {
        uint256 scheduleIdsCount = scheduleIds.length;
        uint256 amountsCount = amounts.length;
        if (scheduleIdsCount != amountsCount) {
            revert Errors.WithdrawArrayCountsNotEqual(
                scheduleIdsCount,
                amountsCount
            );
        }

        for (uint256 i; i < scheduleIdsCount; ) {
            withdraw(scheduleIds[i], to, amounts[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev This function checks whether the current call is a
     *      delegate call, and reverts if it is.
     */
    function _preventDelegateCall() private view {
        if (address(this) != ORIGINAL) {
            revert Errors.DelegateCall();
        }
    }

    /// @notice Overrides the {ERC-721._update} function to check that the schedule is transferable, and emits an
    /// ERC-4906 event.
    /// @dev There are two cases when the transferable flag is ignored:
    /// - If the current owner is 0, then the update is a mint and is allowed.
    /// - If `to` is 0, then the update is a burn and is also allowed.
    /// @param to The address of the new recipient of the schedule.
    /// @param scheduleId ID of the schedule to update.
    /// @param auth Optional parameter. If the value is not zero, the overridden implementation will check that
    /// `auth` is either the recipient of the schedule, or an approved third party.
    /// @return The original recipient of the `schedule` before the update.
    function _update(
        address to,
        uint256 scheduleId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(scheduleId);

        if (
            from != address(0) &&
            to != address(0) &&
            !isTransferable(scheduleId)
        ) {
            revert Errors.NotTransferable(scheduleId);
        }

        // Emit an ERC-4906 event to trigger an update of the NFT metadata.
        emit MetadataUpdate({ _tokenId: scheduleId });

        return super._update(to, scheduleId, auth);
    }

    /**
     * @notice Checks whether `msg.sender` is the schedule's sender.
     * @param scheduleId The schedule id for the query.
     * @return True if `msg.sender` is the schedule's sender, false otherwise.
     */
    function _isCallerScheduleSender(
        uint256 scheduleId
    ) internal view virtual returns (bool);

    /**
     * @dev Checks if the caller is the sender of the schedule.
     * @param scheduleId The ID of the schedule.
     * @return True if the caller is approved.
     */
    function _isCallerScheduleRecipientOrApproved(
        uint256 scheduleId
    ) internal view virtual returns (bool);

    /**
     * @notice Retrieves the schedule's status without performing a
     *         null check.
     * @param scheduleId The schedule id for the query.
     * @return The status of the schedule.
     */
    function _statusOf(
        uint256 scheduleId
    ) internal view virtual returns (Lockup.Status);

    /**
     * @notice Calculates the amount that can be withdrawn from
     *         the schedule.
     * @param scheduleId The schedule id for the query.
     * @return The withdrawable amount.
     */
    function _withdrawableAmountOf(
        uint256 scheduleId
    ) internal view virtual returns (uint128);

    /**
     * @notice Cancels the schedule.
     * @param scheduleId The id of the schedule to cancel.
     */
    function _cancel(uint256 scheduleId) internal virtual;

    /**
     * @notice Renounces the right of the schedule's sender to cancel
     *         the schedule.
     * @param scheduleId The id of the schedule to renounce.
     */
    function _renounce(uint256 scheduleId) internal virtual;

    /**
     * @notice Withdraws uncn tokens from the schedule.
     * @param scheduleId The id of the schedule to withdraw from.
     * @param to The address receiving the withdrawn uncn tokens.
     * @param amount The amount to withdraw, denoted in units of
     *               uncn's decimals.
     */
    function _withdraw(
        uint256 scheduleId,
        address to,
        uint128 amount
    ) internal virtual;
}
