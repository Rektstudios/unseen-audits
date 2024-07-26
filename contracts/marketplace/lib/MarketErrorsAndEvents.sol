// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MarketErrorsAndEvents
 * @dev Interface for market-related errors and events.
 */
interface MarketErrorsAndEvents {
    /**
     * @dev Error indicating that at least one address is required.
     */
    error MinimumOneAddress();

    /**
     * @dev Error indicating that the treasury address is the zero address.
     */
    error TreasuryIsZeroAddress();

    /**
     * @dev Error indicating that the registry address is the zero address.
     */
    error RegistryIsZeroAddress();

    /**
     * @dev Error indicating that the registry has not been added.
     */
    error RegistryNotAdded();

    /**
     * @dev Error indicating that the call target does not exist.
     */
    error CallTargetDoesNotExist();

    /**
     * @dev Error indicating the proxy does not exist for the maker.
     */
    error ProxyDoesNotExistForMaker();

    /**
     * @dev Error indicating the proxy implementation is incorrect for the maker.
     */
    error IncorrectProxyImplementationForMaker();

    /**
     * @dev Error indicating that the order has already been approved.
     */
    error OrderHasAlreadyBeenApproved();

    /**
     * @dev Error indicating that the fill value is already set to the desired value.
     */
    error FillIsSetToTheDesiredValue();

    /**
     * @dev Error indicating that the first order hash has invalid parameters.
     */
    error FirstOrderHasInvalidParams();

    /**
     * @dev Error indicating that the second order hash has invalid parameters.
     */
    error SecondOrderHasInvalidParams();

    /**
     * @dev Error indicating that self-matching is prohibited.
     */
    error SelfMatchingIsProhibited();

    /**
     * @dev Error indicating that the first order failed authorization.
     */
    error FirstOrderFailedAuthorization();

    /**
     * @dev Error indicating that the second order failed authorization.
     */
    error SecondOrderFailedAuthorization();

    /**
     * @dev Error indicating that the first call failed.
     */
    error FirstCallFailed();

    /**
     * @dev Error indicating that the second call failed.
     */
    error SecondCallFailed();

    /**
     * @dev Error indicating that the address cannot be zero.
     */
    error AddressCannotBeZero();

    /**
     * @dev Error indicating that the address is already set.
     */
    error AddressIsAlreadySet();

    /**
     * @dev Error indicating that the value is already set.
     */
    error ValueIsAlreadySet();

    /**
     * @dev Error indicating a mismatch in fees.
     */
    error FeeMismatch();

    /**
     * @dev Error indicating that the sender is not authorized.
     */
    error SenderNotAuthorized();

    /**
     * @dev Event emitted when an order is approved.
     * @param hash The hash of the order.
     * @param registry The registry address.
     * @param maker The address of the maker.
     * @param executer The address of the executer.
     * @param staticTarget The static target address.
     * @param staticSelector The static selector.
     * @param staticExtradata The static extradata.
     * @param maximumFill The maximum fill amount.
     * @param listingTime The listing time.
     * @param expirationTime The expiration time.
     * @param salt The salt value.
     * @param orderbookInclusionDesired Indicates if orderbook inclusion is desired.
     */
    event OrderApproved(
        bytes32 indexed hash,
        address registry,
        address indexed maker,
        address indexed executer,
        address staticTarget,
        bytes4 staticSelector,
        bytes staticExtradata,
        uint256 maximumFill,
        uint256 listingTime,
        uint256 expirationTime,
        uint256 salt,
        bool orderbookInclusionDesired
    );

    /**
     * @dev Event emitted when an order fill is changed.
     * @param hash The hash of the order.
     * @param maker The address of the maker.
     * @param newFill The new fill amount.
     */
    event OrderFillChanged(
        bytes32 indexed hash,
        address indexed maker,
        uint256 newFill
    );

    /**
     * @dev Event emitted when orders are matched.
     * @param firstHash The hash of the first order.
     * @param secondHash The hash of the second order.
     * @param firstMaker The address of the first maker.
     * @param secondMaker The address of the second maker.
     * @param newFirstFill The new fill amount for the first order.
     * @param newSecondFill The new fill amount for the second order.
     */
    event OrdersMatched(
        bytes32 firstHash,
        bytes32 secondHash,
        address indexed firstMaker,
        address indexed secondMaker,
        uint256 newFirstFill,
        uint256 newSecondFill
    );

    /**
     * @dev Event emitted when the protocol fee recipient is updated.
     * @param newRecipient The new fee recipient address.
     */
    event ProtocolFeeRecipientUpdated(address newRecipient);

    /**
     * @dev Event emitted when the protocol fee basis points are updated.
     * @param pFee The new protocol fee basis points.
     */
    event ProtocolFeeUpdated(uint256 pFee);
}
