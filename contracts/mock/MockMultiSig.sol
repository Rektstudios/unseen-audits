// SPDX-License-Identifier: MIT

pragma solidity ^0.8.26;

/**
 *  @title  Mock MultiSigWallet
 * @author  decapitator (0xdecapitator.eth)
 *  @notice Mock MultiSigWallet for testing purposes
 *
 */
contract MultiSigWallet {
    /* Emitted when a deposit is made */
    event Deposit(address indexed sender, uint256 amount, uint256 balance);

    /* Emitted when a transaction is submitted */
    event SubmitTransaction(
        address indexed owner,
        uint256 indexed txIndex,
        address indexed to,
        uint256 value,
        bytes data
    );

    /* Emitted when a transaction is confirmed by an owner */
    event ConfirmTransaction(address indexed owner, uint256 indexed txIndex);

    /* Emitted when a transaction is revoked by an owner */
    event RevokeConfirmation(address indexed owner, uint256 indexed txIndex);

    /* Emitted when a transaction is executed */
    event ExecuteTransaction(address indexed owner, uint256 indexed txIndex);

    /* List of owners */
    address[] public owners;

    /* Mapping of addresses to wether they are owners or not */
    mapping(address => bool) public isOwner;

    /* Number of confirmations required in order for a tx to be executed */
    uint256 public numConfirmationsRequired;

    /* Transaction struct */
    struct Transaction {
        /* Recipient address */
        address to;
        /* Amount of wei to send */
        uint256 value;
        /* Transaction data payload */
        bytes data;
        /* Whether the transaction has been executed or not */
        bool executed;
        /* Number of confirmations */
        uint256 numConfirmations;
    }

    /* Mapping tx index to owner address to wether he confirmed or not */
    mapping(uint256 => mapping(address => bool)) public isConfirmed;

    /* List of transactions */
    Transaction[] public transactions;

    /* If caller is owner */
    modifier onlyOwner() {
        require(isOwner[msg.sender], "Unseen: Not owner");
        _;
    }

    /* If tx exists */
    modifier txExists(uint256 _txIndex) {
        require(_txIndex < transactions.length, "Unseen: Tx does not exist");
        _;
    }

    /* If tx has not been executed */
    modifier notExecuted(uint256 _txIndex) {
        require(
            !transactions[_txIndex].executed,
            "Unseen: Tx already executed"
        );
        _;
    }

    /* If tx has not been confirmed */
    modifier notConfirmed(uint256 _txIndex) {
        require(
            !isConfirmed[_txIndex][msg.sender],
            "Unseen: Tx already confirmed"
        );
        _;
    }

    /**
     * @notice Constructor
     * @param _owners Owners of the wallet
     * @param _numConfirmationsRequired Number of confirmations required
     *
     */
    constructor(address[] memory _owners, uint256 _numConfirmationsRequired) {
        uint256 ownersLength = _owners.length;
        require(ownersLength > 0, "Unseen: Owners required");
        require(
            _numConfirmationsRequired > 0 &&
                _numConfirmationsRequired <= ownersLength,
            "invalid number of required confirmations"
        );
        for (uint256 i; i < ownersLength; ) {
            address owner = _owners[i];
            require(owner != address(0), "Unseen: Invalid owner");
            require(!isOwner[owner], "Unseen: Owner not unique");
            isOwner[owner] = true;
            owners.push(owner);
            unchecked {
                ++i;
            }
        }

        numConfirmationsRequired = _numConfirmationsRequired;
    }

    /**
     * @notice Fallback function
     *
     */
    receive() external payable {
        emit Deposit(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @notice Submit a transaction
     * @param _to Recipient address
     * @param _value Amount of wei to send
     * @param _data Transaction data payload
     *
     */
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data
    ) external onlyOwner {
        uint256 txIndex = transactions.length;

        transactions.push(
            Transaction({
                to: _to,
                value: _value,
                data: _data,
                executed: false,
                numConfirmations: 0
            })
        );

        emit SubmitTransaction(msg.sender, txIndex, _to, _value, _data);
    }

    /**
     * Confirm a transaction
     * @param _txIndex Transaction index
     */
    function confirmTransaction(
        uint256 _txIndex
    )
        external
        onlyOwner
        txExists(_txIndex)
        notExecuted(_txIndex)
        notConfirmed(_txIndex)
    {
        Transaction storage transaction = transactions[_txIndex];
        transaction.numConfirmations += 1;
        isConfirmed[_txIndex][msg.sender] = true;

        emit ConfirmTransaction(msg.sender, _txIndex);
    }

    function executeTransaction(
        uint256 _txIndex
    ) external onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(
            transaction.numConfirmations >= numConfirmationsRequired,
            "Unseen: Cannot execute tx"
        );

        transaction.executed = true;

        (bool success, ) = transaction.to.call{ value: transaction.value }(
            transaction.data
        );
        require(success, "Unseen: Tx failed");

        emit ExecuteTransaction(msg.sender, _txIndex);
    }

    /**
     * Revoke a confirmation for a transaction
     * @param _txIndex Transaction index
     */
    function revokeConfirmation(
        uint256 _txIndex
    ) external onlyOwner txExists(_txIndex) notExecuted(_txIndex) {
        Transaction storage transaction = transactions[_txIndex];

        require(isConfirmed[_txIndex][msg.sender], "Unseen: Tx not confirmed");

        transaction.numConfirmations -= 1;
        isConfirmed[_txIndex][msg.sender] = false;

        emit RevokeConfirmation(msg.sender, _txIndex);
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getTransactionCount() external view returns (uint256) {
        return transactions.length;
    }

    /**
     * @notice Get a transaction
     * @param _txIndex Transaction index
     *
     */
    function getTransaction(
        uint256 _txIndex
    )
        external
        view
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 numConfirmations
        )
    {
        Transaction storage transaction = transactions[_txIndex];

        return (
            transaction.to,
            transaction.value,
            transaction.data,
            transaction.executed,
            transaction.numConfirmations
        );
    }
}
