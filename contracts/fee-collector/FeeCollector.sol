// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { BaseFeeCollector } from "./BaseFeeCollector.sol";

import { IFeeCollector, IWrappedNativeToken } from "../interfaces/IFeeCollector.sol";

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
 * @title   FeeCollector
 * @author  decapinator.eth
 * @notice  FeeCollector is a contract that inherits the
 *          BaseFeeCollector allowing for native token and ERC20
 *          token withdrawals. In addition, allowing for unwrapping
 *          and transferring WrappedNativeToken.
 */
contract FeeCollector is BaseFeeCollector, IFeeCollector {
    /**
     * @notice Constructor
     * @param ownerToSet The owner of this contract.
     */
    constructor(address ownerToSet) payable {
        if (ownerToSet == address(0)) revert NewOwnerIsZeroAddress();
        // Initialize ownership.
        _initializeOwner(ownerToSet);
    }

    /**
     * @notice Receive function to allow for native token deposits.
     */
    receive() external payable {}

    /**
     * @notice Unwraps and withdraws the given amount of WrappedNative tokens from the
     *         provided contract address. Requires the caller to have the
     *         operator role, and the withdrawal wallet to be in the
     *         allowlisted wallets.
     *
     * @param withdrawalWallet The wallet to be used for withdrawal.
     * @param wrappedTokenContract The token address to be unwrapped.
     * @param amount The amount of tokens to be withdrawn.
     */
    function unwrapAndWithdraw(
        address withdrawalWallet,
        address wrappedTokenContract,
        uint256 amount
    ) external override isOperator {
        // Ensure the withdrawal wallet is in the withdrawal wallet mapping.
        if (_withdrawalWallets[withdrawalWallet] != true) {
            revert InvalidWithdrawalWallet(withdrawalWallet);
        }

        // Make the withdraw call on the provided wrapped token.
        (bool result, bytes memory data) = wrappedTokenContract.call(
            abi.encodeWithSelector(
                IWrappedNativeToken.withdraw.selector,
                amount
            )
        );

        // Revert if we have a false result.
        if (!result) {
            revert TokenTransferGenericFailure(
                wrappedTokenContract,
                withdrawalWallet,
                0,
                amount
            );
        }

        // Revert if we have a bad return value.
        if (data.length != 0 && data.length >= 32) {
            if (!abi.decode(data, (bool))) {
                revert BadReturnValueFromERC20OnTransfer(
                    wrappedTokenContract,
                    withdrawalWallet,
                    amount
                );
            }
        }

        // Transfer the now unwrapped tokens to the withdrawal address.
        payable(withdrawalWallet).transfer(amount);
    }

    /**
     * @notice Retrieve the name of this contract.
     * @return The name of this contract.
     */
    function name() external pure override returns (string memory) {
        // Return the name of the contract.
        return "unseen-fee-collector";
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
