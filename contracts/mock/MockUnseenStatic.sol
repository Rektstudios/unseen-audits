// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { ArrayUtils } from "../lib/ArrayUtils.sol";
import { AuthenticatedProxy } from "../marketplace/registry/AuthenticatedProxy.sol";

/**
 * @title MockUnseenStatic
 * @author decapitator (0xdecapitator.eth)
 * @notice Static call functions
 * @dev   This contract is intended solely for use in testing
 *        environments. It includes functionality that may be used
 *        to simulate future features or to facilitate the testing
 *        process. This contract is not intended for deployment
 *        on any production environment. The functions and features
 *        provided within this contract are for testing purposes
 *        only and may not adhere  to best practices or security
 *        standards required for live deployment.
 *
 *      DISCLAIMER:
 *      1. This contract is for testing and development purposes only.
 *      2. Do not deploy this contract on the mainnet or any live network.
 *      3. The functionality in this contract may include unfinished features, experimental code,
 *         or functions specifically designed to assist in the testing process.
 *
 */
contract MockUnseenStatic {
    string public constant NAME = "Mock Unseen Static";

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
    string constant ERR_PFEE_RECIPIENT_MISMATCH = "Fee Recipient mismatch";
    string constant ERR_PFEE_AMOUNT_MISMATCH = "Fee amount mismatch";
    string constant ERR_ERC20_ADDRESSES_MISMATCH = "assets mismatch";

    /**
     * @notice Constructor
     * @param _atomicizer Address of the atomicizer contract
     */
    constructor(address _atomicizer) payable {
        if (_atomicizer == address(0)) {
            revert("Atomicizer cannot be 0");
        }
        atomicizer = _atomicizer;
    }

    function anyERC1155ForERC20(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[3] memory tokenIdAndNumeratorDenominator
        ) = abi.decode(extra, (address[2], uint256[3]));

        require(tokenIdAndNumeratorDenominator[1] != 0, ERR_INVALID_NUMERATOR);
        require(
            tokenIdAndNumeratorDenominator[2] != 0,
            ERR_INVALID_DENOMINATOR
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        uint256[2] memory call_amounts = [
            getERC1155AmountFromCalldata(data),
            getERC20AmountFromCalldata(counterdata)
        ];
        uint256 new_fill = (uints[2] + call_amounts[0]);
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);
        require(
            tokenIdAndNumeratorDenominator[1] * call_amounts[1] ==
                tokenIdAndNumeratorDenominator[2] * call_amounts[0],
            ERR_WRONG_RATIO
        );
        checkERC1155Side(
            data,
            addresses[1],
            addresses[4],
            tokenIdAndNumeratorDenominator[0],
            call_amounts[0]
        );
        checkERC20Side(
            counterdata,
            addresses[4],
            addresses[1],
            call_amounts[1]
        );
        return new_fill;
    }

    function anyERC20ForERC1155(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[3] memory tokenIdAndNumeratorDenominator
        ) = abi.decode(extra, (address[2], uint256[3]));

        require(tokenIdAndNumeratorDenominator[1] != 0, ERR_INVALID_NUMERATOR);
        require(
            tokenIdAndNumeratorDenominator[2] != 0,
            ERR_INVALID_DENOMINATOR
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        uint256[2] memory call_amounts = [
            getERC1155AmountFromCalldata(counterdata),
            getERC20AmountFromCalldata(data)
        ];
        uint256 new_fill = uints[2] + call_amounts[1];
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);
        require(
            tokenIdAndNumeratorDenominator[1] * call_amounts[0] ==
                tokenIdAndNumeratorDenominator[2] * call_amounts[1],
            ERR_WRONG_RATIO
        );
        checkERC1155Side(
            counterdata,
            addresses[4],
            addresses[1],
            tokenIdAndNumeratorDenominator[0],
            call_amounts[0]
        );
        checkERC20Side(data, addresses[1], addresses[4], call_amounts[1]);
        return new_fill;
    }

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
            require(
                tokenGiveGet[2] == addresses[6],
                ERR_PFEE_RECIPIENT_MISMATCH
            );
            require(
                tokenIdAndNumeratorDenominator[4] == (uints[0] * sum) / 10_000,
                ERR_PFEE_AMOUNT_MISMATCH
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
            require(
                tokenGiveGet[2] == addresses[6],
                ERR_PFEE_RECIPIENT_MISMATCH
            );
            require(
                tokenIdAndNumeratorDenominator[4] == (uints[0] * sum) / 10_000,
                ERR_PFEE_AMOUNT_MISMATCH
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

    function LazyERC1155ForERC20(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[3] memory tokenIdAndNumeratorDenominator,
            bytes memory extraBytes
        ) = abi.decode(extra, (address[2], uint256[3], bytes));

        require(tokenIdAndNumeratorDenominator[1] != 0, ERR_INVALID_NUMERATOR);
        require(
            tokenIdAndNumeratorDenominator[2] != 0,
            ERR_INVALID_DENOMINATOR
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        uint256[2] memory call_amounts = [
            abi.decode(ArrayUtils.arraySlice(data, 68, 32), (uint256)),
            getERC20AmountFromCalldata(counterdata)
        ];
        uint256 new_fill = uints[2] + call_amounts[0];
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);
        require(
            tokenIdAndNumeratorDenominator[1] * call_amounts[1] ==
                tokenIdAndNumeratorDenominator[2] * call_amounts[0],
            ERR_WRONG_RATIO
        );
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "mint(address,uint256,uint256,bytes)",
                    addresses[4],
                    tokenIdAndNumeratorDenominator[0],
                    call_amounts[0],
                    extraBytes
                )
            )
        );
        require(
            ArrayUtils.arrayEq(
                counterdata,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    addresses[4],
                    addresses[1],
                    call_amounts[1]
                )
            )
        );
        return new_fill;
    }

    function LazyERC20ForERC1155(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[3] memory tokenIdAndNumeratorDenominator,
            bytes memory extraBytes
        ) = abi.decode(extra, (address[2], uint256[3], bytes));

        require(tokenIdAndNumeratorDenominator[1] != 0, ERR_INVALID_NUMERATOR);
        require(
            tokenIdAndNumeratorDenominator[2] != 0,
            ERR_INVALID_DENOMINATOR
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        uint256[2] memory call_amounts = [
            abi.decode(ArrayUtils.arraySlice(counterdata, 68, 32), (uint256)),
            getERC20AmountFromCalldata(data)
        ];
        uint256 new_fill = uints[2] + call_amounts[1];
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);
        require(
            tokenIdAndNumeratorDenominator[1] * call_amounts[0] ==
                tokenIdAndNumeratorDenominator[2] * call_amounts[1],
            ERR_WRONG_RATIO
        );
        require(
            ArrayUtils.arrayEq(
                counterdata,
                abi.encodeWithSignature(
                    "mint(address,uint256,uint256,bytes)",
                    addresses[1],
                    tokenIdAndNumeratorDenominator[0],
                    call_amounts[0],
                    extraBytes
                )
            )
        );
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    addresses[1],
                    addresses[4],
                    call_amounts[1]
                )
            )
        );
        return new_fill;
    }

    function anyERC20ForERC20(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory uints,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[2] memory numeratorDenominator
        ) = abi.decode(extra, (address[2], uint256[2]));

        require(numeratorDenominator[0] != 0, ERR_INVALID_NUMERATOR);
        require(numeratorDenominator[1] != 0, ERR_INVALID_DENOMINATOR);
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        uint256[2] memory call_amounts = [
            getERC20AmountFromCalldata(data),
            getERC20AmountFromCalldata(counterdata)
        ];
        uint256 new_fill = uints[2] + call_amounts[0];
        require(new_fill <= uints[1], ERR_EXCEEDS_MAX_FILL);
        require(
            numeratorDenominator[0] * call_amounts[0] ==
                numeratorDenominator[1] * call_amounts[1],
            ERR_WRONG_RATIO
        );
        checkERC20Side(data, addresses[1], addresses[4], call_amounts[0]);
        checkERC20Side(
            counterdata,
            addresses[4],
            addresses[1],
            call_amounts[1]
        );

        return new_fill;
    }

    function anyNFTForNFT(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory,
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

    function ERC721ForERC20(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[2] memory tokenIdAndPrice
        ) = abi.decode(extra, (address[2], uint256[2]));

        require(
            tokenIdAndPrice[1] != 0,
            "ERC721ForERC20: ERC721 price must be larger than zero"
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        checkERC721Side(data, addresses[1], addresses[4], tokenIdAndPrice[0]);
        checkERC20Side(
            counterdata,
            addresses[4],
            addresses[1],
            tokenIdAndPrice[1]
        );

        return 1;
    }

    function ERC20ForERC721(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[2] memory tokenIdAndPrice
        ) = abi.decode(extra, (address[2], uint256[2]));

        require(
            tokenIdAndPrice[1] != 0,
            "ERC20ForERC721: ERC721 price must be larger than zero"
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);

        checkERC721Side(
            counterdata,
            addresses[4],
            addresses[1],
            tokenIdAndPrice[0]
        );
        checkERC20Side(data, addresses[1], addresses[4], tokenIdAndPrice[1]);

        return 1;
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
            require(
                tokenGiveGet[2] == addresses[6],
                ERR_PFEE_RECIPIENT_MISMATCH
            );
            require(
                tokenIdAndPrice[3] == (uints[0] * sum) / 10_000,
                ERR_PFEE_AMOUNT_MISMATCH
            );
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
            require(
                tokenGiveGet[2] == addresses[6],
                ERR_PFEE_RECIPIENT_MISMATCH
            );
            require(
                tokenIdAndPrice[3] == (uints[0] * sum) / 10_000,
                ERR_PFEE_AMOUNT_MISMATCH
            );
        }
        checkERC721Side(
            counterdata,
            addresses[4],
            addresses[1],
            tokenIdAndPrice[0]
        );
        return sum;
    }

    function LazyERC721ForERC20(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );
        (
            address[2] memory tokenGiveGet,
            uint256[2] memory tokenIdAndPrice,
            bytes memory extraBytes
        ) = abi.decode(extra, (address[2], uint256[2], bytes));

        require(
            tokenIdAndPrice[1] != 0,
            "LazyERC721ForERC20: ERC721 price must be larger than zero"
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "mint(address,uint256,bytes)",
                    addresses[4],
                    tokenIdAndPrice[0],
                    extraBytes
                )
            )
        );
        require(
            ArrayUtils.arrayEq(
                counterdata,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    addresses[4],
                    addresses[1],
                    tokenIdAndPrice[1]
                )
            )
        );
        return 1;
    }

    function LazyERC20ForERC721(
        bytes memory extra,
        address[7] memory addresses,
        AuthenticatedProxy.HowToCall[2] memory howToCalls,
        uint256[3] memory,
        bytes memory data,
        bytes memory counterdata
    ) public pure returns (uint256) {
        require(
            howToCalls[0] == AuthenticatedProxy.HowToCall.Call,
            ERR_CALL_DIRECT
        );

        (
            address[2] memory tokenGiveGet,
            uint256[2] memory tokenIdAndPrice,
            bytes memory extraBytes
        ) = abi.decode(extra, (address[2], uint256[2], bytes));

        require(
            tokenIdAndPrice[1] != 0,
            "LazyERC20ForERC721: ERC721 price must be larger than zero"
        );
        require(addresses[2] == tokenGiveGet[0], ERR_INVALID_TARGET);
        require(addresses[5] == tokenGiveGet[1], ERR_INVALID_TARGET);
        require(
            ArrayUtils.arrayEq(
                counterdata,
                abi.encodeWithSignature(
                    "mint(address,uint256,bytes)",
                    addresses[1],
                    tokenIdAndPrice[0],
                    extraBytes
                )
            )
        );
        require(
            ArrayUtils.arrayEq(
                data,
                abi.encodeWithSignature(
                    "transferFrom(address,address,uint256)",
                    addresses[1],
                    addresses[4],
                    tokenIdAndPrice[1]
                )
            )
        );
        return 1;
    }

    function noChecks(
        bytes memory,
        address[7] memory,
        AuthenticatedProxy.HowToCall[2] memory,
        uint256[3] memory,
        bytes memory,
        bytes memory
    ) public pure returns (uint256) {
        return 1;
    }

    function noChecks() public pure returns (uint8) {
        return 1;
    }

    // internal helper functions
    function getERC1155AmountFromCalldata(
        bytes memory data
    ) internal pure returns (uint256) {
        uint256 amount = abi.decode(
            ArrayUtils.arraySlice(data, 100, 32),
            (uint256)
        );
        return amount;
    }

    function getERC20AmountFromCalldata(
        bytes memory data
    ) internal pure returns (uint256) {
        uint256 amount = abi.decode(
            ArrayUtils.arraySlice(data, 68, 32),
            (uint256)
        );
        return amount;
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
        (address[] memory addrs, bytes[] memory calldatas) = abi.decode(
            data[4:],
            (address[], bytes[])
        );
        uint256 addrsLength = addrs.length;
        for (uint256 i; i < addrsLength; ) {
            require(asset == addrs[i], ERR_ERC20_ADDRESSES_MISMATCH);
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
