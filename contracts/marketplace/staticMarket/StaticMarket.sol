// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

import { ArrayUtils } from "../../lib/ArrayUtils.sol";
import { AuthenticatedProxy } from "../registry/AuthenticatedProxy.sol";

/**
 * @title  StaticMarket
 * @author decapitator (0xdecapitator.eth)
 * @dev    Each function here has the same parameters:
 * addresses an array of addresses, with each corresponding to the following:
 * 		[0] order registry
 * 		[1] order maker
 * 		[2] call target
 * 		[3] counterorder registry
 * 		[4] counterorder maker
 * 		[5] countercall target
 * 		[6] matcher
 * howToCalls an array of enums: { Call | DelegateCall }
 * 		[0] for the call
 * 		[1] for the countercall
 * uints an array of 6 uints corresponding to the following:
 * 		[0] value (eth value)
 * 		[1] call max fill
 * 		[2] order listing time
 * 		[3] order expiration time
 * 		[4] counterorder listing time
 * 		[5] previous fill
 * data The data that you pass into the proxied function call.
 *      The static calls verify that the order placed actually
 *      matches up with the memory passed to the proxied call
 * counterdata Same as data but for the countercall
 */
contract StaticMarket {
    address public immutable atomicizer;

    // Error messages
    string constant ERR_CALL_DIRECT = "Call must be a direct call";
    string constant ERR_INVALID_NUMERATOR =
        "Numerator must be larger than zero";
    string constant ERR_INVALID_DENOMINATOR =
        "Denominator must be larger than zero";
    string constant ERR_INVALID_TARGET = "Call target mismatch";
    string constant ERR_EXCEEDS_MAX_FILL = "New fill exceeds maximum fill";
    string constant ERR_WRONG_RATIO = "Incorrect token ratio";
    string constant ERR_PRICE_MISMATCH = "Price mismatch";

    function anyERC1155ForMultiERC20(
        bytes calldata extra,
        address[7] calldata addresses,
        AuthenticatedProxy.HowToCall[2] calldata howToCalls,
        uint256[3] calldata uints,
        bytes calldata data,
        bytes calldata counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );
        (
            address[] memory tokenGiveGet,
            uint256[] memory tokenIdAndNumeratorDenominator
        ) = abi.decode(extra, (address[], uint256[]));
        require(tokenIdAndNumeratorDenominator[1] != 0, ERR_INVALID_NUMERATOR);
        require(
            tokenIdAndNumeratorDenominator[2] != 0,
            ERR_INVALID_DENOMINATOR
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        uint256 erc1155Amount = getERC1155AmountFromCalldata(data);
        uint256 sum = validateERC20DataFromCalls(
            counterdata,
            abi.encode(addresses[1], addresses[4], tokenGiveGet[1]),
            tokenGiveGet,
            tokenIdAndNumeratorDenominator,
            3
        );
        if (uints[0] > 0) {
            require(tokenGiveGet[2] == addresses[6], "");
            require(
                tokenIdAndNumeratorDenominator[4] == (uints[0] * sum) / 10_000,
                ""
            );
        }
        uint256 new_fill = (uints[2] + erc1155Amount);
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);
        require(
            tokenIdAndNumeratorDenominator[1] * sum ==
                tokenIdAndNumeratorDenominator[2] * erc1155Amount,
            ERR_WRONG_RATIO
        );
        checkERC1155Side(
            data,
            addresses[1],
            addresses[4],
            tokenIdAndNumeratorDenominator[0],
            erc1155Amount
        );

        return new_fill;
    }

    function anyMultiERC20ForERC1155(
        bytes calldata extra,
        address[7] calldata addresses,
        AuthenticatedProxy.HowToCall[2] calldata howToCalls,
        uint256[3] calldata uints,
        bytes calldata data,
        bytes calldata counterdata
    ) public view returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.DelegateCall,
            ERR_CALL_DIRECT
        );
        (
            address[] memory tokenGiveGet,
            uint256[] memory tokenIdAndNumeratorDenominator
        ) = abi.decode(extra, (address[], uint256[]));
        require(tokenIdAndNumeratorDenominator[1] != 0, ERR_INVALID_NUMERATOR);
        require(
            tokenIdAndNumeratorDenominator[2] != 0,
            ERR_INVALID_DENOMINATOR
        );
        require(addresses[2] == atomicizer, ERR_INVALID_TARGET);
        uint256 erc1155Amount = getERC1155AmountFromCalldata(counterdata);
        uint256 sum = validateERC20DataFromCalls(
            data,
            abi.encode(addresses[4], addresses[1], tokenGiveGet[0]),
            tokenGiveGet,
            tokenIdAndNumeratorDenominator,
            3
        );
        if (uints[0] > 0) {
            require(tokenGiveGet[2] == addresses[6], "");
            require(
                tokenIdAndNumeratorDenominator[4] == (uints[0] * sum) / 10_000,
                ""
            );
        }
        uint256 new_fill = (uints[2] + sum);
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);

        require(
            tokenIdAndNumeratorDenominator[1] * erc1155Amount ==
                tokenIdAndNumeratorDenominator[2] * sum,
            ERR_WRONG_RATIO
        );
        checkERC1155Side(
            counterdata,
            addresses[4],
            addresses[1],
            tokenIdAndNumeratorDenominator[0],
            erc1155Amount
        );
        return new_fill;
    }

    function anyNFTForNFT(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[6] memory,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );
        (
            address[2] memory tokenGiveGet,
            uint256[4] memory tokenIdGiveGet,
            bytes1[2] memory tokenType
        ) = abi.decode(extra, (address[2], uint256[4], bytes1[2]));
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);
        if (tokenType[0] == 0x00) {
            checkERC721Side(
                data,
                addresses[1],
                addresses[4],
                tokenIdGiveGet[0]
            );
        } else {
            checkERC1155Side(
                data,
                addresses[1],
                addresses[4],
                tokenIdGiveGet[0],
                tokenIdGiveGet[1]
            );
        }
        if (tokenType[1] == 0x00) {
            checkERC721Side(
                counterdata,
                addresses[4],
                addresses[1],
                tokenIdGiveGet[2]
            );
        } else {
            checkERC1155Side(
                counterdata,
                addresses[4],
                addresses[1],
                tokenIdGiveGet[2],
                tokenIdGiveGet[3]
            );
        }
        return tokenIdGiveGet[1];
    }

    function ERC721ForMultiERC20(
        bytes calldata extra,
        address[7] calldata addresses,
        AuthenticatedProxy.HowToCall[2] calldata howToCalls,
        uint256[3] calldata uints,
        bytes calldata data,
        bytes calldata counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );
        (address[] memory tokenGiveGet, uint256[] memory tokenIdAndPrice) = abi
            .decode(extra, (address[], uint256[]));

        require(tokenIdAndPrice[1] != 0, ERR_INVALID_NUMERATOR);
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        uint256 sum = validateERC20DataFromCalls(
            counterdata,
            abi.encode(addresses[1], addresses[4], tokenGiveGet[1]),
            tokenGiveGet,
            tokenIdAndPrice,
            2
        );
        if (uints[0] > 0) {
            require(tokenGiveGet[2] == addresses[6], "");
            require(tokenIdAndPrice[3] == (uints[0] * sum) / 10_000, "");
        }
        require(tokenIdAndPrice[1] == sum, ERR_PRICE_MISMATCH);
        checkERC721Side(data, addresses[1], addresses[4], tokenIdAndPrice[0]);
        return 1;
    }

    function MultiERC20ForERC721(
        bytes calldata extra,
        address[7] calldata addresses,
        AuthenticatedProxy.HowToCall[2] calldata howToCalls,
        uint256[3] calldata uints,
        bytes calldata data,
        bytes calldata counterdata
    ) public view returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.DelegateCall,
            ERR_CALL_DIRECT
        );
        (address[] memory tokenGiveGet, uint256[] memory tokenIdAndPrice) = abi
            .decode(extra, (address[], uint256[]));

        require(tokenIdAndPrice[1] != 0, ERR_INVALID_NUMERATOR);
        require(addresses[2] == atomicizer, ERR_INVALID_TARGET);
        uint256 sum = validateERC20DataFromCalls(
            data,
            abi.encode(addresses[4], addresses[1], tokenGiveGet[0]),
            tokenGiveGet,
            tokenIdAndPrice,
            2
        );
        if (uints[0] > 0) {
            require(tokenGiveGet[2] == addresses[6], "");
            require(tokenIdAndPrice[3] == (uints[0] * sum) / 10_000, "");
        }
        checkERC721Side(
            counterdata,
            addresses[4],
            addresses[1],
            tokenIdAndPrice[0]
        );
        return sum;
    }

    function getERC1155AmountFromCalldata(
        bytes memory data
    ) internal pure returns (uint256) {
        return abi.decode(ArrayUtils.arraySlice(data, 100, 32), (uint256));
    }

    function getERC20AmountFromCalldata(
        bytes memory data
    ) internal pure returns (uint256) {
        return abi.decode(ArrayUtils.arraySlice(data, 68, 32), (uint256));
    }

    function validateERC20DataFromCalls(
        bytes calldata data,
        bytes memory _addrs,
        address[] memory tokenGiveGet,
        uint256[] memory tokenIdAndValues,
        uint256 offset
    ) internal pure returns (uint256 sum) {
        (address maker, address taker, address asset) = abi.decode(
            _addrs,
            (address, address, address)
        );
        (address[] memory addrs, , bytes[] memory calldatas) = abi.decode(
            data[4:],
            (address[], uint256[], bytes[])
        );
        uint256 addrsLength = addrs.length;
        for (uint256 i; i < addrsLength; ) {
            require(asset == addrs[i], "");
            checkERC20Side(
                calldatas[i],
                taker,
                i == 0 ? maker : tokenGiveGet[i + 1],
                tokenIdAndValues[i + offset]
            );
            sum += getERC20AmountFromCalldata(calldatas[i]);
            unchecked {
                ++i;
            }
        }
    }

    function checkERC1155Side(
        bytes memory data,
        address from,
        address to,
        uint256 tokenId,
        uint256 amount
    ) internal pure {
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "safeTransferFrom(address,address,uint256,uint256,bytes)",
                    from,
                    to,
                    tokenId,
                    amount,
                    ""
                )
            ),
            "ERC1155 transfer failed"
        );
    }

    function checkERC721Side(
        bytes memory data,
        address from,
        address to,
        uint256 tokenId
    ) internal pure {
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    from,
                    to,
                    tokenId
                )
            ),
            "ERC721 transfer failed"
        );
    }

    function checkERC20Side(
        bytes memory data,
        address from,
        address to,
        uint256 amount
    ) internal pure {
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    from,
                    to,
                    amount
                )
            ),
            "ERC20 transfer failed"
        );
    }
}
