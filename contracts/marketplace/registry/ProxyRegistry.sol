// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "solady/src/auth/Ownable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { ProxyRegistryInterface, AuthenticatedProxy } from "./ProxyRegistryInterface.sol";

/**
 * @title  ProxyRegistry
 * @author decapitator (0xdecapitator.eth)
 */
contract ProxyRegistry is Ownable, ProxyRegistryInterface {
    /* Proxy implementation contract. Must be initialized. */
    address public immutable override authProxyImplementation;

    /* Authenticated proxies by user. */
    mapping(address => AuthenticatedProxy) public override proxies;

    /* Contracts pending access. */
    mapping(address => uint256) public pending;

    /* Contracts allowed to call those proxies. */
    mapping(address => bool) public contracts;

    /* Delay period for adding an authenticated contract.
       This mitigates a particular class of potential compromise to the Unseen Registry Owner (which owns this registry).
       A malicious but rational attacker could grant themselves access to all the proxy contracts.
       A delay period renders this attack nonthreatening - given one week, if that happened, users would have
       plenty of time to notice and revoke access.
    */
    uint256 public DELAY_PERIOD = 1 weeks;

    /**
     * @notice Error thrown when providing zero address.
     */
    error AddressCannotBeZero();

    /**
     * @notice Error thrown when trying to grant authentication
     *         to a contract that is already authenticated or pending.
     */
    error ContractAlreadyAllowedOrPending();

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
     * @notice Emitted when attempting to Grant auth for an allowed contract or
     *         before the delay_period has passed.
     */
    error InvalidContractState();

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
     * Enable access for specified contract. Subject to delay period.
     *
     * @dev ProxyRegistry owner only
     * @param addr Address to which to grant permissions
     */
    function startGrantAuthentication(address addr) external onlyOwner {
        if (addr == address(0)) revert AddressCannotBeZero();
        if (contracts[addr] || pending[addr] != 0) {
            revert ContractAlreadyAllowedOrPending();
        }
        pending[addr] = block.timestamp;
    }

    /**
     * End the process to enable access for specified contract after delay period has passed.
     *
     * @dev ProxyRegistry owner only
     * @param addr Address to which to grant permissions
     */
    function endGrantAuthentication(address addr) external onlyOwner {
        if (
            contracts[addr] ||
            pending[addr] == 0 ||
            (pending[addr] + DELAY_PERIOD) >= block.timestamp
        ) revert InvalidContractState();
        pending[addr] = 0;
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
        AuthenticatedProxy(proxy).initialize(user);
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
