// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC1271Mod } from "../lib/ERC1271Mod.sol";
import { ArrayUtils } from "../lib/ArrayUtils.sol";
import { ProxyRegistry } from "./registry/ProxyRegistry.sol";

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
 * @title  GlobalMaker
 * @author decapitator (0xdecapitator.eth)
 * @dev    Global Maker kind for executing trades on behalf of users
 */
contract GlobalMaker is ERC1271Mod {
    bytes4 internal constant SIGINVALID = 0x00000000;

    string public constant NAME = "Unseen Global Maker";

    mapping(bytes4 => uint16) public sigMakerOffsets;

    /**
     * Construct a new GlobalMaker, creating the proxy it will require
     */
    constructor(
        ProxyRegistry registry,
        bytes4[] memory functionSignatures,
        uint16[] memory makerOffsets
    ) payable {
        if (address(registry) == address(0)) {
            revert("Registry cannot be address 0");
        }
        if (functionSignatures.length == 0) {
            revert(
                "No function signatures passed, GlobalMaker would be inert."
            );
        }
        if (functionSignatures.length != makerOffsets.length) {
            revert("functionSignatures and makerOffsets lengths not equal");
        }
        registry.registerProxy();
        for (uint256 i; i < functionSignatures.length; ) {
            sigMakerOffsets[functionSignatures[i]] = makerOffsets[i];
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @dev Validate a signature for a given data and callData
     * @param _data The data to be signed
     * @param _signature The signature of the data
     * @param _callData The calldata to be executed
     */
    function isValidSignature(
        bytes calldata _data,
        bytes calldata _signature,
        bytes calldata _callData
    ) public view override returns (bytes4 magicValue) {
        bytes4 sig = bytes4(_callData[:4]);
        uint256 sigOffset = sigMakerOffsets[sig];
        if (sigOffset == 0) return SIGINVALID;

        (uint8 v, bytes32 r, bytes32 s) = abi.decode(
            _signature,
            (uint8, bytes32, bytes32)
        );

        bytes32 hash = abi.decode(_data, (bytes32));
        address signer = ecrecover(hash, v, r, s);

        if (sig == 0xb1f1709c) {
            (, , bytes[] memory calldatas) = abi.decode(
                _callData[4:],
                (address[], uint256[], bytes[])
            );
            uint256 calldatasLength = calldatas.length;
            for (uint256 i; i < calldatasLength; ) {
                if (
                    abi.decode(
                        ArrayUtils.arraySlice(calldatas[i], sigOffset, 32),
                        (address)
                    ) != signer
                ) {
                    return SIGINVALID;
                }
                unchecked {
                    ++i;
                }
            }
            return MAGICVALUE;
        }
        return
            (abi.decode(
                ArrayUtils.arraySlice(_callData, sigOffset, 32),
                (address)
            ) == signer)
                ? MAGICVALUE
                : SIGINVALID;
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
