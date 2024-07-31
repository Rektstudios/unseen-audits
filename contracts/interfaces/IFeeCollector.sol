// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IWrappedNativeToken {
    function withdraw(uint256 wad) external;
}

/**
 * @title  FeeCollectorInterface
 * @author decapitator (0xdecapitator.eth)
 * @notice FeeCollectorInterface contains all external function
 *         INTERFACES for the fee collector implementation.
 */
interface IFeeCollector {
    /**
     * @notice Unwraps and withdraws the given amount of WrappedNative tokens from the
     *         provided contract address. Requires the caller to have the
     *         operator role, and the withdrawal wallet to be in the
     *         allowlisted wallets.
     *
     * @param withdrawalWallet The wallet to be used for withdrawal.
     * @param wrappedNativeToken The WwappedNative token address to be unwrapped.
     * @param amount The amount of tokens to be withdrawn.
     */
    function unwrapAndWithdraw(
        address withdrawalWallet,
        address wrappedNativeToken,
        uint256 amount
    ) external;

    /**
     * @notice Retrieve the name of this contract.
     *
     * @return The name of this contract.
     */
    function name() external pure returns (string memory);
}
