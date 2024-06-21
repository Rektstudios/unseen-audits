// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { ERC721A } from "erc721a/contracts/ERC721A.sol";

/**
 * @title  MockERC721
 * @author decapitator (0xdecapitator)
 * @notice erc721a contract for unit tests
 */
contract MockERC721 is ERC721A("MockERC721", "MOCK") {
    constructor() {}

    function mint(address to, uint256 tokenId) external returns (bool) {
        _mintSpot(to, tokenId);
        return true;
    }

    function mint(
        address to,
        uint256 tokenId,
        bytes memory extraBytes
    ) external {
        _safeMintSpot(to, tokenId, extraBytes);
    }

    /**
     * @dev Overrides the `_sequentialUpTo` function from ERC721A to start
     *      spot minting at token id `1`.
     *
     *      This is to avoid issues since `0` is typically used to signal
     *      values that have not been set or have been removed.
     */
    function _sequentialUpTo()
        internal
        view
        virtual
        override
        returns (uint256)
    {
        return 0;
    }
}
