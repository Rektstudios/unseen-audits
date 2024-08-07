// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ProxyRegistry } from "./ProxyRegistry.sol";

/**
 * @title  AuthenticatedProxy
 * @author decapitator (0xdecapitator.eth)
 * @notice Proxy contract to hold access to assets on behalf of
 *         a user (e.g. ERC20 approve) and execute calls under particular conditions.
 */
contract AuthenticatedProxy {
    /* Whether initialized. */
    bool public initialized;

    /* Address which owns this proxy. */
    address public owner;

    /* Associated registry with contract authentication information. */
    ProxyRegistry public immutable registry;

    /* Whether access has been revoked. */
    bool public revoked;

    /// @notice The original address of the implementation.
    address public immutable implementation = address(this);

    /* Delegate call could be used to atomically transfer multiple assets owned by the proxy contract with one order. */
    enum HowToCall {
        Call,
        DelegateCall
    }

    /* Event fired when the proxy access is revoked or unrevoked. */
    event Revoked(bool revoked);

    /**
     * @dev Event to show ownership has been transferred
     * @param previousOwner representing the address of the previous owner
     * @param newOwner representing the address of the new owner
     */
    event ProxyOwnershipTransferred(address previousOwner, address newOwner);

    /**
     * @dev Reverts when an unauthorized action is attempted.
     */
    error NotAuthorized();

    /**
     * @dev Reverts when an attempt is made to initialize an already initialized contract.
     */
    error AlreadyInitialized();

    /**
     * @dev Reverts when the owner address is set to the zero address.
     */
    error OwnerIsZeroAddress();

    /**
     * @dev Reverts when a function is called by an invalid caller.
     */
    error InvalidCaller();

    /**
     * @dev Reverts when proxied call fails.
     */
    error ProxyAssertionFailed();

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyProxyOwner() {
        if (msg.sender != owner) revert NotAuthorized();
        _;
    }

    constructor() payable {
        registry = ProxyRegistry(msg.sender);
    }

    /**
     * Initialize an AuthenticatedProxy
     *
     * @param addrOwner Address of user on whose behalf this proxy will act
     */
    function initialize(address addrOwner) external {
        if (initialized) revert AlreadyInitialized();
        initialized = true;
        owner = addrOwner;
    }

    /**
     * Set the revoked flag (allows a user to revoke ProxyRegistry access temporarily)
     *
     * @dev Can be called by the user only
     * @param revoke Whether or not to revoke access
     */
    function setRevoke(bool revoke) external onlyProxyOwner {
        revoked = revoke;
        emit Revoked(revoke);
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferProxyOwnership(address newOwner) external onlyProxyOwner {
        if (newOwner == address(0)) revert OwnerIsZeroAddress();
        emit ProxyOwnershipTransferred(owner, newOwner);
        address prevOwner = owner;
        owner = newOwner;
        registry.transferAccessTo(prevOwner, newOwner);
    }

    /**
     * Execute a message call from the proxy contract
     *
     * @dev Can be called by the user, or by a contract authorized
     *      by the registry as long as the user has not revoked access
     * @param dest Address to which the call will be sent
     * @param howToCall Which kind of call to make
     * @param data Calldata to send
     * @return result Result of the call (success or failure)
     */
    function proxy(
        address dest,
        HowToCall howToCall,
        bytes memory data
    ) public returns (bool result) {
        if (
            (msg.sender != owner &&
                (revoked || !registry.contracts(msg.sender))) ||
            dest == address(registry)
        ) revert InvalidCaller();

        bytes memory ret;

        if (howToCall == HowToCall.Call) {
            (result, ret) = dest.call(data);
        } else if (howToCall == HowToCall.DelegateCall) {
            (result, ret) = dest.delegatecall(data);
        }
    }

    /**
     * Execute a message call and assert success
     * @dev Same functionality as `proxy`, just asserts the return value
     * @param dest Address to which the call will be sent
     * @param howToCall What kind of call to make
     * @param data Calldata to send
     */
    function proxyAssert(
        address dest,
        HowToCall howToCall,
        bytes memory data
    ) external {
        if (!proxy(dest, howToCall, data)) revert ProxyAssertionFailed();
    }
}
