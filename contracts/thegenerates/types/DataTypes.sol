// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library ConfigStructs {
    /**
     * @notice A struct defining unseen payout
     *         address and fee basis points.
     *
     * @param payoutAddress The payout address.
     * @param basisPoints   The basis points to pay out to the unseen treasury.
     */
    struct UnseenPayout {
        address payoutAddress;
        uint16 basisPoints;
    }

    /**
     * @notice A struct defining public drop data.
     *         Designed to fit efficiently in one storage slot.
     *
     * @param startPrice               The start price per token.
     * @param endPrice                 The end price per token. If this differs
     *                                 from startPrice, the current price will
     *                                 be calculated based on the current time.
     * @param startTime                The start time, ensure this is not zero.
     * @param endTime                  The end time, ensure this is not zero.
     */
    struct PublicDrop {
        uint80 startPrice; // 80/256 bits
        uint80 endPrice; // 160/256 bits
        uint40 startTime; // 200/256 bits
        uint40 endTime; // 240/256 bits
    }

    /**
     * @notice A struct defining mint params for an allow list.
     *         An allow list leaf will be composed of `msg.sender` and
     *         the following params.
     *
     *
     * @param startPrice               The start price per token.
     * @param endPrice                 The end price per token. If this differs
     *                                 from startPrice, the current price will
     *                                 be calculated based on the current time.
     * @param startTime                The start time, ensure this is not zero.
     * @param endTime                  The end time, ensure this is not zero.
     * @param maxTokenSupplyForStage   The limit of token supply this stage can
     *                                 mint within.
     * @param dropStageIndex           The drop stage index to emit with the event
     *                                 for analytical purposes. This should be
     *                                 non-zero since the public mint emits with
     *                                 index zero.
     */
    struct MintParams {
        uint256 startPrice;
        uint256 endPrice;
        uint256 startTime;
        uint256 endTime;
        uint256 maxTokenSupplyForStage;
        uint256 dropStageIndex;
    }

    /**
     * @notice A struct to configure multiple contract options in one transaction.
     */
    struct MultiConfigureStruct {
        uint256 maxSupply;
        string baseURI;
        string contractURI;
        PublicDrop publicDrop;
        bytes32 merkleRoot;
        UnseenPayout unseenPayout;
        bytes32 provenanceHash;
        address paymentToken;
        // Server-signed
        address allowedSigner;
        // ERC-2981
        address royaltyReceiver;
        uint96 royaltyBps;
        // Mint
        address mintRecipient;
        uint256 mintQuantity;
    }
}
