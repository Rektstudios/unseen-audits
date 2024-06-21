// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ConfigStructs } from "../types/DataTypes.sol";

/**
 * @dev A helper interface to get and set parameters for TheGenerates.
 *      The token does not expose these methods as part of its external
 *      interface to optimize contract size, but does implement them.
 */
interface ITheGenerates {
    /**
     * @notice Update TheGenerates public drop parameters.
     *
     * @param publicDrop The new public drop parameters.
     */
    function updatePublicDrop(
        ConfigStructs.PublicDrop calldata publicDrop
    ) external;

    /**
     * @notice Returns the public drop stage parameters.
     */
    function getPublicDrop()
        external
        view
        returns (ConfigStructs.PublicDrop memory);

    /**
     * @notice Returns a set of mint stats.
     *         This assists the generates in enforcing maxSupply,
     *         and maxTokenSupplyForStage checks.
     *
     * @dev    NOTE: Implementing contracts should always update these numbers
     *         before transferring any tokens with _safeMint() to mitigate
     *         consequences of malicious onERC721Received() hooks.
     *
     */
    function getMintStats()
        external
        view
        returns (uint256 totalMinted, uint256 maxSupply);

    /**
     * @notice This function is only allowed to be called by the configurer
     *         contract as a way to batch mints and configuration in one tx.
     *
     * @param recipient The address to receive the mints.
     * @param quantity  The quantity of tokens to mint.
     */
    function multiConfigureMint(address recipient, uint256 quantity) external;

    /**
     * @notice Update TheGenerates payout address.
     *         The basis points must be max 1_000.
     *         Only the owner can use this function.
     *
     * @param unseenPayout The unseen payout.
     */
    function updateUnseenPayout(
        ConfigStructs.UnseenPayout calldata unseenPayout
    ) external;

    /**
     * @notice Update TheGenerates payment token.
     *         Only the owner can use this function.
     *
     * @param paymentToken    The paymen token to update.
     */
    function updatePaymentToken(address paymentToken) external;

    /**
     * @notice Update the generates allow list data.
     *         Only the owner can use this function.
     *
     * @param merkleRoot The new allow list merkle root.
     */
    function updateAllowList(bytes32 merkleRoot) external;

    /**
     * @notice Update the TGen allowed signer.
     *         Only the owner can use this function.
     *
     * @param signer  The signer to update.
     */
    function updateSigner(address signer) external;

    /**
     * @notice Returns TheGenerates creator payouts.
     */
    function getUnseenPayout()
        external
        view
        returns (ConfigStructs.UnseenPayout memory);

    /**
     * @notice Returns The payment token.
     */
    function getPaymentToken() external view returns (address);

    /**
     * @notice Returns TheGenerates allow list merkle root.
     */
    function getAllowListMerkleRoot() external view returns (bytes32);

    /**
     * @notice Returns TheGenerates allowed signer.
     */
    function getSigner() external view returns (address);

    /**
     * @notice Returns if the signed digest has been used.
     *
     * @param digest The digest hash.
     */
    function getDigestIsUsed(bytes32 digest) external view returns (bool);

    /**
     * @notice Returns the configurer contract.
     */
    function configurer() external view returns (address);
}
