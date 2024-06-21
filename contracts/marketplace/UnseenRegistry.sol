// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ProxyRegistry, AuthenticatedProxy } from "./registry/ProxyRegistry.sol";

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
 * @title  UnseenRegistry
 * @author decapitator (0xdecapitator)
 * @notice Registry contract
 */
contract UnseenRegistry is ProxyRegistry {
    string public constant NAME = "Unseen Proxy Registry";

    /* Whether the initial auth address has been set. */
    bool public initialAddressSet = false;

    /* Custom errors */
    error AddressAlreadySet();

    /* Emitted whenever an exchange is authenticated */
    event ExchangeAuthenticated(address indexed Exchange);

    /**
     * @notice Construct a new UnseenRegistry
     */
    constructor(address _owner) payable {
        if (_owner == address(0)) revert NewOwnerIsZeroAddress();

        AuthenticatedProxy impl = new AuthenticatedProxy();
        impl.initialize(address(this), this, address(impl));
        impl.setRevoke(true);
        authProxyImplementation = address(impl);

        _initializeOwner(_owner);
    }

    /**
     * Grant authentication to the initial Exchange protocol contract
     * @param authAddress Address of the contract to grant authentication
     */
    function grantInitialExchangeAuthentication(
        address authAddress
    ) external onlyOwner {
        if (authAddress == address(0)) revert AddressCannotBeZero();
        if (initialAddressSet) {
            revert AddressAlreadySet();
        }
        initialAddressSet = true;
        contracts[authAddress] = true;
        emit ExchangeAuthenticated(authAddress);
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
