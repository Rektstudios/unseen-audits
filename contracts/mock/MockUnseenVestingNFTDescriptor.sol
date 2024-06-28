// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.19;

import { IERC721Metadata } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";

import { NFTSVG } from "../vesting/libraries/NFTSVG.sol";
import { SVGElements } from "../vesting/libraries/SVGElements.sol";
import { Lockup } from "../vesting/types/DataTypes.sol";
import { UnseenVestingNFTDescriptor } from "../vesting/UnseenVestingNFTDescriptor.sol";

contract MockUnseenVestingNFTDescriptor is UnseenVestingNFTDescriptor {
    function abbreviateAmount_(
        uint256 amount,
        uint256 decimals
    ) external pure returns (string memory) {
        return abbreviateAmount(amount, decimals);
    }

    function calculateDurationInDays_(
        uint256 startTime,
        uint256 endTime
    ) external pure returns (string memory) {
        return calculateDurationInDays(startTime, endTime);
    }

    function calculatePixelWidth_(
        string memory text,
        bool largeFont
    ) external pure returns (uint256) {
        return SVGElements.calculatePixelWidth(text, largeFont);
    }

    function calculateVestedPercentage_(
        uint128 vestedAmount,
        uint128 depositedAmount
    ) external pure returns (uint256) {
        return calculateVestedPercentage(vestedAmount, depositedAmount);
    }

    function generateAttributes_(
        string memory assetSymbol,
        string memory sender,
        string memory status
    ) external pure returns (string memory) {
        return generateAttributes(assetSymbol, sender, status);
    }

    function generateDescription_(
        string memory vestingModel,
        string memory assetSymbol,
        string memory scheduleId,
        string memory uncnAddress,
        string memory assetAddress
    ) external pure returns (string memory) {
        return
            generateDescription(
                vestingModel,
                assetSymbol,
                scheduleId,
                uncnAddress,
                assetAddress
            );
    }

    function generateName_(
        string memory vestingModel,
        string memory scheduleId
    ) external pure returns (string memory) {
        return generateName(vestingModel, scheduleId);
    }

    function generateSVG_(
        NFTSVG.SVGParams memory params
    ) external pure returns (string memory) {
        return NFTSVG.generateSVG(params);
    }

    function identity() external pure returns (string memory) {
        return SVGElements.identity();
    }

    function stringifyCardType_(
        SVGElements.CardType cardType
    ) external pure returns (string memory) {
        return SVGElements.stringifyCardType(cardType);
    }

    function stringifyFractionalAmount_(
        uint256 fractionalAmount
    ) external pure returns (string memory) {
        return stringifyFractionalAmount(fractionalAmount);
    }

    function stringifyPercentage_(
        uint256 percentage
    ) external pure returns (string memory) {
        return stringifyPercentage(percentage);
    }

    function stringifyStatus_(
        Lockup.Status status
    ) external pure returns (string memory) {
        return stringifyStatus(status);
    }
}
