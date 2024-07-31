// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Pausable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { ERC20Burnable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import { ERC20Permit, Nonces } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

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
 * @title  Unseen Governance token
 * @author decapitator (0xdecapitator.eth.eth)
 * @notice ERC20 governance token representing utility
 *         and voting power for the unseen ecosystem
 */
contract UnseenToken is
    Ownable,
    ERC20,
    ERC20Pausable,
    ERC20Burnable,
    ERC20Permit,
    ERC20Votes
{
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`) with onchain data.
     *
     * Note that `value` may be zero.
     */
    event TransferWithData(
        address indexed from,
        address indexed to,
        uint256 value,
        string data
    );

    /**
     * @notice Deploy Unseen token contract.
     *
     * @param _owner The owner address to set and receive tokens.
     */
    constructor(
        address _owner
    )
        payable
        ERC20("Unseen Token", "UNCN")
        Ownable(_owner)
        ERC20Permit("UNSEEN")
    {
        _mint(_owner, 1_000_000_000 ether);
    }

    /**
     * @notice Pauses all pauseable actions within the contract.
     *
     * This can only be called by the contract owner.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses the contract, resuming all pauseable actions.
     *
     * This can only be called by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Transfers tokens from the caller's account
     *              to the specified address along with additional data.
     *
     * @param to    The address to transfer tokens to.
     * @param value The amount of tokens to be transferred.
     * @param data  Additional data to be attached to the transfer.
     * @dev         This function extends the standard ERC20 `transfer` function
     *              by including a data field that can be used to
     *              attach additional information to the transaction.
     *
     * Emits a {TransferWithData} event.
     */
    function transferWithData(
        address to,
        uint256 value,
        string calldata data
    ) external {
        super.transfer(to, value);
        emit TransferWithData(_msgSender(), to, value, data);
    }

    /**
     * @notice Transfers tokens from one address to another
     *             along with additional data.
     *
     * @param from  The address to transfer tokens from.
     * @param to    The address to transfer tokens to.
     * @param value The amount of tokens to be transferred.
     * @param data  Additional data to be attached to the transfer.
     * @dev This function extends the standard ERC20 `transferFrom`
     *      function by including a data field that can be used to attach
     *      additional information to the transaction. The caller must
     *      have allowance for `from`'s tokens for at least `value` amount.
     *
     * Emits a {TransferWithData} event.
     */
    function transferFromWithData(
        address from,
        address to,
        uint256 value,
        string calldata data
    ) external {
        super.transferFrom(from, to, value);
        emit TransferWithData(from, to, value, data);
    }

    /**
     * @notice Returns the current block timestamp as a uint48.
     *
     * This function is an override of a parent function.
     */
    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    /**
     * @notice Provides the mode of the clock used in the contract,
     *         indicating it uses timestamps.
     *
     * This function is an override of a parent function.
     */
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    // The following functions are overrides required by Solidity.

    function _update(
        address from,
        address to,
        uint256 value
    ) internal override(ERC20, ERC20Pausable, ERC20Votes) {
        super._update(from, to, value);
    }

    function nonces(
        address _owner
    ) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(_owner);
    }

    /**
     * @dev Supply is capped.
     */
    function _maxSupply() internal view virtual override returns (uint256) {
        return 1_000_000_000 ether;
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
