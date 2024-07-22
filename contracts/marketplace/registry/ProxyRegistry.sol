// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "solady/src/auth/Ownable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { ProxyRegistryInterface, AuthenticatedProxy } from "./ProxyRegistryInterface.sol";

/**
 * @title  ProxyRegistry
 * @author decapitator (0xdecapitator)
 */
contract ProxyRegistry is Ownable, ProxyRegistryInterface {
    /* Proxy implementation contract. Must be initialized. */
    address public immutable override authProxyImplementation;

    /* Authenticated proxies by user. */
    mapping(address => AuthenticatedProxy) public override proxies;

    /* Contracts allowed to call those proxies. */
    mapping(address => bool) public contracts;

    /**
     * @notice Error thrown when providing zero address.
     */
    error AddressCannotBeZero();

    /**
     * @notice Error thrown when trying to grant authentication
     *         to a contract that is already authenticated.
     */
    error ContractAlreadyAllowed();

    /**
     * @notice Error thrown when trying to revoke authentication
     *         from a contract that is not currently authenticated.
     */
    error ContractNotAllowed();

    /**
     * @notice Error thrown when trying to register a proxy for
     *         a user who already has a proxy registered.
     */
    error UserAlreadyHasProxy();

    /**
     * @notice Error thrown when trying to transfer a proxy from
     *         one user to another without proper authorization.
     */
    error ProxyTransferNotAllowed();

    /**
     * @notice Error thrown when trying to transfer a proxy to a
     *         user who already has a proxy registered.
     */
    error ProxyTransferDestinationExists();

    /**
     * @notice Emitted when a contract is granted authentication.
     * @param addr The address of the contract that has been granted authentication.
     */
    event AuthGranted(address indexed addr);

    /**
     * @notice Emitted when authentication is revoked from a contract.
     * @param addr The address of the contract that has had its authentication revoked.
     */
    event AuthRevoked(address indexed addr);

    /**
     * @notice Emitted when proxy access is transferred.
     * @param from The initial proxy owner transferring the access.
     * @param to The new proxy owner transferring access to.
     */
    event ProxyAccessTransferred(address indexed from, address indexed to);

    /**
     * Enable access for specified contract.
     *
     * @dev ProxyRegistry owner only
     * @param addr Address to which to grant permissions
     */
    function grantAuthentication(address addr) external onlyOwner {
        if (addr == address(0)) revert AddressCannotBeZero();
        if (contracts[addr]) {
            revert ContractAlreadyAllowed();
        }
        contracts[addr] = true;

        emit AuthGranted(addr);
    }

    /**
     * Revoke access for specified contract.
     *
     * @dev ProxyRegistry owner only
     * @param addr Address of which to revoke permissions
     */
    function revokeAuthentication(address addr) external onlyOwner {
        if (!contracts[addr]) {
            revert ContractNotAllowed();
        }
        contracts[addr] = false;

        emit AuthRevoked(addr);
    }

    /**
     * Register a proxy contract with this registry
     *
     * @dev Must be called by the user which the proxy is for, creates a new AuthenticatedProxy
     * @return proxy New AuthenticatedProxy contract
     */
    function registerProxy() external returns (AuthenticatedProxy proxy) {
        return registerProxyFor(msg.sender);
    }

    /**
     * Register a proxy contract with this registry
     * @dev Can be called by any user
     * @return proxy New AuthenticatedProxy contract
     */
    function registerProxyFor(
        address user
    ) public returns (AuthenticatedProxy proxy) {
        if (proxies[user] != AuthenticatedProxy(address(0))) {
            revert UserAlreadyHasProxy();
        }
        bytes32 cloneSalt = keccak256(
            abi.encodePacked(user, block.timestamp, blockhash(block.number - 1))
        );
        proxy = AuthenticatedProxy(
            Clones.cloneDeterministic(authProxyImplementation, cloneSalt)
        );
        AuthenticatedProxy(proxy).initialize(
            user,
            this,
            authProxyImplementation
        );
        proxies[user] = proxy;
    }

    /**
     * Transfer access
     */
    function transferAccessTo(address from, address to) external {
        AuthenticatedProxy proxy = proxies[from];

        // @note should call this function only from the proxy
        if (msg.sender != address(proxy)) {
            revert ProxyTransferNotAllowed();
        }

        if (proxies[to] != AuthenticatedProxy(address(0))) {
            revert ProxyTransferDestinationExists();
        }

        /* EFFECTS */
        delete proxies[from];

        proxies[to] = proxy;

        emit ProxyAccessTransferred(from, to);
    }
}
