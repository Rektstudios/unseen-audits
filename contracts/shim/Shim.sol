// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @dev Use structs in an external function so typechain compiles them to use
 *      in HardHat tests.
 */
import { ConfigStructs } from "../thegenerates/types/DataTypes.sol";

import { WETH } from "solady/src/tokens/WETH.sol";

contract Shim {
    function _shim(
        ConfigStructs.MintParams calldata mintParams,
        ConfigStructs.PublicDrop calldata publicDrop
    ) external {}
}
