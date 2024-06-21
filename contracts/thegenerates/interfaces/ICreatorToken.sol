// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface ICreatorToken {
    function getTransferValidator() external view returns (address validator);

    function getTransferValidationFunction()
        external
        view
        returns (bytes4 functionSignature, bool isViewFunction);

    function setTransferValidator(address validator) external;
}
