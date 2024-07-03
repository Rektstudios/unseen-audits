// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC4907A } from "../interfaces/IERC4907A.sol";

import { ERC721A, IERC721A } from "erc721a/contracts/ERC721A.sol";

/**
 * @title ERC4907A
 *
 * @dev [ERC4907](https://eips.ethereum.org/EIPS/eip-4907) compliant
 * extension of ERC721A, which allows owners and authorized addresses
 * to add a time-limited role with restricted permissions to ERC721 tokens.
 */
abstract contract ERC4907A is ERC721A, IERC4907A {
    // The bit position of `expires` in packed user info.
    uint256 private constant _BITPOS_EXPIRES = 160;

    // Mapping from token ID to user info.
    //
    // Bits Layout:
    // - [0..159]   `user`
    // - [160..223] `expires`
    mapping(uint256 => uint256) private _packedUserInfo;

    ///@notice Struct for rentable info
    struct RentableTokenInfo {
        bool rentable;
        uint128 ratePerMinute;
    }

    /// @notice Mapping from token ID to rentable info.
    mapping(uint256 => RentableTokenInfo) public rentablesInfo;

    modifier isAuthorized(uint256 tokenId) {
        // Require the caller to be either the token owner or an approved operator.
        address owner = ownerOf(tokenId);
        if (_msgSenderERC721A() != owner) {
            if (!isApprovedForAll(owner, _msgSenderERC721A())) {
                if (getApproved(tokenId) != _msgSenderERC721A()) {
                    _revert(SetUserCallerNotOwnerNorApproved.selector);
                }
            }
        }
        _;
    }

    /**
     * @notice Internal function for setting user and expiration details for a token
     *
     * @param tokenId The token to set user and expiration details
     * @param user The address of the user
     * @param expires The time in minutes until the token expires
     */
    function _setUserAndExpiration(
        uint256 tokenId,
        address user,
        uint64 expires
    ) private {
        if (userOf(tokenId) != address(0)) {
            revert TokenIsRented();
        }
        if (expires == 0) {
            revert NoExpiryAssigned();
        }
        _packedUserInfo[tokenId] =
            (uint256(block.timestamp + expires * 60) << _BITPOS_EXPIRES) |
            uint256(uint160(user));
        emit UpdateUser(tokenId, user, expires);
    }

    /**
     * @notice Internal function for renting a token
     *
     * @param tokenId The token to rent
     * @param expires The time in minutes to rent the token
     * @return dueAmount The amount of UNCN to be paid
     */
    function _rent(
        uint256 tokenId,
        uint64 expires
    ) internal virtual returns (uint256 dueAmount) {
        if (!rentablesInfo[tokenId].rentable) {
            revert RentingDisabled();
        }
        dueAmount = rentablesInfo[tokenId].ratePerMinute * expires;
        _setUserAndExpiration(tokenId, _msgSenderERC721A(), expires);
    }

    /**
     * @dev Sets the `user` and `expires` for `tokenId`.
     * The zero address indicates there is no user.
     *
     * Requirements:
     *
     * - The caller must own `tokenId` or be an approved operator.
     */
    function setUser(
        uint256 tokenId,
        address user,
        uint64 expires
    ) public virtual override isAuthorized(tokenId) {
        _setUserAndExpiration(tokenId, user, expires);
    }

    /**
     * @notice Function to set the rentable status and/or fee of a token
     *
     * @param tokenId The token to set the rentable status and/or fee
     * @param rentable The rentable status of the token
     * @param ratePerMinute The rent fee in UNCN per minute
     * @dev The rent fee is set in UNCN per minute
     */
    function setRentablesInfo(
        uint256 tokenId,
        bool rentable,
        uint128 ratePerMinute
    ) public virtual isAuthorized(tokenId) {
        bool statusChanged = false;
        bool feeChanged = false;

        if (rentablesInfo[tokenId].rentable != rentable) {
            rentablesInfo[tokenId].rentable = rentable;
            statusChanged = true;
        }

        if (rentablesInfo[tokenId].ratePerMinute != ratePerMinute) {
            rentablesInfo[tokenId].ratePerMinute = ratePerMinute;
            feeChanged = true;
        }

        if (!statusChanged && !feeChanged) {
            revert NoChange();
        }
    }

    /**
     * @notice Function to get the rentable status and fee of a token
     *
     * @param tokenId The token to get the rentable status and fee
     * @return ratePerMinute The rent fee in UNCN per minute
     * @return rentable The rentable status of the token
     * @dev The rent fee is set in UNCN per minute
     */
    function getTokenRentInfo(
        uint256 tokenId
    ) external view returns (uint256, bool) {
        return (
            rentablesInfo[tokenId].ratePerMinute,
            rentablesInfo[tokenId].rentable
        );
    }

    /**
     * @dev Returns the user address for `tokenId`.
     *
     * The zero address indicates that there is no user or if the user is expired.
     */
    function userOf(
        uint256 tokenId
    ) public view virtual override returns (address) {
        uint256 packed = _packedUserInfo[tokenId];
        assembly {
            // Branchless `packed *= (block.timestamp <= expires ? 1 : 0)`.
            // If the `block.timestamp == expires`, the `lt` clause will be true
            // if there is a non-zero user address in the lower 160 bits of `packed`.
            packed := mul(
                packed,
                // `block.timestamp <= expires ? 1 : 0`.
                lt(shl(_BITPOS_EXPIRES, timestamp()), packed)
            )
        }
        return address(uint160(packed));
    }

    /**
     * @dev Returns the user's expires of `tokenId`.
     */
    function userExpires(
        uint256 tokenId
    ) public view virtual override returns (uint256) {
        return _packedUserInfo[tokenId] >> _BITPOS_EXPIRES;
    }

    /**
     * @dev Override of {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721A, IERC721A) returns (bool) {
        // The interface ID for ERC4907 is `0xad092b5c`,
        // as defined in [ERC4907](https://eips.ethereum.org/EIPS/eip-4907).
        return
            super.supportsInterface(interfaceId) || interfaceId == 0xad092b5c;
    }

    /**
     * @dev Returns the user address for `tokenId`, ignoring the expiry status.
     */
    function _explicitUserOf(
        uint256 tokenId
    ) external view virtual returns (address) {
        return address(uint160(_packedUserInfo[tokenId]));
    }
}
