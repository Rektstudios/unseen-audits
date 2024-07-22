// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @dev Use structs in an external function so typechain compiles them to use
 *      in HardHat tests.
 *
 *      HardHat doesn't support multiple source folders; so import everything
 *      extra that hardhat tests rely on so they get compiled. Allows for faster
 *      feedback than running an extra yarn build.
 */
import { ConfigStructs } from "../thegenerates/types/DataTypes.sol";

import { WETH } from "solady/src/tokens/WETH.sol";

contract Shim {
    function shim(
        ConfigStructs.MintParams calldata mintParams,
        ConfigStructs.PublicDrop calldata publicDrop
    ) external {}
}
