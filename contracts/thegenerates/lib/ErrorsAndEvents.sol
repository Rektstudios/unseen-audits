// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ConfigStructs } from "../types/DataTypes.sol";

interface ErrorsAndEvents {
    /**
     * @notice An event to signify that TheGenerates contract was deployed.
     */
    event TheGeneratesDeployed();

    /**
     * @notice Revert with an error if the function selector is not supported.
     */
    error UnsupportedFunctionSelector(bytes4 selector);

    /**
     * @dev Revert with an error if the drop stage is not active.
     */
    error NotActive(
        uint256 currentTimestamp,
        uint256 startTimestamp,
        uint256 endTimestamp
    );

    /**
     * @dev Revert with an error if the mint quantity exceeds the max token
     *      supply.
     */
    error MintQuantityExceedsMaxSupply(uint256 total, uint256 maxSupply);

    /**
     * @dev Revert with an error if the mint quantity exceeds the max token
     *      supply for the stage.
     *      Note: The `maxTokenSupplyForStage` for public mint is
     *      always `type(uint).max`.
     */
    error MintQuantityExceedsMaxTokenSupplyForStage(
        uint256 total,
        uint256 maxTokenSupplyForStage
    );

    /**
     * @dev Revert if the fee basis points is greater than 1_000.
     */
    error InvalidFeeBps(uint256 feeBps);

    /**
     * @dev Revert if unseen payout address is the zero address.
     */
    error UnseenPayoutAddressCannotBeZeroAddress();

    /**
     * @dev Revert if unseen payout is not set.
     */
    error UnseenPayoutNotSet();

    /**
     * @dev Revert if unseen payout basis points exceed 1_000.
     */
    error InvalidUnseenPayoutBasisPoints(uint256 totalReceivedBasisPoints);

    /**
     * @dev Revert with an error if the quantity is set to zero.
     */
    error QuantityNotSet();

    /**
     * @dev Revert with an error if the allow list proof is invalid.
     */
    error InvalidProof();

    /**
     * @dev Revert if a supplied signer address is the zero address.
     */
    error SignerCannotBeZeroAddress();

    /**
     * @dev Revert with an error if a signer is already included in mapping
     *      when adding.
     */
    error DuplicateSigner();

    /**
     * @dev Revert if a supplied payment token address is the zero address.
     */
    error PaymentTokenCannotBeZeroAddress();

    /**
     * @dev Revert if the payment token is not set.
     */
    error PaymentTokenNotSet();

    /**
     * @dev Revert with an error if a payment token is already the same when adding.
     */
    error DuplicatePaymentToken();

    /**
     * @dev An event with the updated payment token.
     */
    event PaymentTokenUpdated(address indexed paymentToken);

    /**
     * @dev Revert if the start time is greater than the end time.
     */
    error InvalidStartAndEndTime(uint256 startTime, uint256 endTime);

    /**
     * @dev Revert with an error if a signature for a signed mint has already
     *      been used.
     */
    error SignatureAlreadyUsed();

    /**
     * @dev Revert with an error if the contract has no balance to withdraw.
     */
    error NoBalanceToWithdraw();

    /**
     * @dev Revert with an error if the extra data encoding is not supported.
     */
    error InvalidExtraDataEncoding();

    /**
     * @dev Revert with an error if the provided substandard is not supported.
     */
    error InvalidSubstandard(uint8 substandard);

    /**
     * @dev Revert with an error if the implementation contract is called without
     *      delegatecall.
     */
    error OnlyDelegateCalled();

    /**
     * @dev Revert with an error if the transfer validator is being set to the same address.
     */
    error SameTransferValidator();

    /**
     * @dev An event with details of a mint, for analytical purposes.
     *
     * @param payer          The address who payed for the tx.
     * @param dropStageIndex The drop stage index. Items minted through
     *                       public mint have dropStageIndex of 0
     */
    event TheGeneratesMint(address payer, uint256 dropStageIndex);

    /**
     * @dev An event with updated allow list data.
     *
     * @param previousMerkleRoot The previous allow list merkle root.
     * @param newMerkleRoot      The new allow list merkle root.
     */
    event AllowListUpdated(
        bytes32 indexed previousMerkleRoot,
        bytes32 indexed newMerkleRoot
    );

    /**
     * @dev An event with the updated unseen payout address.
     */
    event UnseenPayoutUpdated(ConfigStructs.UnseenPayout unseenPayout);

    /**
     * @dev An event with the updated signer.
     */
    event SignerUpdated(address indexed signer);

    /**
     * @dev An event with updated public drop data.
     */
    event PublicDropUpdated(ConfigStructs.PublicDrop publicDrop);

    /**
     * @dev An event with new transfer validator address.
     */
    event TransferValidatorUpdated(address oldValidator, address newValidator);

    /**
     * @dev Emit an event for token metadata reveals/updates,
     *      according to EIP-4906.
     *
     * @param _fromTokenId The start token id.
     * @param _toTokenId   The end token id.
     */
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    /**
     * @notice Throw if the configurer is set to address 0.
     */
    error ConfigurerCannotBeZeroAddress();

    /**
     * @notice Throw if the max supply exceeds uint64, a limit
     *         due to the storage of bit-packed variables.
     */
    error CannotExceedMaxSupplyOfUint64(uint256 got);

    /**
     * @notice Throw if the max supply exceeds the total minted.
     */
    error NewMaxSupplyCannotBeLessThenTotalMinted(
        uint256 got,
        uint256 totalMinted
    );

    /**
     * @dev Revert with an error when attempting to set the provenance
     *      hash after the mint has started.
     */
    error ProvenanceHashCannotBeSetAfterMintStarted();

    /**
     * @dev Revert with an error when attempting to set the provenance
     *      hash after it has already been set.
     */
    error ProvenanceHashCannotBeSetAfterAlreadyBeingSet();

    /**
     * @dev Emit an event when the URI for the collection-level metadata
     *      is updated.
     */
    event ContractURIUpdated(string newContractURI);

    /**
     * @dev Emit an event with the previous and new provenance hash after
     *      being updated.
     */
    event ProvenanceHashUpdated(bytes32 previousHash, bytes32 newHash);

    /**
     * @dev Emit an event when the EIP-2981 royalty info is updated.
     */
    event RoyaltyInfoUpdated(address receiver, uint256 basisPoints);

    /**
     * @dev Emit an event when the max token supply is updated.
     */
    event MaxSupplyUpdated(uint256 newMaxSupply);
}
