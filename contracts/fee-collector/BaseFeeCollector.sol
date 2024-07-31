// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { Ownable } from "solady/src/auth/Ownable.sol";
import { IERC20, IBaseFeeCollector } from "../interfaces/IBaseFeeCollector.sol";
import { IBaseFeeCollectorEventsAndErrors } from "../interfaces/IBaseFeeCollectorEventsAndErrors.sol";

/**
 * @title  BaseFeeCollector
 * @author decapitator (0xdecapitator.eth)
 * @notice BaseFeeCollector allows for withdrawal of the native token and all ERC20 standard tokens.
 *         The contract inherits Ownable to allow for ownership modifiers.
 *
 */
contract BaseFeeCollector is
    Ownable,
    IBaseFeeCollector,
    IBaseFeeCollectorEventsAndErrors
{
    // The operator address.
    address public _operator;

    // Mapping of valid withdrawal wallets.
    mapping(address => bool) internal _withdrawalWallets;

    /**
     * @dev Throws if called by any account other than the owner or
     *      operator.
     */
    modifier isOperator() {
        if (msg.sender != _operator && msg.sender != owner()) {
            revert InvalidOperator();
        }
        _;
    }

    /**
     * @notice Constructor
     */
    constructor() payable {}

    /**
     * @notice Withdrawals the given amount of ERC20 tokens from the provided
     *         contract address. Requires the caller to have the operator role,
     *         and the withdrawal wallet to be in the allowlisted wallets.
     *
     * @param withdrawalWallet The wallet to be used for withdrawal.
     * @param tokenContract    The ERC20 token address to be withdrawn.
     * @param amount           The amount of ERC20 tokens to be withdrawn.
     */
    function withdrawERC20Tokens(
        address withdrawalWallet,
        address tokenContract,
        uint256 amount
    ) external override isOperator {
        // Ensure the withdrawal wallet is in the withdrawal wallet mapping.
        if (!_withdrawalWallets[withdrawalWallet]) {
            revert InvalidWithdrawalWallet(withdrawalWallet);
        }

        // Make the transfer call on the provided ERC20 token.
        (bool result, bytes memory data) = tokenContract.call(
            abi.encodeWithSelector(
                IERC20.transfer.selector,
                withdrawalWallet,
                amount
            )
        );

        // Revert if we have a false result.
        if (!result) {
            revert TokenTransferGenericFailure(
                tokenContract,
                withdrawalWallet,
                0,
                amount
            );
        }

        // Revert if we have a bad return value.
        if (data.length != 0 && data.length >= 32) {
            if (!abi.decode(data, (bool))) {
                revert BadReturnValueFromERC20OnTransfer(
                    tokenContract,
                    withdrawalWallet,
                    amount
                );
            }
        }
    }

    /**
     * @notice Withdrawals the given amount of the native token from this
     *         contract to the withdrawal address. Requires the caller to
     *         have the operator role, and the withdrawal wallet to be in
     *         the allowlisted wallets.
     *
     * @param withdrawalWallet The wallet to be used for withdrawal.
     * @param amount The amount of the native token to be withdrawn.
     */
    function withdraw(
        address withdrawalWallet,
        uint256 amount
    ) external override isOperator {
        // Ensure the withdrawal wallet is in the withdrawal wallet mapping.
        if (_withdrawalWallets[withdrawalWallet] != true) {
            revert InvalidWithdrawalWallet(withdrawalWallet);
        }

        // Ensure the amount to withdraw is valid.
        if (amount > address(this).balance) {
            revert InvalidNativeTokenAmount(amount);
        }

        // Transfer the amount of the native token to the withdrawal address.
        (bool success, bytes memory data) = payable(withdrawalWallet).call{
            value: amount
        }("");

        // Revert with an error if the ether transfer failed.
        if (!success) {
            revert ETHTransferFailure(withdrawalWallet, amount, data);
        }
    }

    /**
     * @notice Adds a new withdrawal address to the mapping. Requires
     *         the caller to be the owner and the withdrawal
     *         wallet to not be the null address.
     * @param newWithdrawalWallet The new withdrawal address.
     */
    function addWithdrawAddress(
        address newWithdrawalWallet
    ) external override onlyOwner {
        ///@dev Ensure the new owner is not an invalid address.
        if (newWithdrawalWallet == address(0)) {
            revert NewWithdrawalWalletIsNullAddress();
        }

        ///@dev Set the new wallet address mapping.
        _setWithdrawalWallet(newWithdrawalWallet, true);

        emit WithdrawalWalletUpdated(newWithdrawalWallet, true);
    }

    /**
     * @notice Removes the withdrawal address from the mapping. Requires the caller to be the owner.
     * @param withdrawalWallet The withdrawal address to remove.
     */
    function removeWithdrawAddress(
        address withdrawalWallet
    ) external override onlyOwner {
        ///@dev Set the withdrawal wallet to false.
        _setWithdrawalWallet(withdrawalWallet, false);

        emit WithdrawalWalletUpdated(withdrawalWallet, false);
    }

    /**
     * @notice Assign the given address with the ability to operate the wallet. Requires caller to be the owner.
     * @param operatorToAssign The address to assign the operator role.
     */
    function assignOperator(
        address operatorToAssign
    ) external override onlyOwner {
        ///@dev Ensure the operator to assign is not an invalid address.
        if (operatorToAssign == address(0)) {
            revert OperatorIsNullAddress();
        }

        ///@dev Set the given account as the operator.
        _operator = operatorToAssign;

        ///@dev Emit an event indicating the operator has been assigned.
        emit OperatorUpdated(_operator);
    }

    /**
     * @notice An external view function that returns a boolean.
     * @return A boolean that determines if the provided address is a valid withdrawal wallet.
     */
    function isWithdrawalWallet(
        address withdrawalWallet
    ) external view override returns (bool) {
        ///@dev Return if the wallet is in the allow list.
        return _withdrawalWallets[withdrawalWallet];
    }

    /**
     * @notice Internal function to set the withdrawal wallet mapping.
     * @param withdrawalAddress The address to be set as the withdrawal wallet.
     * @param valueToSet The boolean to set for the mapping.
     */
    function _setWithdrawalWallet(
        address withdrawalAddress,
        bool valueToSet
    ) internal {
        ///@dev Set the withdrawal address mapping.
        _withdrawalWallets[withdrawalAddress] = valueToSet;
    }
}
