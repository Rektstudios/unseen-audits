// SPDX-License-Identifier: MIT
// solhint-disable max-line-length,quotes
pragma solidity ^0.8.26;

import { Base64 } from "@openzeppelin/contracts/utils/Base64.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";
import { IVestingLockup } from "./interfaces/IVestingLockup.sol";
import { IUnseenVestingNFTDescriptor } from "./interfaces/IUnseenVestingNFTDescriptor.sol";
import { Lockup } from "./types/DataTypes.sol";
import { NFTSVG } from "./libraries/NFTSVG.sol";
import { SVGElements } from "./libraries/SVGElements.sol";

/*

$$$$$$$\            $$\         $$\            $$$$$$\    $$\                     $$\ $$\                     
$$  __$$\           $$ |        $$ |          $$  __$$\   $$ |                    $$ |\__|                    
$$ |  $$ | $$$$$$\  $$ |  $$\ $$$$$$\         $$ /  \__|$$$$$$\   $$\   $$\  $$$$$$$ |$$\  $$$$$$\   $$$$$$$\ 
$$$$$$$  |$$  __$$\ $$ | $$  |\_$$  _|        \$$$$$$\  \_$$  _|  $$ |  $$ |$$  __$$ |$$ |$$  __$$\ $$  _____|
$$  __$$< $$$$$$$$ |$$$$$$  /   $$ |           \____$$\   $$ |    $$ |  $$ |$$ /  $$ |$$ |$$ /  $$ |\$$$$$$\  
$$ |  $$ |$$   ____|$$  _$$<    $$ |$$\       $$\   $$ |  $$ |$$\ $$ |  $$ |$$ |  $$ |$$ |$$ |  $$ | \____$$\ 
$$ |  $$ |\$$$$$$$\ $$ | \$$\   \$$$$  |      \$$$$$$  |  \$$$$  |\$$$$$$  |\$$$$$$$ |$$ |\$$$$$$  |$$$$$$$  |
\__|  \__| \_______|\__|  \__|   \____/        \______/    \____/  \______/  \_______|\__| \______/ \_______/ 

*/

/**
 * @title  UnseenVestingNFTDescriptor
 * @author decapitator (0xdecapitator.eth)
 * @notice This contract generates the URI describing
 *         UnseenVesting schedules NFTs
 */
contract UnseenVestingNFTDescriptor is IUnseenVestingNFTDescriptor {
    using Strings for address;
    using Strings for string;
    using Strings for uint256;

    // Struct to store variables used in the tokenURI function
    struct TokenURIVars {
        address uncn;
        string uncnSymbol;
        uint128 depositedAmount;
        string json;
        IVestingLockup unseenVesting;
        string unseenVestingAddress;
        string status;
        string svg;
        uint256 vestedPercentage;
        string vestingModel;
    }

    /**
     * @notice Generates the URI for an Unseen Vesting NFT.
     * @dev The URI includes both the SVG image and JSON metadata.
     * @param unseenVesting The ERC721 contract instance representing Unseen Vesting schedules.
     * @param scheduleId The ID of the schedule for which to generate the URI.
     * @return uri The URI for the specified NFT.
     */
    function tokenURI(
        address unseenVesting,
        uint256 scheduleId
    ) external view override returns (string memory uri) {
        TokenURIVars memory vars;

        // Load the contract.
        vars.unseenVesting = IVestingLockup(unseenVesting);
        vars.unseenVestingAddress = unseenVesting.toHexString();
        vars.uncn = address(vars.unseenVesting.UNCN());
        vars.uncnSymbol = "UNCN";
        vars.depositedAmount = vars.unseenVesting.getDepositedAmount(
            scheduleId
        );

        // Load the schedule's data.
        vars.status = stringifyStatus(vars.unseenVesting.statusOf(scheduleId));
        vars.vestedPercentage = calculateVestedPercentage({
            vestedAmount: vars.unseenVesting.vestedAmountOf(scheduleId),
            depositedAmount: vars.depositedAmount
        });
        vars.vestingModel = "UNCN-VESTING";

        // Generate the SVG.
        vars.svg = NFTSVG.generateSVG(
            NFTSVG.SVGParams({
                accentColor: "#92e603",
                amount: abbreviateAmount({
                    amount: vars.depositedAmount,
                    decimals: 18
                }),
                uncnAddress: vars.uncn.toHexString(),
                uncnSymbol: vars.uncnSymbol,
                duration: calculateDurationInDays({
                    startTime: vars.unseenVesting.getStartTime(scheduleId),
                    endTime: vars.unseenVesting.getEndTime(scheduleId)
                }),
                unseenVestingAddress: vars.unseenVestingAddress,
                progress: stringifyPercentage(vars.vestedPercentage),
                progressNumerical: vars.vestedPercentage,
                status: vars.status,
                vestingModel: vars.vestingModel
            })
        );

        // Generate the JSON metadata.
        vars.json = string.concat(
            '{"attributes":',
            generateAttributes({
                uncnSymbol: vars.uncnSymbol,
                sender: vars.unseenVesting.getSender(scheduleId).toHexString(),
                status: vars.status
            }),
            ',"description":"',
            generateDescription({
                vestingModel: vars.vestingModel,
                uncnSymbol: vars.uncnSymbol,
                scheduleId: scheduleId.toString(),
                unseenVestingAddress: vars.unseenVestingAddress,
                uncnAddress: vars.uncn.toHexString()
            }),
            '","external_url":"https://playunseen.com","name":"',
            generateName({
                vestingModel: vars.vestingModel,
                scheduleId: scheduleId.toString()
            }),
            '","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(vars.svg)),
            '"}'
        );

        // Encode the JSON metadata in Base64.
        uri = string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(vars.json))
        );
    }

    /**
     * @notice Creates an abbreviated representation of the provided amount, rounded down and prefixed with ">= ".
     * @dev The abbreviation uses these suffixes:
     * - "K" for thousands
     * - "M" for millions
     * - "B" for billions
     * - "T" for trillions
     * For example, if the input is 1,234,567, the output is ">= 1.23M".
     * @param amount The amount to abbreviate, denoted in units of `decimals`.
     * @param decimals The number of decimals to assume when abbreviating the amount.
     * @return abbreviation The abbreviated representation of the provided amount, as a string.
     */
    function abbreviateAmount(
        uint256 amount,
        uint256 decimals
    ) internal pure returns (string memory) {
        if (amount == 0) {
            return "0";
        }

        uint256 truncatedAmount;
        unchecked {
            truncatedAmount = decimals == 0 ? amount : amount / 10 ** decimals;
        }

        // Return dummy values when the truncated amount is either very small or very big.
        if (truncatedAmount < 1) {
            return string.concat(SVGElements.SIGN_LT, " 1");
        } else if (truncatedAmount >= 1e15) {
            return string.concat(SVGElements.SIGN_GT, " 999.99T");
        }

        string[5] memory suffixes = ["", "K", "M", "B", "T"];
        uint256 fractionalAmount;
        uint256 suffixIndex = 0;

        // Truncate repeatedly until the amount is less than 1000.
        unchecked {
            while (truncatedAmount >= 1000) {
                fractionalAmount = (truncatedAmount / 10) % 100; // keep the first two digits after the decimal point
                truncatedAmount /= 1000;
                suffixIndex += 1;
            }
        }

        // Concatenate the calculated parts to form the final string.
        string memory prefix = string.concat(SVGElements.SIGN_GE, " ");
        string memory wholePart = truncatedAmount.toString();
        string memory fractionalPart = stringifyFractionalAmount(
            fractionalAmount
        );
        return
            string.concat(
                prefix,
                wholePart,
                fractionalPart,
                suffixes[suffixIndex]
            );
    }

    /**
     * @notice Calculates the schedule's duration in days, rounding down.
     * @param startTime The start time of the schedule.
     * @param endTime The end time of the schedule.
     * @return duration The duration of the schedule in days.
     */
    function calculateDurationInDays(
        uint256 startTime,
        uint256 endTime
    ) internal pure returns (string memory) {
        uint256 durationInDays;
        unchecked {
            durationInDays = (endTime - startTime) / 1 days;
        }

        // Return dummy values when the duration is either very small or very big.
        if (durationInDays == 0) {
            return string.concat(SVGElements.SIGN_LT, " 1 Day");
        } else if (durationInDays > 9999) {
            return string.concat(SVGElements.SIGN_GT, " 9999 Days");
        }

        string memory suffix = durationInDays == 1 ? " Day" : " Days";
        return string.concat(durationInDays.toString(), suffix);
    }

    /**
     * @notice Calculates how much of the deposited amount has been vested so far, as a percentage with 4 implied
     * decimals.
     * @param vestedAmount The amount that has been vested.
     * @param depositedAmount The total amount deposited.
     * @return percentage The vested percentage.
     */
    function calculateVestedPercentage(
        uint128 vestedAmount,
        uint128 depositedAmount
    ) internal pure returns (uint256) {
        // This cannot overflow because both inputs are uint128s, and zero deposit amounts are not allowed in Unseen Vesting.
        unchecked {
            return (vestedAmount * 10_000) / depositedAmount;
        }
    }

    /**
     * @notice Generates an array of JSON objects that represent the NFT's attributes:
     * - Token symbol
     * - Sender address
     * - Status
     * @dev These attributes are useful for filtering and sorting the NFTs.
     * @param uncnSymbol The symbol of the uncn.
     * @param sender The sender's address.
     * @param status The status of the schedule.
     * @return attributes The generated array of JSON objects representing attributes.
     */
    function generateAttributes(
        string memory uncnSymbol,
        string memory sender,
        string memory status
    ) internal pure returns (string memory) {
        return
            string.concat(
                '[{"trait_type":"Token","value":"',
                uncnSymbol,
                '"},{"trait_type":"Sender","value":"',
                sender,
                '"},{"trait_type":"Status","value":"',
                status,
                '"}]'
            );
    }

    /**
     * @notice Generates a string with the NFT's JSON metadata description, which provides a high-level overview.
     * @param vestingModel The model of the vesting contract.
     * @param uncnSymbol The symbol of the vested uncn.
     * @param scheduleId The ID of the vesting schedule.
     * @param unseenVestingAddress The address of the UnseenVesting contract.
     * @param uncnAddress The address of the vested uncn.
     * @return description The generated JSON metadata description.
     */
    function generateDescription(
        string memory vestingModel,
        string memory uncnSymbol,
        string memory scheduleId,
        string memory unseenVestingAddress,
        string memory uncnAddress
    ) internal pure returns (string memory) {
        return
            string.concat(
                "This NFT represents a vesting schedule in Unseen Vesting contract.",
                " The owner of this NFT can withdraw the vested uncn tokens, which are denominated in ",
                uncnSymbol,
                ".\\n\\n- Schedule ID: ",
                scheduleId,
                "\\n- ",
                vestingModel,
                " Address: ",
                unseenVestingAddress,
                "\\n- ",
                uncnSymbol,
                " Address: ",
                uncnAddress,
                "\\n\\n",
                unicode"⚠️ WARNING: Transferring the NFT makes the new owner the recipient of the schedule. The funds are not automatically withdrawn for the previous recipient."
            );
    }

    /**
     * @notice Generates a string with the NFT's JSON metadata name, which is unique for each schedule.
     * @param vestingModel The model of the vesting contract.
     * @param scheduleId The ID of the vesting schedule.
     * @return name The generated JSON metadata name.
     */
    function generateName(
        string memory vestingModel,
        string memory scheduleId
    ) internal pure returns (string memory) {
        return string.concat("Unseen Vesting ", vestingModel, " #", scheduleId);
    }

    /**
     * @notice Converts the provided fractional amount to a string prefixed by a dot.
     * @param fractionalAmount A numerical value with 2 implied decimals.
     * @return The string representation of the fractional amount.
     */
    function stringifyFractionalAmount(
        uint256 fractionalAmount
    ) internal pure returns (string memory) {
        // Return the empty string if the fractional amount is zero.
        if (fractionalAmount == 0) {
            return "";
        }
        // Add a leading zero if the fractional part is less than 10, e.g. for "1", this function returns ".01%".
        else if (fractionalAmount < 10) {
            return string.concat(".0", fractionalAmount.toString());
        }
        // Otherwise, stringify the fractional amount simply.
        else {
            return string.concat(".", fractionalAmount.toString());
        }
    }

    /**
     * @notice Converts the provided percentage to a string.
     * @param percentage A numerical value with 4 implied decimals.
     * @return The string representation of the percentage.
     */
    function stringifyPercentage(
        uint256 percentage
    ) internal pure returns (string memory) {
        // Extract the last two decimals.
        string memory fractionalPart = stringifyFractionalAmount(
            percentage % 100
        );

        // Remove the last two decimals.
        string memory wholePart = (percentage / 100).toString();

        // Concatenate the whole and fractional parts.
        return string.concat(wholePart, fractionalPart, "%");
    }

    /**
     * @notice Retrieves the schedule's status as a string.
     * @param status The status of the schedule.
     * @return The string representation of the schedule's status.
     */
    function stringifyStatus(
        Lockup.Status status
    ) internal pure returns (string memory) {
        if (status == Lockup.Status.DEPLETED) {
            return "Depleted";
        } else if (status == Lockup.Status.CANCELED) {
            return "Canceled";
        } else if (status == Lockup.Status.ONGOING) {
            return "Ongoing";
        } else if (status == Lockup.Status.SETTLED) {
            return "Settled";
        } else {
            return "Pending";
        }
    }
}

/*

$$\   $$\                                                   
$$ |  $$ |                                                  
$$ |  $$ |$$$$$$$\   $$$$$$$\  $$$$$$\   $$$$$$\  $$$$$$$\  
$$ |  $$ |$$  __$$\ $$  _____|$$  __$$\ $$  __$$\ $$  __$$\ 
$$ |  $$ |$$ |  $$ |\$$$$$$\  $$$$$$$$ |$$$$$$$$ |$$ |  $$ |
$$ |  $$ |$$ |  $$ | \____$$\ $$   ____|$$   ____|$$ |  $$ |
\$$$$$$  |$$ |  $$ |$$$$$$$  |\$$$$$$$\ \$$$$$$$\ $$ |  $$ |
 \______/ \__|  \__|\_______/  \_______| \_______|\__|  \__| 
                            
*/
