// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TGenContract, SafeTransferLib } from "./extensions/TGenContract.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
 * @title  TheGenerates
 * @author decapitator (0xdecapitator.eth)
 * @notice An ERC721 token contract based on ERC721A that can mint NFTs.
 *         Implements Limit Break's Creator Token Standards transfer
 *         validation for royalty enforcement.
 */
contract TheGenerates is TGenContract {
    /**
     * @notice Deploy the token contract.
     *
     * @param allowedConfigurer The address of the contract allowed to
     *                          implementation code. Also contains
     *                          TheGenerates implementation code.
     * @param ownerToSet        The owner address to set.
     */
    constructor(
        address allowedConfigurer,
        address ownerToSet
    ) payable TGenContract(allowedConfigurer) {
        if (ownerToSet == address(0)) revert NewOwnerIsZeroAddress();
        // Set the owner.
        _initializeOwner(ownerToSet);
    }

    /**
     * @notice Withdraws contract balance to the contract owner.
     *         Provided as a safety measure to rescue stuck funds since ERC721A
     *         makes all methods payable for gas efficiency reasons.
     *
     *         Only the owner can use this function.
     */
    function withdraw() external {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        // Put the balance on the stack.
        uint256 balance = address(this).balance;

        // Revert if the contract has no balance.
        if (balance == 0) {
            revert NoBalanceToWithdraw();
        }

        // Send contract balance to the owner.
        (bool success, bytes memory data) = payable(owner()).call{
            value: balance
        }("");

        // Require that the call was successful.
        if (!success) {
            // Bubble up the revert reason.
            assembly {
                revert(add(32, data), mload(data))
            }
        }
    }

    /**
     * @notice Withdraws contract erc20 tokens balance to the contract owner.
     *         Provided as a safety measure to rescue stuck funds.
     *
     *         Only the owner can use this function.
     */
    function withdrawERC20(address token) external {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        uint256 balance = IERC20(token).balanceOf(address(this));

        if (balance == 0) {
            revert NoBalanceToWithdraw();
        }

        SafeTransferLib.safeTransfer(token, owner(), balance);
    }

    /**
     * @notice Burns `tokenId`. The caller must own `tokenId` or be an
     *         approved operator.
     *
     * @param tokenId The token id to burn.
     */
    function burn(uint256 tokenId) external virtual {
        // Passing `true` to `_burn()` checks that the caller owns the token
        // or is an approved operator.
        _burn(tokenId, true);
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
