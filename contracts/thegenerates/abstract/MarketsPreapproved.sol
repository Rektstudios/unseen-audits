// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ERC4907A, ERC721A, IERC721A } from "../../extensions/ERC4907A.sol";

import { ERC721AQueryable } from "erc721a/contracts/extensions/ERC721AQueryable.sol";

contract AuthenticatedProxy {}

contract ProxyRegistry {
    mapping(address => AuthenticatedProxy) public proxies;
}

/**
 * @title  MarketsPreapproved
 * @notice ERC721A with:
 *         - Unseen Market Registry proxies preapproved.
 */
abstract contract MarketsPreapproved is ERC4907A, ERC721AQueryable {
    address public unseenMarketRegistry;

    /**
     * @notice Deploy the token contract.
     */
    constructor() payable ERC721A("The Generates", "TGen") {}

    function _isProxyForUser(
        address _user,
        address _address
    ) internal view virtual returns (bool) {
        if (unseenMarketRegistry.code.length == 0) {
            return false;
        }
        return
            address(ProxyRegistry(unseenMarketRegistry).proxies(_user)) ==
            _address;
    }

    /**
     * @dev Returns if the `operator` is allowed to manage all of the
     *      assets of `owner`. Always returns true for unseen market user's proxy.
     */
    function isApprovedForAll(
        address owner,
        address operator
    ) public view virtual override(ERC721A, IERC721A) returns (bool) {
        if (_isProxyForUser(owner, operator)) {
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
