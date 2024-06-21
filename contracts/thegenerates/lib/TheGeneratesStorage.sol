// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ConfigStructs } from "../types/DataTypes.sol";

library TheGeneratesStorage {
    struct Layout {
        /// @notice The public drop data.
        ConfigStructs.PublicDrop _publicDrop;
        /// @notice Unseen payout address and fee basis points.
        ConfigStructs.UnseenPayout _unseenPayout;
        /// @notice The allow list merkle root.
        bytes32 _allowListMerkleRoot;
        /// @notice The allowed server-side signer.
        address _allowedSigner;
        /// @notice The payment token address.
        address _uncn;
        /// @notice The used signature digests.
        mapping(bytes32 => bool) _usedDigests;
    }

    bytes32 internal constant STORAGE_SLOT =
        bytes32(uint256(keccak256("contracts.storage.TGenContract")) - 1);

    function layout() internal pure returns (Layout storage l) {
        bytes32 slot = STORAGE_SLOT;
        assembly {
            l.slot := slot
        }
    }
}
