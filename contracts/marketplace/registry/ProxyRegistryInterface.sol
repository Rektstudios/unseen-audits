// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { AuthenticatedProxy } from "./AuthenticatedProxy.sol";

/**
 * @title  ProxyRegistryInterface
 * @author decapitator (0xdecapitator.eth)
 */
interface ProxyRegistryInterface {
    function authProxyImplementation() external returns (address);

    function proxies(address owner) external returns (AuthenticatedProxy);
}
