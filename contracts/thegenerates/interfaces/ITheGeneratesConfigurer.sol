// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ITheGeneratesConfigurer
 * @notice Contains the minimum interfaces needed to interact with TheGenerates Configurer.
 */
interface ITheGeneratesConfigurer {
    /**
     * @dev Mint an order with the specified context.
     *
     * @param context         Additional context of the order.
     *
     * @return minter         The address of the minter.
     * @return quantity       The quantity to mint.
     */
    function mint(
        bytes calldata context
    ) external returns (address minter, uint256 quantity);
}
