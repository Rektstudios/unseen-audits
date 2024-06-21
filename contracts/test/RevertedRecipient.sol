// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

contract RevertedRecipient {
    error CannotAcceptEther();

    receive() external payable {
        revert CannotAcceptEther();
    }
}
