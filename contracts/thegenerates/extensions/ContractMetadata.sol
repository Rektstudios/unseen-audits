// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { IContractMetadata } from "../interfaces/IContractMetadata.sol";

import { MarketsPreapproved, ERC721A, IERC721A } from "../abstract/MarketsPreapproved.sol";

import { ICreatorToken } from "../interfaces/ICreatorToken.sol";

import { ITransferValidator } from "../interfaces/ITransferValidator.sol";

import { TokenTransferValidator } from "../abstract/TokenTransferValidator.sol";

import { Ownable } from "solady/src/auth/Ownable.sol";

import { ERC2981 } from "solady/src/tokens/ERC2981.sol";

/**
 * @title  ContractMetadata
 * @author decapitator (0xdecapitator)
 * @notice A token contract that extends ERC-721
 *         with additional metadata and ownership capabilities.
 */
contract ContractMetadata is
    MarketsPreapproved,
    TokenTransferValidator,
    ERC2981,
    Ownable,
    IContractMetadata
{
    /// @notice The max supply.
    uint256 internal _maxSupply;

    /// @notice The base URI for token metadata.
    string internal _tokenBaseURI;

    /// @notice The contract URI for contract metadata.
    string internal _contractURI;

    /// @notice The provenance hash for guaranteeing metadata order
    ///         for random reveals.
    bytes32 internal _provenanceHash;

    /// @notice The allowed contract that can configure TheGenerates parameters.
    address internal immutable _CONFIGURER;

    /**
     * @dev Reverts if the sender is not the owner or the allowed
     *      configurer contract.
     *
     *      This is used as a function instead of a modifier
     *      to save contract space when used multiple times.
     */
    function _onlyOwnerOrConfigurer() internal view {
        if (msg.sender != _CONFIGURER && msg.sender != owner()) {
            revert Unauthorized();
        }
    }

    /**
     * @notice Deploy the token contract.
     *
     * @param allowedConfigurer The address of the contract allowed to
     *                          configure parameters. Also contains
     *                          TheGenerates implementation code.
     */
    constructor(address allowedConfigurer) payable MarketsPreapproved() {
        if (allowedConfigurer == address(0)) {
            revert ConfigurerCannotBeZeroAddress();
        }
        // Set the allowed configurer contract to interact with this contract.
        _CONFIGURER = allowedConfigurer;
    }

    /**
     *  @notice Lets a user rent a specific NFT.
     *  @param tokenId The tokenId of the NFT to rent.
     *  @param expires The number of minutes the NFT will be rented for.
     */
    function rent(uint256 tokenId, uint64 expires) external virtual override {
        super._rent(tokenId, expires);
    }

    /**
     *  @notice Lets a user release his token to its owner before rent expires.
     *  @param tokenId The tokenId of the NFT to rent.
     */
    function releaseToken(uint256 tokenId) external override {
        _releaseToken(tokenId);
    }
    /**
     * @notice Sets the base URI for the token metadata and emits an event.
     *
     * @param newBaseURI The new base URI to set.
     */
    function setBaseURI(string calldata newBaseURI) external override {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        // Set the new base URI.
        _tokenBaseURI = newBaseURI;

        // Emit an event with the update.
        if (totalSupply() != 0) {
            emit BatchMetadataUpdate(_startTokenId(), _nextTokenId() - 1);
        }
    }

    /**
     * @notice Sets the contract URI for contract metadata.
     *
     * @param newContractURI The new contract URI.
     */
    function setContractURI(string calldata newContractURI) external override {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        // Set the new contract URI.
        _contractURI = newContractURI;

        // Emit an event with the update.
        emit ContractURIUpdated(newContractURI);
    }

    /**
     * @notice Emit an event notifying metadata updates for
     *         a range of token ids, according to EIP-4906.
     *
     * @param fromTokenId The start token id.
     * @param toTokenId   The end token id.
     */
    function emitBatchMetadataUpdate(
        uint256 fromTokenId,
        uint256 toTokenId
    ) external {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        // Emit an event with the update.
        emit BatchMetadataUpdate(fromTokenId, toTokenId);
    }

    /**
     * @notice Sets the max token supply and emits an event.
     *
     * @param newMaxSupply The new max supply to set.
     */
    function setMaxSupply(uint256 newMaxSupply) external {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        // Ensure the max supply does not exceed the maximum value of uint64,
        // a limit due to the storage of bit-packed variables in ERC721A.
        if (newMaxSupply > 2 ** 64 - 1) {
            revert CannotExceedMaxSupplyOfUint64(newMaxSupply);
        }

        // Ensure the max supply is greater then total minted.
        if (newMaxSupply < _totalMinted()) {
            revert NewMaxSupplyCannotBeLessThenTotalMinted(
                newMaxSupply,
                _totalMinted()
            );
        }

        // Set the new max supply.
        _maxSupply = newMaxSupply;

        // Emit an event with the update.
        emit MaxSupplyUpdated(newMaxSupply);
    }

    /**
     * @notice Sets the provenance hash and emits an event.
     *
     *         The provenance hash is used for reveals, which
     *         is a hash of the ordered metadata to show it has not been
     *         modified after mint started.
     *
     *         This function will revert after the first item has been minted.
     *
     * @param newProvenanceHash The new provenance hash to set.
     */
    function setProvenanceHash(bytes32 newProvenanceHash) external {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        // Keep track of the old provenance hash for emitting with the event.
        bytes32 oldProvenanceHash = _provenanceHash;

        // Set the new provenance hash.
        _provenanceHash = newProvenanceHash;

        // Emit an event with the update.
        // Users can track events onchain in case provenance hashes are
        // updated due to seasonal drop (_maxSupply update).
        // Its will also be verifiable off-chain for additional transparency.
        emit ProvenanceHashUpdated(oldProvenanceHash, newProvenanceHash);
    }

    /**
     * @notice Sets the default royalty information.
     *
     * Requirements:
     *
     * - `receiver` cannot be the zero address.
     * - `feeNumerator` cannot be greater than the fee denominator of 10_000 basis points.
     */
    function setDefaultRoyalty(address receiver, uint96 feeNumerator) external {
        // Ensure the sender is only the owner or configurer contract.
        _onlyOwnerOrConfigurer();

        if (feeNumerator > 1_000) revert InvalidBasisPoints(feeNumerator);

        // Set the default royalty.
        // ERC2981 implementation ensures feeNumerator <= feeDenominator
        // and receiver != address(0).
        _setDefaultRoyalty(receiver, feeNumerator);

        // Emit an event with the updated params.
        emit RoyaltyInfoUpdated(receiver, feeNumerator);
    }

    /**
     * @notice Set the transfer validator. Only callable by the token owner.
     */
    function setTransferValidator(address newValidator) external onlyOwner {
        // Set the new transfer validator.
        _setTransferValidator(newValidator);
    }

    /**
     * @notice Set unseen market registry. Only callable by the token owner.
     */
    function setUnseenMarketRegistry(
        address _unseenMarketRegistry
    ) external onlyOwner {
        if (_unseenMarketRegistry == unseenMarketRegistry)
            revert SameUnseenMarketRegistry();
        // Set the new unseen market registry.
        unseenMarketRegistry = _unseenMarketRegistry;

        emit UnseenMarketRegistryUpdated(_unseenMarketRegistry);
    }

    /**
     * @notice Returns the base URI for token metadata.
     */
    function baseURI() external view override returns (string memory) {
        return _baseURI();
    }

    /**
     * @notice Returns the base URI for the contract, which ERC721A uses
     *         to return tokenURI.
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return _tokenBaseURI;
    }

    /**
     * @notice Returns the contract URI for contract metadata.
     */
    function contractURI() external view override returns (string memory) {
        return _contractURI;
    }

    /**
     * @notice Returns the max token supply.
     */
    function maxSupply() public view returns (uint256) {
        return _maxSupply;
    }

    /**
     * @notice Returns the provenance hash.
     *         The provenance hash is used for random reveals, which
     *         is a hash of the ordered metadata to show it is unmodified
     *         after mint has started.
     */
    function provenanceHash() external view override returns (bytes32) {
        return _provenanceHash;
    }

    /**
     * @notice Returns the token URI for token metadata.
     *
     * @param tokenId The token id to get the token URI for.
     */
    function tokenURI(
        uint256 tokenId
    ) public view virtual override(ERC721A, IERC721A) returns (string memory) {
        // Revert if the tokenId doesn't exist.
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        // Put the baseURI on the stack.
        string memory theBaseURI = _baseURI();

        // Return empty if baseURI is empty.
        if (bytes(theBaseURI).length == 0) {
            return "";
        }

        // If the last character of the baseURI is not a slash, then return
        // the baseURI to signal the same metadata for all tokens, such as
        // for a prereveal state.
        if (bytes(theBaseURI)[bytes(theBaseURI).length - 1] != bytes("/")[0]) {
            return theBaseURI;
        }

        // Append the tokenId to the baseURI and return.
        return string.concat(theBaseURI, _toString(tokenId));
    }

    /**
     * @notice Returns the transfer validation function used.
     */
    function getTransferValidationFunction()
        external
        pure
        returns (bytes4 functionSignature, bool isViewFunction)
    {
        functionSignature = ITransferValidator.validateTransfer.selector;
        isViewFunction = false;
    }

    /**
     * @dev Hook that is called before any token transfer.
     *      This includes minting and burning.
     */
    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 /* quantity */
    ) internal virtual override {
        if (from != address(0) && to != address(0)) {
            // Restrict transfer if token is rented.
            if (userOf(startTokenId) != address(0)) {
                revert TokenIsRented();
            }
            // Call the transfer validator if one is set.
            address transferValidator = _transferValidator;
            if (transferValidator != address(0)) {
                ITransferValidator(transferValidator).validateTransfer(
                    msg.sender,
                    from,
                    to,
                    startTokenId
                );
            }
        }
    }

    /**
     * @notice Returns whether the interface is supported.
     *
     * @param interfaceId The interface id to check against.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(MarketsPreapproved, ERC2981) returns (bool) {
        return
            interfaceId == type(IContractMetadata).interfaceId ||
            interfaceId == type(ICreatorToken).interfaceId ||
            interfaceId == 0x49064906 || // ERC-4906 (MetadataUpdate)
            ERC2981.supportsInterface(interfaceId) ||
            // MarketsPreapproved returns supportsInterface true for
            //     ERC165, ERC721, ERC721Metadata
            MarketsPreapproved.supportsInterface(interfaceId);
    }

    /**
     * @dev Overrides the `_startTokenId` function from ERC721A to start at
     *      token id `1`.
     *
     *      This is to avoid issues since `0` is typically used to signal
     *      values that have not been set or have been removed.
     */
    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }
}
