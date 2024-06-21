// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
 * @title  UnseenAtomicizer
 * @author decapitator (0xdecapitator.eth)
 * @notice Atomicizer contract used to execute
 *         packed calls { ex: fees , royalties }
 */

contract UnseenAtomicizer {
    error LengthsMismatch(string reason);
    error SubcallFailed();

    /**
     * @notice Atomicize a series of calls
     * @param addrs     Addresses to call
     * @param values    Values to send with each call
     * @param calldatas Calldata to send with each call
     */
    function atomicize(
        address[] calldata addrs,
        uint256[] calldata values,
        bytes[] calldata calldatas
    ) external payable {
        uint256 length = addrs.length;

        if (length != values.length) {
            revert LengthsMismatch("Addresses & values lengths mismatch!");
        }

        if (length != calldatas.length) {
            revert LengthsMismatch("Addresses and calldata lengths mismatch!");
        }

        for (uint256 i; i < length; ) {
            (bool success, ) = addrs[i].call{ value: values[i] }(calldatas[i]);
            if (!success) {
                revert SubcallFailed();
            }
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
