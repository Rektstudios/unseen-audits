// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

/**
 * @title  EIP1271
 * @author decapitator (0xdecapitator.eth)
 */
abstract contract ERC1271 {
    // bytes4(keccak256("isValidSignature(bytes,bytes)")
    bytes4 internal constant MAGICVALUE = 0x20c13b0b;

    /**
     * @dev Should return whether the signature provided is valid for the provided data
     * @param _data Arbitrary length data signed on the behalf of address(this)
     * @param _signature Signature byte array associated with _data
     *
     * MUST return the bytes4 magic value 0x20c13b0b when function passes.
     * MUST NOT modify state (using STATICCALL for solc < 0.5, view modifier for solc != 0.5)
     * MUST allow external calls
     */
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
    ) public view virtual returns (bytes4 magicValue);
}
