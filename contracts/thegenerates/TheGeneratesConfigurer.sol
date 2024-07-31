// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TheGeneratesImplementation } from "./extensions/TheGeneratesImplementation.sol";

import { ConfigStructs } from "./types/DataTypes.sol";

import { IContractMetadata } from "./interfaces/IContractMetadata.sol";

import { ITheGenerates } from "./interfaces/ITheGenerates.sol";

import { IERC173 } from "./interfaces/IERC173.sol";

/*

$$$$$$$\            $$\         $$\            $$$$$$\    $$\                     $$\ $$\                     
$$  __$$\           $$ |        $$ |          $$  __$$\   $$ |                    $$ |\__|                    
$$ |  $$ | $$$$$$\  $$ |  $$\ $$$$$$\         $$ /  \__|$$$$$$\   $$\   $$\  $$$$$$$ |$$\  $$$$$$\   $$$$$$$\ 
$$$$$$$  |$$  __$$\ $$ | $$  |\_$$  _|        \$$$$$$\  \_$$  _|  $$ |  $$ |$$  __$$ |$$ |$$  __$$\ $$  _____|
$$  __$$< $$$$$$$$ |$$$$$$  /   $$ |           \____$$\   $$ |    f$$ |  $$ |$$ /  $$ |$$ |$$ /  $$ |\$$$$$$\  
$$ |  $$ |$$   ____|$$  _$$<    $$ |$$\       $$\   $$ |  $$ |$$\ $$ |  $$ |$$ |  $$ |$$ |$$ |  $$ | \____$$\ 
$$ |  $$ |\$$$$$$$\ $$ | \$$\   \$$$$  |      \$$$$$$  |  \$$$$  |\$$$$$$  |\$$$$$$$ |$$ |\$$$$$$  |$$$$$$$  |
\__|  \__| \_______|\__|  \__|   \____/        \______/    \____/  \______/  \_______|\__| \______/ \_______/   

*/

/**
 * @title  TheGeneratesConfigurer
 * @author decapitator (0xdecapitator.eth)
 * @notice A helper contract to configure TheGenerates parameters.
 */
contract TheGeneratesConfigurer is TheGeneratesImplementation {
    /**
     * @notice Revert with an error if the sender is not the owner
     *         of the token contract.
     */
    error Unauthorized();

    /**
     * @dev Reverts if the sender is not the owner of the token.
     *
     *      This is used as a function instead of a modifier
     *      to save contract space when used multiple times.
     */
    function _onlyOwner(address token) internal view {
        if (msg.sender != IERC173(token).owner()) {
            revert Unauthorized();
        }
    }

    /**
     * @notice Configure multiple properties at a time.
     *
     *         Only the owner of the token can use this function.
     *
     *         Note: The individual configure methods should be used
     *         to unset or reset any properties to zero, as this method
     *         will ignore zero-value properties in the config struct.
     *
     * @param token  TheGenerates contract address.
     * @param config The configuration struct.
     */
    function multiConfigure(
        address token,
        ConfigStructs.MultiConfigureStruct calldata config
    ) external {
        // Ensure the sender is the owner of the token.
        _onlyOwner(token);

        if (config.maxSupply != 0) {
            IContractMetadata(token).setMaxSupply(config.maxSupply);
        }
        if (bytes(config.baseURI).length != 0) {
            IContractMetadata(token).setBaseURI(config.baseURI);
        }
        if (bytes(config.contractURI).length != 0) {
            IContractMetadata(token).setContractURI(config.contractURI);
        }
        if (config.provenanceHash != bytes32(0)) {
            IContractMetadata(token).setProvenanceHash(config.provenanceHash);
        }
        if (
            _cast(config.royaltyReceiver != address(0)) &
                _cast(config.royaltyBps != 0) ==
            1
        ) {
            IContractMetadata(token).setDefaultRoyalty(
                config.royaltyReceiver,
                config.royaltyBps
            );
        }

        if (
            _cast(config.publicDrop.startTime != 0) &
                _cast(config.publicDrop.endTime != 0) ==
            1
        ) {
            ITheGenerates(address(token)).updatePublicDrop(config.publicDrop);
        }
        if (config.merkleRoot != bytes32(0)) {
            ITheGenerates(address(token)).updateAllowList(config.merkleRoot);
        }
        if (_cast(config.unseenPayout.payoutAddress != address(0)) == 1) {
            ITheGenerates(address(token)).updateUnseenPayout(
                config.unseenPayout
            );
        }
        if (config.allowedSigner != address(0)) {
            ITheGenerates(address(token)).updateSigner(config.allowedSigner);
        }
        if (config.paymentToken != address(0)) {
            ITheGenerates(address(token)).updatePaymentToken(
                config.paymentToken
            );
        }
        if (config.mintQuantity != 0) {
            ITheGenerates(token).multiConfigureMint(
                config.mintRecipient,
                config.mintQuantity
            );
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
