// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { AuthenticatedProxy } from "./AuthenticatedProxy.sol";

/**
 * @title  IProxyRegistry
 * @author decapitator (0xdecapitator.eth)
 */
interface IProxyRegistry {
    function authProxyImplementation() external returns (address);

    function proxies(address owner) external returns (AuthenticatedProxy);

    function contracts(address owner) external returns (bool);

    function transferAccessTo(address from, address to) external;
}
