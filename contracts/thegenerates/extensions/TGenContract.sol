// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ITheGenerates } from "../interfaces/ITheGenerates.sol";

import { ContractMetadata } from "./ContractMetadata.sol";

import { TheGeneratesStorage } from "../lib/TheGeneratesStorage.sol";

import { ITheGeneratesConfigurer } from "../interfaces/ITheGeneratesConfigurer.sol";

import { SafeTransferLib } from "solady/src/utils/SafeTransferLib.sol";

/**
 * @title  TGenContract
 * @author decapitator (0xdecapitator)
 * @notice An ERC721 token contract based on ERC721A that can mint NFTs.
 */
contract TGenContract is ContractMetadata {
    using TheGeneratesStorage for TheGeneratesStorage.Layout;

    /**
     * @notice Deploy the token contract.
     *
     * @param allowedConfigurer The address of the contract allowed to
     *                          configure parameters. Also contains
     *                          TheGenerates implementation code.
     */
    constructor(
        address allowedConfigurer
    ) payable ContractMetadata(allowedConfigurer) {
        // Emit an event noting the contract deployment.
        emit TheGeneratesDeployed();
    }

    /**
     * @notice The fallback function is used as a dispatcher for TheGenerates
     *         methods.
     */
    fallback(bytes calldata) external returns (bytes memory output) {
        // Get the function selector.
        bytes4 selector = msg.sig;

        // Get the rest of the msg data after the selector.
        bytes calldata data = msg.data[4:];

        // Determine if we should forward the call to the implementation
        // contract with TheGenerates logic.
        bool callTheGeneratesImplementation = selector ==
            ITheGenerates.updateAllowList.selector ||
            selector == ITheGenerates.updateUnseenPayout.selector ||
            selector == ITheGenerates.updateSigner.selector ||
            selector == ITheGenerates.updatePublicDrop.selector ||
            selector == ITheGenerates.updatePaymentToken.selector ||
            selector == ITheGeneratesConfigurer.mint.selector ||
            selector == ITheGenerates.getPublicDrop.selector ||
            selector == ITheGenerates.getUnseenPayout.selector ||
            selector == ITheGenerates.getPaymentToken.selector ||
            selector == ITheGenerates.getAllowListMerkleRoot.selector ||
            selector == ITheGenerates.getSigner.selector ||
            selector == ITheGenerates.getDigestIsUsed.selector;

        // Determine if we should require only the owner or configurer calling.
        bool requireOnlyOwnerOrConfigurer = selector ==
            ITheGenerates.updateAllowList.selector ||
            selector == ITheGenerates.updateSigner.selector ||
            selector == ITheGenerates.updateUnseenPayout.selector ||
            selector == ITheGenerates.updatePaymentToken.selector ||
            selector == ITheGenerates.updatePublicDrop.selector;

        if (callTheGeneratesImplementation) {
            // For update calls, ensure the sender is only the owner
            // or configurer contract.
            if (requireOnlyOwnerOrConfigurer) {
                _onlyOwnerOrConfigurer();
            }

            // Forward the call to the implementation contract.
            (bool success, bytes memory returnedData) = _CONFIGURER
                .delegatecall(msg.data);

            // Require that the call was successful.
            if (!success) {
                // Bubble up the revert reason.
                assembly {
                    revert(add(32, returnedData), mload(returnedData))
                }
            }

            // If the call was to mint the tokens.
            if (selector == ITheGeneratesConfigurer.mint.selector) {
                _mintOrder(returnedData);
            }

            // Return the data from the delegate call.
            return returnedData;
        } else if (selector == ITheGenerates.getMintStats.selector) {
            // Get the mint stats.
            (uint256 totalMinted, uint256 maxSupply) = _getMintStats();

            // Encode the return data.
            return abi.encode(totalMinted, maxSupply);
        } else if (selector == ITheGenerates.configurer.selector) {
            // Return the configurer contract.
            return abi.encode(_CONFIGURER);
        } else if (selector == ITheGenerates.multiConfigureMint.selector) {
            // Ensure only the owner or configurer can call this function.
            _onlyOwnerOrConfigurer();

            // Mint the tokens.
            _multiConfigureMint(data);
        } else {
            // Revert if the function selector is not supported.
            revert UnsupportedFunctionSelector(selector);
        }
    }

    /**
     * @notice Returns a set of mint stats.
     *         This assists in enforcing maxSupply
     *         and maxTokenSupplyForStage checks.
     *
     * @dev    NOTE: Implementing contracts should always update these numbers
     *         before transferring any tokens with _safeMint() to mitigate
     *         consequences of malicious onERC721Received() hooks.
     *
     */
    function _getMintStats()
        internal
        view
        returns (uint256 totalMinted, uint256 maxSupply)
    {
        totalMinted = _totalMinted();
        maxSupply = _maxSupply;
    }

    /**
     * @notice Returns whether the interface is supported.
     *
     * @param interfaceId The interface id to check against.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ContractMetadata) returns (bool) {
        return
            interfaceId == type(ITheGenerates).interfaceId ||
            interfaceId == type(ITheGeneratesConfigurer).interfaceId ||
            // ContractMetadata returns supportsInterface true for
            //     IERC721ContractMetadata, ERC-4906, ERC-2981
            // ERC721A returns supportsInterface true for
            //     ERC165, ERC721, ERC721Metadata
            ContractMetadata.supportsInterface(interfaceId);
    }

    /**
     * @dev Internal function to mint tokens.
     *
     * @param returnedData The data returned from configurer.
     */
    function _mintOrder(bytes memory returnedData) internal {
        // Decode minter from returnedData.
        (address minter, uint256 quantity) = abi.decode(
            returnedData,
            (address, uint256)
        );

        // Mint the tokens.
        _mint(minter, quantity);
    }

    /**
     * @dev Internal function to mint tokens during a multiConfigureMint call
     *      from the configurer contract.
     *
     * @param data The original transaction calldata, without the selector.
     */
    function _multiConfigureMint(bytes calldata data) internal {
        // Decode the calldata.
        (address recipient, uint256 quantity) = abi.decode(
            data,
            (address, uint256)
        );

        _mint(recipient, quantity);
    }

    /**
     *  @notice Lets a user rent a specific NFT.
     *  @param tokenId The tokenId of the NFT to rent.
     *  @param expires The number of minutes the NFT will be rented for.
     */
    function rent(uint256 tokenId, uint64 expires) external override {
        uint256 amount = super._rent(tokenId, expires);
        if (amount == 0) {
            return;
        }

        TheGeneratesStorage.Layout storage layout = TheGeneratesStorage
            .layout();
        address payout = layout._unseenPayout.payoutAddress;
        uint16 basisPoints = layout._unseenPayout.basisPoints;
        address uncn = layout._uncn;

        if (basisPoints > 0) {
            uint256 fee = (amount * basisPoints) / 10000;
            SafeTransferLib.safeTransferFrom(uncn, msg.sender, payout, fee);
            amount -= fee;
        }

        SafeTransferLib.safeTransferFrom(
            uncn,
            msg.sender,
            ownerOf(tokenId),
            amount
        );
    }
}
