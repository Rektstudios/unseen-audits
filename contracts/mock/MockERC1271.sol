// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { ERC1271 } from "../lib/ERC1271.sol";

/**
 * @title  MockERC1271
 * @author decapitator (0xdecapitator.eth)
 * @notice erc1271 contract for unit tests
 */
contract MockERC1271 is ERC1271 {
    bytes4 internal constant SIGINVALID = 0x00000000;

    address internal owner;

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Set a new owner
     * @param ownerAddr Address of owner
     */
    function setOwner(address ownerAddr) public {
        owner = ownerAddr;
    }

    /**
     * @notice Check if a signature is valid
     * @param _data Data signed over
     * @param _signature Encoded signature
     * @return magicValue Magic value if valid, zero-value otherwise
     */
    function isValidSignature(
        bytes memory _data,
        bytes memory _signature
    ) public view override returns (bytes4 magicValue) {
        bytes32 hash = abi.decode(_data, (bytes32));
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(
            _signature,
            (uint8, bytes32, bytes32)
        );
        if (owner == ecrecover(hash, v, r, s)) {
            return MAGICVALUE;
        } else {
            return SIGINVALID;
        }
    }
}
