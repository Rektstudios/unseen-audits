// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title  MockERC20
 * @author decapitator (0xdecapitator)
 * @notice erc20 contract for unit tests
 */
contract MockERC20 is ERC20("Mock Coin", "MOCK") {
    function mint(address to, uint256 value) external {
        _mint(to, value);
    }
}
