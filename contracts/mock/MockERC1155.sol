// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

/**
 * @title  MockERC1155
 * @author decapitator (0xdecapitator.eth)
 * @notice erc1155 contract for unit tests
 */
contract MockERC1155 is ERC1155("http://test/{id}.json") {
    function mint(address to, uint256 tokenId) public returns (bool) {
        _mint(to, tokenId, 1, "");
        return true;
    }

    function mint(
        address to,
        uint256 tokenId,
        uint256 amount
    ) public returns (bool) {
        _mint(to, tokenId, amount, "");
        return true;
    }

    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory extraBytes
    ) public {
        address creator = address(uint160(id >> 96));
        require(
            creator == msg.sender ||
                super.isApprovedForAll(creator, msg.sender),
            "Sender not authorized to mint this token"
        );
        _mint(to, id, amount, extraBytes);
    }
}
