// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Exchange } from "./exchange/Exchange.sol";

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
 * @title  UnseenExchange
 * @author decapitator (0xdecapitator.eth)
 * @notice Exchange contract that can trade any digital asset
 */
contract UnseenExchange is Exchange {
    /// @notice contract name and version
    string public constant NAME = "Unseen Marketplace";
    string public constant VERSION = "1.0.0";

    /**
     * Initializes the exchange and migrates the registries
     * @param _registryAddrs a list of the registries that this
     *        exchange will be compatible with. Must be mutual
     *        (i.e. this exchange must be an approved caller of
     *        the registry and vice versa)
     * @param _owner Owner address
     * @param _protocolFeeRecipient protocol fee relayer
     * @param _pFee fee amount
     */
    constructor(
        address[] memory _registryAddrs,
        address _owner,
        address _protocolFeeRecipient,
        uint256 _pFee
    ) payable {
        uint256 registryAddrsLength = _registryAddrs.length;
        if (registryAddrsLength == 0) {
            revert MinimumOneAddress();
        }
        if (_protocolFeeRecipient == address(0)) {
            revert TreasuryIsZeroAddress();
        }
        if (_owner == address(0)) revert NewOwnerIsZeroAddress();
        _initializeOwner(_owner);
        protocolFeeRecipient = _protocolFeeRecipient;
        pFee = _pFee;
        for (uint256 i; i < registryAddrsLength; ) {
            if (_registryAddrs[i] == address(0)) {
                revert RegistryIsZeroAddress();
            }
            registries[_registryAddrs[i]] = true;
            unchecked {
                ++i;
            }
        }
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
