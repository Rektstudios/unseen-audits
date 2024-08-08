// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { AuthenticatedProxy } from "../registry/AuthenticatedProxy.sol";

/**
 * @title  IProxyRegistry
 * @author decapitator (0xdecapitator.eth)
 */
interface IProxyRegistry {

    function registerProxy() external returns (AuthenticatedProxy);
}
