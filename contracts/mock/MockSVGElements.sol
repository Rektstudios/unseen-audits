// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "../vesting/libraries/SVGElements.sol";

contract MockSVGElements {
    function getSignGE() external pure returns (string memory) {
        return SVGElements.SIGN_GE;
    }

    function getSignGT() external pure returns (string memory) {
        return SVGElements.SIGN_GT;
    }

    function getSignLT() external pure returns (string memory) {
        return SVGElements.SIGN_LT;
    }

    function testCard(
        SVGElements.CardType cardType,
        string memory content
    ) external pure returns (uint256 width, string memory card) {
        return SVGElements.card(cardType, content);
    }

    function stringifyCardType(
        SVGElements.CardType cardType
    ) external pure returns (string memory) {
        return SVGElements.stringifyCardType(cardType);
    }

    function testFloatingText(
        string memory offset,
        string memory text
    ) external pure returns (string memory) {
        return SVGElements.floatingText(offset, text);
    }

    function testIdentity() external pure returns (string memory) {
        return SVGElements.identity();
    }

    function testProgressCircle(
        uint256 progressNumerical,
        string memory accentColor
    ) external pure returns (string memory) {
        return SVGElements.progressCircle(progressNumerical, accentColor);
    }

    function testCalculatePixelWidth(
        string memory text,
        bool largeFont
    ) external pure returns (uint256 width) {
        return SVGElements.calculatePixelWidth(text, largeFont);
    }
}
