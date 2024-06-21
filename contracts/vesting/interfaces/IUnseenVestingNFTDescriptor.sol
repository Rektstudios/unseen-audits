// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title  IUnseenVestingNFTDescriptor
 * @author decapitator (0xdecapitator)
 * @notice This contract generates the URI describing
 *         Unseen vesting schedules NFTs.
 */
interface IUnseenVestingNFTDescriptor {
    /**
     * @notice Produces the URI describing a particular
     *         schedule NFT.
     * @param unseenVesting The address of the UnseenVesting
     *                      contract the schedule was created in.
     * @param scheduleId    The id of the schedule for which to
     *                      produce a description.
     * @return uri The URI of the ERC721-compliant metadata.
     */
    function tokenURI(
        address unseenVesting,
        uint256 scheduleId
    ) external view returns (string memory uri);
}
