// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC4907A, ERC721A, IERC721A } from "../../extensions/ERC4907A.sol";

import { ERC721AQueryable } from "erc721a/contracts/extensions/ERC721AQueryable.sol";

/**
 * @title  MarketsPreapproved
 * @notice ERC721A with:
 *         - Unseen Market Registry preapproved.
 *         - OpenSea conduit preapproved.
 */
abstract contract MarketsPreapproved is ERC4907A, ERC721AQueryable {
    /// @dev The canonical OpenSea conduit.
    address internal constant _CONDUIT =
        0x1E0049783F008A0085193E00003D00cd54003c71;
    /// @dev The Unseen registry.
    address internal constant _REGISTRY =
        0x1E0049783F008A0085193E00003D00cd54003c71;

    /**
     * @notice Deploy the token contract.
     */
    constructor() payable ERC721A("The Generates", "TGen") {}

    /**
     * @dev Returns if the `operator` is allowed to manage all of the
     *      assets of `owner`. Always returns true for the conduit.
     */
    function isApprovedForAll(
        address owner,
        address operator
    ) public view virtual override(ERC721A, IERC721A) returns (bool) {
        if (operator == _CONDUIT || operator == _REGISTRY) {
            return true;
        }
        return ERC721A.isApprovedForAll(owner, operator);
    }

    /**
     * @notice Returns whether the interface is supported.
     *
     * @param interfaceId The interface id to check against.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC4907A, ERC721A, IERC721A) returns (bool) {
        return ERC4907A.supportsInterface(interfaceId);
    }
}
