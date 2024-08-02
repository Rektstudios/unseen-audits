// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { TheGeneratesStorage } from "../lib/TheGeneratesStorage.sol";

import { ConfigStructs } from "../types/DataTypes.sol";

import { ErrorsAndEvents } from "../lib/ErrorsAndEvents.sol";

import { ITheGenerates } from "../interfaces/ITheGenerates.sol";

import { ECDSA } from "solady/src/utils/ECDSA.sol";

import { SafeTransferLib } from "solady/src/utils/SafeTransferLib.sol";

/**
 * @title  TheGeneratesImplementation
 * @author decapitator (0xdecapitator.eth)
 * @notice A helper contract that contains the implementation logic for
 *         TheGenerates, to help reduce contract size
 *         on the token contract itself.
 */
contract TheGeneratesImplementation is ErrorsAndEvents {
    using TheGeneratesStorage for TheGeneratesStorage.Layout;

    /// @notice The original address of this contract, to ensure that it can
    ///         only be called into with delegatecall.
    address internal immutable _originalImplementation = address(this);

    /// @notice Internal constants for EIP-712: Typed structured
    ///         data hashing and signing
    bytes32 internal constant _SIGNED_MINT_TYPEHASH =
        // prettier-ignore
        keccak256(
            "SignedMint("
                "address minter,"
                "MintParams mintParams,"
                "uint256 salt"
            ")"
            "MintParams("
                "uint256 startPrice,"
                "uint256 endPrice,"
                "uint256 startTime,"
                "uint256 endTime,"
                "uint256 maxTokenSupplyForStage,"
                "uint256 dropStageIndex"
            ")"
        );
    bytes32 internal constant _MINT_PARAMS_TYPEHASH =
        // prettier-ignore
        keccak256(
            "MintParams("
                "uint256 startPrice,"
                "uint256 endPrice,"
                "uint256 startTime,"
                "uint256 endTime,"
                "uint256 maxTokenSupplyForStage,"
                "uint256 dropStageIndex"
            ")"
        );
    bytes32 internal constant _EIP_712_DOMAIN_TYPEHASH =
        // prettier-ignore
        keccak256(
            "EIP712Domain("
                "string name,"
                "string version,"
                "uint256 chainId,"
                "address verifyingContract"
            ")"
        );
    bytes32 internal constant _NAME_HASH = keccak256("TheGenerates");
    bytes32 internal constant _VERSION_HASH = keccak256("1.0");

    /**
     * @notice Constant for an unlimited `maxTokenSupplyForStage`.
     *         Used in `mintPublic` where no `maxTokenSupplyForStage`
     *         is stored in the `PublicDrop` struct.
     */
    uint256 internal constant _UNLIMITED_MAX_TOKEN_SUPPLY_FOR_STAGE =
        type(uint256).max;

    /**
     * @notice Constant for a public mint's `dropStageIndex`.
     *         Used in `mintPublic` where no `dropStageIndex`
     *         is stored in the `PublicDrop` struct.
     */
    uint256 internal constant _PUBLIC_DROP_STAGE_INDEX = 0;

    /**
     * @dev Constructor for contract deployment.
     */
    constructor() payable {}

    /**
     * @notice The fallback function is used as a dispatcher for
     *         TheGenerates methods.
     *
     */
    fallback(bytes calldata) external returns (bytes memory output) {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        // Get the function selector.
        bytes4 selector = msg.sig;

        // Get the rest of the msg data after the selector.
        bytes calldata data = msg.data[4:];

        if (selector == ITheGenerates.getPublicDrop.selector) {
            // Return the public drop.
            return abi.encode(TheGeneratesStorage.layout()._publicDrop);
        } else if (selector == ITheGenerates.getUnseenPayout.selector) {
            // Return unseen payout.
            return abi.encode(TheGeneratesStorage.layout()._unseenPayout);
        } else if (selector == ITheGenerates.getPaymentToken.selector) {
            // Return payment token.
            return abi.encode(TheGeneratesStorage.layout()._uncn);
        } else if (selector == ITheGenerates.getAllowListMerkleRoot.selector) {
            // Return the allowed merkle root.
            return
                abi.encode(TheGeneratesStorage.layout()._allowListMerkleRoot);
        } else if (selector == ITheGenerates.getSigner.selector) {
            // Return the allowed signer.
            return abi.encode(TheGeneratesStorage.layout()._allowedSigner);
        } else if (selector == ITheGenerates.getDigestIsUsed.selector) {
            // Get the digest.
            bytes32 digest = bytes32(data[0:32]);

            // Return if the digest is used.
            return
                abi.encode(TheGeneratesStorage.layout()._usedDigests[digest]);
        } else {
            // Revert if the function selector is not supported.
            revert UnsupportedFunctionSelector(selector);
        }
    }

    /**
     * @dev Creates an order with the required mint payment.
     *
     * @param context             Context of the order
     *                            containing the mint parameters.
     *
     * @return minter             Address of the minter.
     * @return quantity           Quantity to be minted.
     */
    function mint(
        bytes calldata context
    ) external returns (address minter, uint256 quantity) {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        // check for correct context length. Minimum is 53 bytes
        // (substandard byte, minter, quantity)
        if (context.length < 53) {
            revert InvalidExtraDataEncoding();
        }

        quantity = uint256(bytes32(context[21:53]));

        if (quantity == 0) revert QuantityNotSet();

        // Derive the substandard version.
        uint8 substandard = uint8(context[0]);

        if (substandard > 2) {
            revert InvalidSubstandard(substandard);
        }

        // All substandards have minter as first param.
        minter = address(bytes20(context[1:21]));

        // If the minter is the zero address, set it to the caller.
        if (minter == address(0)) {
            minter = msg.sender;
        }

        if (substandard == 0) {
            // 0: Public mint
            _mintPublic(minter, quantity);
        } else if (substandard == 1) {
            // 1: Allow list mint
            ConfigStructs.MintParams memory mintParams = abi.decode(
                context[53:245],
                (ConfigStructs.MintParams)
            );
            // Instead of putting the proof in memory, pass context and offset
            // to use it directly from calldata.
            _mintAllowList(minter, quantity, mintParams, context, 245);
        } else {
            // substandard == 2
            // 2: Signed mint
            ConfigStructs.MintParams memory mintParams = abi.decode(
                context[53:245],
                (ConfigStructs.MintParams)
            );
            uint256 salt = uint256(bytes32(context[245:277]));
            bytes32 signatureR = bytes32(context[277:309]);
            bytes32 signatureVS = bytes32(context[309:341]);
            _mintSigned(
                minter,
                quantity,
                mintParams,
                salt,
                signatureR,
                signatureVS
            );
        }
    }

    /**
     * @notice Mint a public drop stage.
     *
     * @param minter   The minter address.
     * @param quantity The amount to mint.
     */
    function _mintPublic(address minter, uint256 quantity) internal {
        // Get the public drop.
        ConfigStructs.PublicDrop memory publicDrop = TheGeneratesStorage
            .layout()
            ._publicDrop;

        // Check that the stage is active and calculate the current price.
        uint256 currentPrice = _currentPrice(
            publicDrop.startTime,
            publicDrop.endTime,
            publicDrop.startPrice,
            publicDrop.endPrice
        );

        // Validate the mint parameters.
        _validateMint(
            minter,
            quantity,
            currentPrice,
            _UNLIMITED_MAX_TOKEN_SUPPLY_FOR_STAGE,
            _PUBLIC_DROP_STAGE_INDEX
        );
    }

    /**
     * @notice Mint an allow list drop stage.
     *
     * @param minter       The minter address.
     * @param quantity     The amount to mint.
     * @param mintParams   The mint parameters.
     * @param context      The context of the order.
     * @param proofOffsetInContext The offset of the proof in the context.
     */
    function _mintAllowList(
        address minter,
        uint256 quantity,
        ConfigStructs.MintParams memory mintParams,
        bytes calldata context,
        uint256 proofOffsetInContext
    ) internal {
        // Verify the proof.
        if (
            !_verifyProof(
                context,
                proofOffsetInContext,
                TheGeneratesStorage.layout()._allowListMerkleRoot,
                keccak256(abi.encode(minter, mintParams))
            )
        ) {
            revert InvalidProof();
        }

        // Check that the stage is active and calculate the current price.
        uint256 currentPrice = _currentPrice(
            mintParams.startTime,
            mintParams.endTime,
            mintParams.startPrice,
            mintParams.endPrice
        );

        // Validate the mint parameters.
        _validateMint(
            minter,
            quantity,
            currentPrice,
            mintParams.maxTokenSupplyForStage,
            mintParams.dropStageIndex
        );
    }

    /**
     * @notice Mint with a server-side signature.
     *         Note that a signature can only be used once.
     *
     * @param minter       The minter address.
     * @param quantity     The amount to mint.
     * @param mintParams   The mint parameters.
     * @param salt         The salt for the signed mint.
     * @param signatureR   The server-side signature `r` value.
     * @param signatureVS  The server-side signature `vs` value.
     */
    function _mintSigned(
        address minter,
        uint256 quantity,
        ConfigStructs.MintParams memory mintParams,
        uint256 salt,
        bytes32 signatureR,
        bytes32 signatureVS
    ) internal {
        // Get the digest to verify the EIP-712 signature.
        bytes32 digest = _getDigest(minter, mintParams, salt);

        // Ensure the digest has not already been used.
        if (TheGeneratesStorage.layout()._usedDigests[digest]) {
            revert SignatureAlreadyUsed();
        } else {
            // Mark the digest as used.
            TheGeneratesStorage.layout()._usedDigests[digest] = true;
        }

        // Check that the stage is active and calculate the current price.
        uint256 currentPrice = _currentPrice(
            mintParams.startTime,
            mintParams.endTime,
            mintParams.startPrice,
            mintParams.endPrice
        );

        // Validate the mint parameters.
        _validateMint(
            minter,
            quantity,
            currentPrice,
            mintParams.maxTokenSupplyForStage,
            mintParams.dropStageIndex
        );

        // Use the recover method to see what address was used to create
        // the signature on this data.
        // Note that if the digest doesn't exactly match what was signed we'll
        // get a random recovered address.
        address recoveredAddress = ECDSA.recover(
            digest,
            signatureR,
            signatureVS
        );
        if (TheGeneratesStorage.layout()._allowedSigner != recoveredAddress) {
            revert ECDSA.InvalidSignature();
        }
    }

    /**
     * @dev Validates a mint, reverting if the mint is invalid.
     *
     * @param minter                   The minter address.
     * @param quantity                 The amount to mint.
     * @param currentPrice             The current price.
     * @param maxTokenSupplyForStage   The maximum token supply for the stage.
     * @param dropStageIndex           The drop stage index.
     */
    function _validateMint(
        address minter,
        uint256 quantity,
        uint256 currentPrice,
        uint256 maxTokenSupplyForStage,
        uint256 dropStageIndex
    ) internal {
        // Check the number of mints are availabl.
        _checkMintQuantity(quantity, maxTokenSupplyForStage);

        // Process mint payment.
        _processPayment(quantity, currentPrice);

        emit TheGeneratesMint(minter, dropStageIndex);
    }

    /**
     * @dev Internal view function to derive the current price of a stage
     *      based on the the starting price and ending price. If the start
     *      and end prices differ, the current price will be interpolated on
     *      a linear basis.
     *
     *      Since this function is only used for consideration items, it will
     *      round up.
     *
     * @param startTime  The starting time of the stage.
     * @param endTime    The end time of the stage.
     * @param startPrice The starting price of the stage.
     * @param endPrice   The ending price of the stage.
     *
     * @return price The current price.
     */
    function _currentPrice(
        uint256 startTime,
        uint256 endTime,
        uint256 startPrice,
        uint256 endPrice
    ) internal view returns (uint256 price) {
        // Check that the drop stage has started and not ended.
        // This ensures that the startTime is not greater than the current
        // block timestamp and endTime is greater than the current block
        // timestamp. If this condition is not upheld `duration`, `elapsed`,
        // and `remaining` variables will underflow.
        _checkActive(startTime, endTime);

        // Return the price if startPrice == endPrice.
        if (startPrice == endPrice) {
            return endPrice;
        }

        // Declare variables to derive in the subsequent unchecked scope.
        uint256 duration;
        uint256 elapsed;
        uint256 remaining;

        // Skip underflow checks as startTime <= block.timestamp < endTime.
        unchecked {
            // Derive the duration for the stage and place it on the stack.
            duration = endTime - startTime;

            // Derive time elapsed since the stage started & place on stack.
            elapsed = block.timestamp - startTime;

            // Derive time remaining until stage expires and place on stack.
            remaining = duration - elapsed;
        }

        // Aggregate new amounts weighted by time with rounding factor.
        uint256 totalBeforeDivision = ((startPrice * remaining) +
            (endPrice * elapsed));

        // Use assembly to combine operations and skip divide-by-zero check.
        assembly {
            // Multiply by iszero(iszero(totalBeforeDivision)) to ensure
            // amount is set to zero if totalBeforeDivision is zero,
            // as intermediate overflow can occur if it is zero.
            price := mul(
                iszero(iszero(totalBeforeDivision)),
                // Subtract 1 from the numerator and add 1 to the result
                // to get the proper rounding direction to round up.
                // Division is performed with no zero check as duration
                // cannot be zero as long as startTime < endTime.
                add(div(sub(totalBeforeDivision, 1), duration), 1)
            )
        }
    }

    /**
     * @notice Check that the drop stage is active.
     *
     * @param startTime The drop stage start time.
     * @param endTime   The drop stage end time.
     */
    function _checkActive(uint256 startTime, uint256 endTime) internal view {
        // Define a variable if the drop stage is inactive.
        bool inactive;

        // startTime <= block.timestamp < endTime
        assembly {
            inactive := or(
                iszero(gt(endTime, timestamp())),
                gt(startTime, timestamp())
            )
        }

        // Revert if the drop stage is not active.
        if (inactive) {
            revert NotActive(block.timestamp, startTime, endTime);
        }
    }

    /**
     * @notice Check that the wallet is allowed to mint the desired quantity.
     *
     * @param quantity                 The number of tokens to mint.
     * @param maxTokenSupplyForStage   The max token supply for the drop stage.
     */
    function _checkMintQuantity(
        uint256 quantity,
        uint256 maxTokenSupplyForStage
    ) internal view {
        // Get the mint stats from the token contract.
        (uint256 totalMinted, uint256 maxSupply) = ITheGenerates(address(this))
            .getMintStats();

        // Ensure mint quantity doesn't exceed maxSupply.
        if (quantity + totalMinted > maxSupply) {
            revert MintQuantityExceedsMaxSupply(
                quantity + totalMinted,
                maxSupply
            );
        }

        // Ensure mint quantity doesn't exceed maxTokenSupplyForStage.
        if (quantity + totalMinted > maxTokenSupplyForStage) {
            revert MintQuantityExceedsMaxTokenSupplyForStage(
                quantity + totalMinted,
                maxTokenSupplyForStage
            );
        }
    }

    /**
     * @notice Derive the required consideration items for the mint,
     *         includes the fee recipient and creator payout.
     *
     * @param quantity     The number of tokens to mint.
     * @param currentPrice The current price of each token.
     */
    function _processPayment(uint256 quantity, uint256 currentPrice) internal {
        // If the mint price is zero, return early.
        if (currentPrice == 0) {
            return;
        }
        // Put the total mint price on the stack.
        uint256 totalPrice = quantity * currentPrice;

        // Put the creator payouts on the stack.
        TheGeneratesStorage.Layout storage layout = TheGeneratesStorage
            .layout();

        if (layout._unseenPayout.payoutAddress == address(0)) {
            revert UnseenPayoutNotSet();
        }

        if (layout._uncn == address(0)) {
            revert PaymentTokenNotSet();
        }

        SafeTransferLib.safeTransferFrom(
            layout._uncn,
            msg.sender,
            layout._unseenPayout.payoutAddress,
            totalPrice
        );
    }

    /**
     * @dev Internal view function to derive the EIP-712 domain separator.
     *
     * @return The derived domain separator.
     */
    function _deriveDomainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    _EIP_712_DOMAIN_TYPEHASH,
                    _NAME_HASH,
                    _VERSION_HASH,
                    block.chainid,
                    address(this)
                )
            );
    }

    /**
     * @notice Implementation function to update the public drop data and
     *         emit an event.
     *
     *         Do not use this method directly.
     *
     * @param publicDrop The public drop data.
     */
    function updatePublicDrop(
        ConfigStructs.PublicDrop calldata publicDrop
    ) external {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        // Revert if the startTime is past the endTime.
        if (publicDrop.startTime >= publicDrop.endTime) {
            revert InvalidStartAndEndTime(
                publicDrop.startTime,
                publicDrop.endTime
            );
        }

        // Set the public drop data.
        TheGeneratesStorage.layout()._publicDrop = publicDrop;

        // Emit an event with the update.
        emit PublicDropUpdated(publicDrop);
    }

    /**
     * @notice Implementation function to update the allow list merkle root
     *         for the nft contract and emit an event.
     *
     *         Do not use this method directly.
     *
     * @param merkleRoot The allow list data.
     */
    function updateAllowList(bytes32 merkleRoot) external {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        // Put the previous root on the stack to use for the event.
        bytes32 prevRoot = TheGeneratesStorage.layout()._allowListMerkleRoot;

        // Update the merkle root.
        TheGeneratesStorage.layout()._allowListMerkleRoot = merkleRoot;

        // Emit an event with the update.
        emit AllowListUpdated(prevRoot, merkleRoot);
    }

    /**
     * @notice Updates the creator payout and emits an event.
     *         The basis points at max of 1_000. (used for rent fees only)
     *
     * @param unseenPayout The creator payout address and basis points.
     */
    function updateUnseenPayout(
        ConfigStructs.UnseenPayout calldata unseenPayout
    ) external {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        // Reset the creator payout.
        delete TheGeneratesStorage.layout()._unseenPayout;

        // Get the creator payout.
        ConfigStructs.UnseenPayout memory _unseenPayout = unseenPayout;

        // Ensure the creator payout address is not the zero address.
        if (_unseenPayout.payoutAddress == address(0)) {
            revert UnseenPayoutAddressCannotBeZeroAddress();
        }

        // Ensure fee basis points does not exceed 10%.
        if (_unseenPayout.basisPoints > 1_000) {
            revert InvalidBasisPoints(_unseenPayout.basisPoints);
        }

        // Push to storage.
        TheGeneratesStorage.layout()._unseenPayout = _unseenPayout;

        // Emit an event with the update.
        emit UnseenPayoutUpdated(unseenPayout);
    }

    /**
     * @notice Updates the allowed server-side signer and emits an event.
     *
     * @param signer  The signer to update.
     */
    function updateSigner(address signer) external {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        if (signer == address(0)) {
            revert SignerCannotBeZeroAddress();
        }

        if (signer == TheGeneratesStorage.layout()._allowedSigner) {
            revert DuplicateSigner();
        }

        TheGeneratesStorage.layout()._allowedSigner = signer;

        // Emit an event with the update.
        emit SignerUpdated(signer);
    }

    /**
     * @notice Updates the payment token.
     *
     * @param paymentToken  The payment token to update.
     */
    function updatePaymentToken(address paymentToken) external {
        // Ensure this contract is only called into with delegatecall.
        _onlyDelegateCalled();

        if (paymentToken == address(0)) {
            revert PaymentTokenCannotBeZeroAddress();
        }

        if (paymentToken == TheGeneratesStorage.layout()._uncn) {
            revert DuplicatePaymentToken();
        }

        TheGeneratesStorage.layout()._uncn = paymentToken;

        // Emit an event with the update.
        emit PaymentTokenUpdated(paymentToken);
    }

    /**
     * @notice Verify an EIP-712 signature by recreating the data structure
     *         that we signed on the client side, and then using that to recover
     *         the address that signed the signature for this data.
     *
     * @param minter       The mint recipient.
     * @param mintParams   The mint params.
     * @param salt         The salt for the signed mint.
     */
    function _getDigest(
        address minter,
        ConfigStructs.MintParams memory mintParams,
        uint256 salt
    ) internal view returns (bytes32 digest) {
        bytes32 mintParamsHashStruct = keccak256(
            abi.encode(
                _MINT_PARAMS_TYPEHASH,
                mintParams.startPrice,
                mintParams.endPrice,
                mintParams.startTime,
                mintParams.endTime,
                mintParams.maxTokenSupplyForStage,
                mintParams.dropStageIndex
            )
        );
        digest = keccak256(
            bytes.concat(
                bytes2(0x1901),
                _deriveDomainSeparator(),
                keccak256(
                    abi.encode(
                        _SIGNED_MINT_TYPEHASH,
                        minter,
                        mintParamsHashStruct,
                        salt
                    )
                )
            )
        );
    }

    /**
     * @dev Returns whether `leaf` exists in the Merkle tree with `root`,
     *      given `proof`.
     *
     *      Original function from solady called `verifyCalldata`, modified
     *      to use an offset from the context calldata to avoid expanding
     *      memory.
     */
    function _verifyProof(
        bytes calldata context,
        uint256 proofOffsetInContext,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool isValid) {
        /// @solidity memory-safe-assembly
        assembly {
            if sub(context.length, proofOffsetInContext) {
                // Initialize `offset` to the offset of `proof` in the calldata.
                let offset := add(context.offset, proofOffsetInContext)
                let end := add(
                    offset,
                    sub(context.length, proofOffsetInContext)
                )
                // Iterate over proof elements to compute root hash.
                // prettier-ignore
                for {} 1 {} {
                    // Slot of `leaf` in scratch space.
                    // If the condition is true: 0x20, otherwise: 0x00.
                    let scratch := shl(5, gt(leaf, calldataload(offset)))
                    // Store elements to hash contiguously in scratch space.
                    // Scratch space is 64 bytes (0x00 - 0x3f) and both elements are 32 bytes.
                    mstore(scratch, leaf)
                    mstore(xor(scratch, 0x20), calldataload(offset))
                    // Reuse `leaf` to store the hash to reduce stack operations.
                    leaf := keccak256(0x00, 0x40)
                    offset := add(offset, 0x20)
                    if iszero(lt(offset, end)) { break }
                }
            }
            isValid := eq(leaf, root)
        }
    }

    /**
     * @dev Internal view function to revert if this implementation contract is
     *      called without delegatecall.
     */
    function _onlyDelegateCalled() internal view {
        if (address(this) == _originalImplementation) {
            revert OnlyDelegateCalled();
        }
    }

    /**
     * @dev Internal pure function to cast a `bool` value to a `uint256` value.
     *
     * @param b The `bool` value to cast.
     *
     * @return u The `uint256` value.
     */
    function _cast(bool b) internal pure returns (uint256 u) {
        assembly {
            u := b
        }
    }
}
