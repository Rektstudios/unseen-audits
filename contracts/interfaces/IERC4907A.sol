// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IERC721A } from "erc721a/contracts/IERC721A.sol";

/**
 * @dev Interface of ERC4907A.
 */
interface IERC4907A is IERC721A {
    /**
     * The caller must own the token or be an approved operator.
     */
    error SetUserCallerNotOwnerNorApproved();

    /**
     * The token is already rented out.
     */
    error TokenIsRented();

    /**
     * Trying to rent a token with 0 expiry.
     */
    error NoExpiryAssigned();

    /**
     * The token id is not rentable.
     */
    error RentingDisabled();

    /**
     * The caller is not allowed.
     */
    error NotAllowed();

    /**
     * The token id rentable status is already set.
     */
    error AlreadySet();

    /**
     * The token id rentable fee is already set.
     */
    error FeeAlreadySet();

    /**
     * Error indicating no changes were made.
     */
    error NoChange();

    /**
     * @dev Emitted when the `user` of an NFT or the `expires` of the `user` is changed.
     * The zero address for user indicates that there is no user address.
     */
    event UpdateUser(
        uint256 indexed tokenId,
        address indexed user,
        uint64 expires
    );

    /**
     * @dev Sets the `user` and `expires` for `tokenId`.
     * The zero address indicates there is no user.
     *
     * Requirements:
     *
     * - The caller must own `tokenId` or be an approved operator.
     */
    function setUser(uint256 tokenId, address user, uint64 expires) external;

    /**
     * @dev Returns the user address for `tokenId`.
     * The zero address indicates that there is no user or if the user is expired.
     */
    function userOf(uint256 tokenId) external view returns (address);

    /**
     * @dev Returns the user's expires of `tokenId`.
     */
    function userExpires(uint256 tokenId) external view returns (uint256);

    /**
     * @dev Rent a token id for _expires time.
     */
    function rent(uint256 tokenId, uint64 _expires) external;

    /**
     * @dev Release a token id before rent expires.
     */
    function releaseToken(uint256 tokenId) external;

    /**
     *  @notice Set the rentable status and rent fee of a specific token.
     *  @param tokenId The tokenId of the token to update.
     *  @param rentable The rentable status to set for the token.
     *  @param ratePerMinute The rent fee in UNCN per minute.
     */
    function setRentablesInfo(
        uint256 tokenId,
        bool rentable,
        uint128 ratePerMinute
    ) external;
}
