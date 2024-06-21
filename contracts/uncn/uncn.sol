// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { InterchainTokenStandard } from "@axelar-network/interchain-token-service/contracts/interchain-token/InterchainTokenStandard.sol";
import { Minter } from "@axelar-network/interchain-token-service/contracts/utils/Minter.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Pausable } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import { ERC20Permit, Nonces } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ERC20Votes } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import { Ownable } from "solady/src/auth/Ownable.sol";

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
    InterchainTokenStandard,
    Minter,
    ERC20,
    ERC20Pausable,
    ERC20Permit,
    ERC20Votes
{
    // Internal token ID
    bytes32 internal tokenId;

    // Immutable interchain token service address
    address internal immutable interchainTokenService_;

    // Error: Interchain token service address is zero
    error InterchainTokenServiceAddressZero();

    // Error: Token ID is zero
    error TokenIdZero();

    // Error: Token ID is already set
    error TokenIdIsAlreadySet();

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`) with onchain data.
     *
     * Note that `value` may be zero.
     */
    event TransferWithData(
        address from,
        address to,
        uint256 value,
        string data
    );

    /**
     * @notice Deploy Unseen token contract.
     *
     * @param _owner The owner address to set and receive tokens.
     */
    constructor(
        address _owner,
        address _interchainTokenServiceAddress,
        uint256 _initialSupply
    ) payable ERC20("Unseen Token", "UNCN") ERC20Permit("UNSEEN") {
        if (_owner == address(0)) revert NewOwnerIsZeroAddress();

        _initializeOwner(_owner);

        if (_interchainTokenServiceAddress == address(0)) {
            revert InterchainTokenServiceAddressZero();
        }

        interchainTokenService_ = _interchainTokenServiceAddress;

        if (_initialSupply > _maxSupply()) {
            revert ERC20ExceededSafeSupply(_initialSupply, _maxSupply());
        }

        if (_initialSupply > 0) _mint(_owner, _initialSupply);
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
     * @notice Initialize the bridge parmas.
     *
     * This can only be called by the contract owner and one time.
     */
    function init(bytes32 tokenId_, address tokenManager) external onlyOwner {
        if (tokenId_ == bytes32(0)) revert TokenIdZero();
        if (tokenId_ == tokenId) revert TokenIdIsAlreadySet();
        tokenId = tokenId_;
        _addMinter(tokenManager);
    }

    /**
     * @notice Returns the interchain token service
     * @return address The interchain token service contract
     */
    function interchainTokenService() public view override returns (address) {
        return interchainTokenService_;
    }

    /**
     * @notice Returns the tokenId for this token.
     * @return bytes32 The token manager contract.
     */
    function interchainTokenId() public view override returns (bytes32) {
        return tokenId;
    }

    /**
     * @notice Function to mint new tokens.
     * @dev Can only be called by the minter address.
     * @param account The address that will receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(
        address account,
        uint256 amount
    ) external onlyRole(uint8(Roles.MINTER)) {
        _mint(account, amount);
    }

    /**
     * @dev Destroys a `value` amount of tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(uint256 value) external {
        _burn(_msgSender(), value);
    }

    /**
     * @dev Destroys a `value` amount of tokens from `account`, deducting from
     * the caller's allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     *
     * Requirements:
     *
     * - the caller must have allowance for ``accounts``'s tokens of at least
     * `value`.
     *
     * - if caller has minter role , then we bypass allowance
     */
    function burn(address account, uint256 value) external {
        if (!hasRole(account, uint8(Roles.MINTER))) {
            _spendAllowance(account, _msgSender(), value);
        }
        _burn(account, value);
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

    function _spendAllowance(
        address sender,
        address spender,
        uint256 amount
    ) internal override(ERC20, InterchainTokenStandard) {
        ERC20._spendAllowance(sender, spender, amount);
    }

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
