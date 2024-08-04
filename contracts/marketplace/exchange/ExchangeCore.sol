// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "solady/src/auth/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { AuthenticatedProxy } from "../registry/AuthenticatedProxy.sol";
import { ProxyRegistryInterface } from "../registry/ProxyRegistryInterface.sol";
import { StaticCaller } from "../../lib/StaticCaller.sol";
import { ERC1271 } from "../../lib/ERC1271.sol";
import { ERC1271Mod } from "../../lib/ERC1271Mod.sol";
import { MarketErrorsAndEvents } from "../lib/MarketErrorsAndEvents.sol";

/**
 * @title  ExchangeCore
 * @author decapitator (0xdecapitator.eth)
 * @notice ExchangeCore contract
 */
contract ExchangeCore is
    ReentrancyGuard,
    MarketErrorsAndEvents,
    StaticCaller,
    EIP712("Unseen Marketplace", "1.0.0"),
    Ownable
{
    bytes4 internal constant EIP_1271_MAGICVALUE = 0x20c13b0b;
    bytes4 internal constant EIP_1271MOD_MAGICVALUE = 0x89971e76;
    bytes internal constant personalSignPrefix =
        "\x19Ethereum Signed Message:\n";

    /* An order, convenience struct. */
    struct Order {
        /* Order registry address. */
        address registry;
        /* Order maker address. */
        address maker;
        /* Order target address. */
        address executer;
        /* Order static target. */
        address staticTarget;
        /* Order static selector. */
        bytes4 staticSelector;
        /* Order static extradata. */
        bytes staticExtradata;
        /* Order maximum fill factor. */
        uint256 maximumFill;
        // Bits Layout:
        // - [0..63]   `listingTime`
        // - [64..127] `expirationTime`
        // - [128..256] `salt`
        uint256 extraData;
    }

    /* A call, convenience struct. */
    struct Call {
        /* Target */
        address target;
        /* How to call */
        AuthenticatedProxy.HowToCall howToCall;
        /* Calldata */
        bytes data;
    }

    ///@notice Order typehash for EIP 712 compatibility
    bytes32 public constant ORDER_TYPEHASH =
        0x709b7f364670296379eaf40893373ab9cbd874ee9877905b04e7b97181a7f6b5;

    ///@notice Unseen protocol fees
    uint256 public pFee;

    ///@notice Recipient of protocol fees
    address public protocolFeeRecipient;

    ///@notice Trusted proxy registry contracts
    mapping(address => bool) public registries;

    ///@notice Order fill status, by maker address then by hash
    mapping(address => mapping(bytes32 => uint256)) public fills;

    /* Orders verified by on-chain approval.
       Alternative to ECDSA signatures so that smart contracts can place orders directly.
       By maker address, then by hash. */
    mapping(address => mapping(bytes32 => bool)) public approved;

    /**
     * @notice constructor
     *
     */
    constructor() payable {}

    /**
     * @notice function to hash orders
     * @param order order struct to be hashed
     *
     */
    function hashOrder(
        Order memory order
    ) internal pure returns (bytes32 hash) {
        /* Per EIP 712. */
        return
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.registry,
                    order.maker,
                    order.executer,
                    order.staticTarget,
                    order.staticSelector,
                    keccak256(order.staticExtradata),
                    order.maximumFill,
                    order.extraData
                )
            );
    }

    /**
     * @notice receive hashed order and returns hash that has to be signed
     * @param orderHash hashed order to be signed
     *
     */
    function hashToSign(bytes32 orderHash) public view returns (bytes32 hash) {
        ///@notice Calculate the string a user must sign.
        return _hashTypedDataV4(orderHash);
    }

    /**
     * @param _contract the address to be tested for existance
     * @return if the address exists
     *
     */
    function exists(address _contract) internal view returns (bool) {
        uint256 size;
        assembly {
            /* solium-disable-line */
            size := extcodesize(_contract)
        }
        return size != 0;
    }

    /**
     * @notice validation of order through its parameters (listing time, completely filled, static target existence)
     * @param order order object to be checked if it's an order valid struct
     * @param hash order hashed in order to validate
     *
     */
    function validateOrderParameters(
        Order memory order,
        bytes32 hash
    ) internal view returns (bool) {
        /* Order must be listed and not be expired. */
        if (uint64(order.extraData) > block.timestamp) {
            /* solium-disable-line */
            return false;
        }
        if (uint64(order.extraData >> 64) != 0) {
            if (uint64(order.extraData >> 64) <= block.timestamp) {
                /* solium-disable-line */
                return false;
            }
        }
        /* Order must not have already been completely filled. */
        if (fills[order.maker][hash] >= order.maximumFill) {
            return false;
        }

        /* Order static target must exist. */
        if (!exists(order.staticTarget)) {
            return false;
        }
        return true;
    }

    /**
     * @notice validate if maker signed the order hash
     * @param hash order hash
     * @param signature maker order signature
     *
     */
    function validateOrderAuthorization(
        bytes32 hash,
        address maker,
        bytes memory signature,
        bytes memory callData
    ) public view returns (bool) {
        /* Memorized authentication. If order has already been partially filled, order must be authenticated. */
        if (fills[maker][hash] != 0) {
            return true;
        }
        /* Order authentication. Order must be either: */

        /* (a): sent by maker */
        if (maker == msg.sender) {
            return true;
        }

        /* (b): previously approved */
        if (approved[maker][hash]) {
            return true;
        }

        /* Calculate hash which must be signed. */
        bytes32 calculatedHashToSign = hashToSign(hash);

        /* Determine whether signer / maker is a contract or account. */
        bool isContract = exists(maker);

        /* (c): Contract-only authentication: EIP/ERC 1271. */
        if (isContract) {
            try
                ERC1271Mod(maker).isValidSignature(
                    abi.encodePacked(calculatedHashToSign),
                    signature,
                    callData
                )
            returns (bytes4 magicValue) {
                return magicValue == EIP_1271MOD_MAGICVALUE;
            } catch {
                try
                    ERC1271(maker).isValidSignature(
                        abi.encodePacked(calculatedHashToSign),
                        signature
                    )
                returns (bytes4 magicValue) {
                    return magicValue == EIP_1271_MAGICVALUE;
                } catch {
                    return false;
                }
            }
        }

        /* (d): Account-only authentication: ECDSA-signed by maker. */
        (uint8 v, bytes32 r, bytes32 s) = abi.decode(
            signature,
            (uint8, bytes32, bytes32)
        );

        if (signature.length > 65 && signature[signature.length - 1] == 0x03) {
            // EthSign byte
            /* (d.1): Old way: order hash signed by maker using the prefixed personal_sign */
            if (
                ecrecover(
                    keccak256(
                        abi.encodePacked(
                            personalSignPrefix,
                            "32",
                            calculatedHashToSign
                        )
                    ),
                    v,
                    r,
                    s
                ) == maker
            ) {
                return true;
            }
        }
        /* (d.2): New way: order hash signed by maker using sign_typed_data */
        else if (ecrecover(calculatedHashToSign, v, r, s) == maker) {
            return true;
        }
        return false;
    }

    /**
     * @notice encode static calls data and params
     * @param order first order data
     * @param call first order call
     * @param counterorder second order data
     * @param countercall second order call
     * @param pFeeRecipient protocol fee recipient
     * @param protocolFee value sent in eth
     * @param fill previous fill if any
     *
     */
    function encodeStaticCall(
        Order memory order,
        Call memory call,
        Order memory counterorder,
        Call memory countercall,
        address pFeeRecipient,
        uint256 protocolFee,
        uint256 fill
    ) internal pure returns (bytes memory) {
        /* This array wrapping is necessary to preserve static call target function stack space. */
        address[7] memory addresses = [
            order.registry,
            order.maker,
            call.target,
            counterorder.registry,
            counterorder.maker,
            countercall.target,
            pFeeRecipient
        ];
        AuthenticatedProxy.HowToCall[2] memory howToCalls = [
            call.howToCall,
            countercall.howToCall
        ];
        uint256[3] memory uints = [protocolFee, order.maximumFill, fill];
        return
            abi.encodeWithSelector(
                order.staticSelector,
                order.staticExtradata,
                addresses,
                howToCalls,
                uints,
                call.data,
                countercall.data
            );
    }

    /**
     * @notice static call execution to validate orders matched
     * @param order first order data
     * @param call first order call
     * @param counterorder second order data
     * @param countercall second order call
     * @param pFeeRecipient protocol fee recipient
     * @param protocolFee protocol fees
     * @param fill previous fill if any
     */
    function executeStaticCall(
        Order memory order,
        Call memory call,
        Order memory counterorder,
        Call memory countercall,
        address pFeeRecipient,
        uint256 protocolFee,
        uint256 fill
    ) internal view returns (uint256) {
        return
            staticCallUint(
                order.staticTarget,
                encodeStaticCall(
                    order,
                    call,
                    counterorder,
                    countercall,
                    pFeeRecipient,
                    protocolFee,
                    fill
                )
            );
    }

    function executeCall(
        ProxyRegistryInterface registry,
        address maker,
        Call memory call
    ) internal returns (bool) {
        /* Assert valid registry. */
        if (!registries[address(registry)]) revert RegistryNotAdded();

        /* Assert target exists. */
        if (!exists(call.target)) revert CallTargetDoesNotExist();

        /* Retrieve proxy contract. */
        AuthenticatedProxy proxy = registry.proxies(maker);

        /* Assert existence. */
        if (proxy == AuthenticatedProxy(address(0))) {
            revert ProxyDoesNotExistForMaker();
        }

        /* Assert implementation. */
        if (proxy.implementation() != registry.authProxyImplementation()) {
            revert IncorrectProxyImplementationForMaker();
        }

        /* Execute order. */
        return proxy.proxy(call.target, call.howToCall, call.data);
    }

    function approveOrderHash(bytes32 hash) public {
        /* Assert order has not already been approved. */
        if (approved[msg.sender][hash]) revert OrderHasAlreadyBeenApproved();

        /* EFFECTS */

        /* Mark order as approved. */
        approved[msg.sender][hash] = true;
    }

    function approveOrder(
        Order memory order,
        bool orderbookInclusionDesired
    ) internal {
        /* Assert sender is authorized to approve order. */
        if (order.maker != msg.sender) revert SenderNotAuthorized();

        /* Calculate order hash. */
        bytes32 hash = hashOrder(order);

        /* Approve order hash. */
        approveOrderHash(hash);

        /* Log approval event. */
        emit OrderApproved(
            hash,
            order.registry,
            order.maker,
            order.executer,
            order.staticTarget,
            order.staticSelector,
            order.staticExtradata,
            order.maximumFill,
            uint64(order.extraData),
            uint64(order.extraData >> 64),
            uint128(order.extraData >> 128),
            orderbookInclusionDesired
        );
    }

    function setOrderFill(bytes32 hash, uint256 fill) external {
        ///@dev Assert fill is not already set.
        if (fills[msg.sender][hash] == fill) {
            revert FillIsSetToTheDesiredValue();
        }

        ///@dev Mark order as accordingly filled.
        fills[msg.sender][hash] = fill;

        ///@notice Log order fill change event.
        emit OrderFillChanged(hash, msg.sender, fill);
    }

    function atomicMatch(
        Order memory firstOrder,
        Call memory firstCall,
        Order memory secondOrder,
        Call memory secondCall,
        bytes memory signatures
    ) internal nonReentrant {
        /* Calculate first order hash. */
        bytes32 firstHash = hashOrder(firstOrder);

        /* Check first order validity. */
        if (!validateOrderParameters(firstOrder, firstHash)) {
            revert FirstOrderHasInvalidParams();
        }

        /* Calculate second order hash. */
        bytes32 secondHash = hashOrder(secondOrder);

        /* Check second order validity. */
        if (!validateOrderParameters(secondOrder, secondHash)) {
            revert SecondOrderHasInvalidParams();
        }

        /* Prevent self-matching (possibly unnecessary, but safer). */
        if (firstHash == secondHash) revert SelfMatchingIsProhibited();

        {
            /* Calculate signatures (must be awkwardly decoded here due to stack size constraints). */
            (bytes memory firstSignature, bytes memory secondSignature) = abi
                .decode(signatures, (bytes, bytes));

            /* Check first order authorization. */
            if (
                !validateOrderAuthorization(
                    firstHash,
                    firstOrder.executer,
                    firstSignature,
                    firstCall.data
                )
            ) {
                revert FirstOrderFailedAuthorization();
            }

            /* Check second order authorization. */
            if (
                !validateOrderAuthorization(
                    secondHash,
                    secondOrder.executer,
                    secondSignature,
                    secondCall.data
                )
            ) {
                revert SecondOrderFailedAuthorization();
            }
        }

        /* Execute first call, assert success.
           This is the second 'asymmetric' part of order matching: 
           execution of the second order can depend on state changes 
           in the first order, but not vice-versa. */

        if (
            !executeCall(
                ProxyRegistryInterface(firstOrder.registry),
                firstOrder.executer,
                firstCall
            )
        ) {
            revert FirstCallFailed();
        }

        /* Execute second call, assert success. */
        if (
            !executeCall(
                ProxyRegistryInterface(secondOrder.registry),
                secondOrder.executer,
                secondCall
            )
        ) {
            revert SecondCallFailed();
        }

        /* Fetch previous first order fill. */
        uint256 previousFirstFill = fills[firstOrder.maker][firstHash];

        /* Fetch previous second order fill. */
        uint256 previousSecondFill = fills[secondOrder.maker][secondHash];

        /* Execute first order static call, assert success, capture returned new fill. */
        uint256 firstFill = executeStaticCall(
            firstOrder,
            firstCall,
            secondOrder,
            secondCall,
            protocolFeeRecipient,
            pFee,
            previousFirstFill
        );

        /* Execute second order static call, assert success, capture returned new fill. */
        uint256 secondFill = executeStaticCall(
            secondOrder,
            secondCall,
            firstOrder,
            firstCall,
            protocolFeeRecipient,
            pFee,
            previousSecondFill
        );

        if (firstFill != previousFirstFill) {
            fills[firstOrder.maker][firstHash] = firstFill;
        }

        if (secondFill != previousSecondFill) {
            fills[secondOrder.maker][secondHash] = secondFill;
        }

        ///@notice Log match event.
        emit OrdersMatched(
            firstHash,
            secondHash,
            firstOrder.maker,
            secondOrder.maker,
            firstFill,
            secondFill
        );
    }

    /**
     * @dev Change the protocol fee recipient (owner only)
     * @param newProtocolFeeRecipient New protocol fee recipient address
     */
    function changeProtocolFeeRecipient(
        address newProtocolFeeRecipient
    ) public onlyOwner {
        if (newProtocolFeeRecipient == address(0)) revert AddressCannotBeZero();

        if (newProtocolFeeRecipient == protocolFeeRecipient) {
            revert AddressIsAlreadySet();
        }

        protocolFeeRecipient = payable(newProtocolFeeRecipient);

        emit ProtocolFeeRecipientUpdated(newProtocolFeeRecipient);
    }

    /**
     * @dev Change the minimum maker fee paid to the protocol (owner only)
     * @param pFee_ New fee to set in basis points
     */
    function changeProtocolFee(uint256 pFee_) external onlyOwner {
        if (pFee == pFee_) revert ValueIsAlreadySet();
        if (pFee_ > 1_000) revert FeeMismatch();
        pFee = pFee_;

        emit ProtocolFeeUpdated(pFee_);
    }

    /**
     * @dev Get protocol fees recipient and bps
     */
    function getProtocolFees() external view returns (address, uint256) {
        return (protocolFeeRecipient, pFee);
    }

    /**
     * @dev Get order status
     * @param order order of type Order to check status
     */
    function getOrderStatus(
        Order memory order
    )
        external
        view
        returns (
            bool isApproved,
            bool isFilledOrCancelled,
            uint256 amountFilled,
            uint256 maxFill
        )
    {
        bytes32 orderHash = hashOrder(order);
        address maker = order.maker;
        isApproved = approved[maker][orderHash];
        isFilledOrCancelled = fills[maker][orderHash] == order.maximumFill;
        amountFilled = fills[maker][orderHash];
        maxFill = order.maximumFill;
    }
}
