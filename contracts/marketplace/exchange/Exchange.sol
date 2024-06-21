// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ExchangeCore, AuthenticatedProxy } from "./ExchangeCore.sol";

/**
 * @title  Unseen Exchange
 * @author decapitator (0xdecapitator.eth)
 * @notice Exchange Contract
 */
contract Exchange is ExchangeCore {
    /**
     * Constructor
     */
    constructor() payable {}

    function hashOrder(
        address registry,
        address maker,
        address executer,
        address staticTarget,
        bytes4 staticSelector,
        bytes calldata staticExtradata,
        uint256 maximumFill,
        uint256 extraData
    ) external pure returns (bytes32 hash) {
        return
            super.hashOrder(
                Order(
                    registry,
                    maker,
                    executer,
                    staticTarget,
                    staticSelector,
                    staticExtradata,
                    maximumFill,
                    extraData
                )
            );
    }

    function validateOrderParameters(
        address registry,
        address maker,
        address executer,
        address staticTarget,
        bytes4 staticSelector,
        bytes calldata staticExtradata,
        uint256 maximumFill,
        uint256 extraData
    ) external view returns (bool) {
        Order memory order = Order(
            registry,
            maker,
            executer,
            staticTarget,
            staticSelector,
            staticExtradata,
            maximumFill,
            extraData
        );
        return super.validateOrderParameters(order, hashOrder(order));
    }

    function approveOrder(
        address registry,
        address maker,
        address executer,
        address staticTarget,
        bytes4 staticSelector,
        bytes calldata staticExtradata,
        uint256 maximumFill,
        uint256 extraData,
        bool orderbookInclusionDesired
    ) external {
        super.approveOrder(
            Order(
                registry,
                maker,
                executer,
                staticTarget,
                staticSelector,
                staticExtradata,
                maximumFill,
                extraData
            ),
            orderbookInclusionDesired
        );
    }

    function atomicMatch(
        uint256[14] memory uints,
        bytes4[2] memory staticSelectors,
        bytes memory firstExtradata,
        bytes memory firstCalldata,
        bytes memory secondExtradata,
        bytes memory secondCalldata,
        uint8[2] memory howToCalls,
        bytes memory signatures
    ) external {
        return
            super.atomicMatch(
                Order(
                    address(uint160(uints[0])),
                    address(uint160(uints[1])),
                    address(uint160(uints[2])),
                    address(uint160(uints[3])),
                    staticSelectors[0],
                    firstExtradata,
                    uints[4],
                    uints[5]
                ),
                Call(
                    address(uint160(uints[6])),
                    AuthenticatedProxy.HowToCall(howToCalls[0]),
                    firstCalldata
                ),
                Order(
                    address(uint160(uints[7])),
                    address(uint160(uints[8])),
                    address(uint160(uints[9])),
                    address(uint160(uints[10])),
                    staticSelectors[1],
                    secondExtradata,
                    uints[11],
                    uints[12]
                ),
                Call(
                    address(uint160(uints[13])),
                    AuthenticatedProxy.HowToCall(howToCalls[1]),
                    secondCalldata
                ),
                signatures
            );
    }
}
