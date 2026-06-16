// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title Chiron — Agent Transaction Security Middleware
/// @notice On-chain verification store and registry for semantic consistency verification
interface ICircuitBreaker {
    function recordFail(address agent) external;
    function recordSuccess(address agent) external;
    function isPaused(address agent) external view returns (bool);
    function resume(address agent) external;
}

contract Chiron {
    // ============ Types ============

    enum L1Result { PASS, FAIL, UNCERTAIN }
    enum L2Result { NONE, CONSISTENT, INCONSISTENT }

    struct VerificationReceipt {
        bytes32 intentHash;
        bytes32 txHash;
        address agent;
        L1Result l1Result;
        L2Result l2Result;
        uint256 timestamp;
        uint256 blockNumber;
    }

    // ============ State ============

    mapping(bytes32 txHash => VerificationReceipt) public receipts;
    mapping(address agent => bytes32[]) public agentReceipts;
    mapping(address agent => uint256) public dailyNonce;

        address public owner;
    ICircuitBreaker public circuitBreaker;
    uint256 public constant MAX_DAILY_TX = 1000;

    // ============ Events ============

    event ReceiptStored(
        bytes32 indexed txHash,
        bytes32 indexed intentHash,
        address indexed agent,
        L1Result l1Result
    );

    // ============ Constructor ============

    constructor() {
        owner = msg.sender;
    }

    // ============ Core ============

    /// @notice Store a verification receipt on-chain
    function isAgentPaused(address agent) external view returns (bool) {
        if (address(circuitBreaker) == address(0)) return false;
        return circuitBreaker.isPaused(agent);
    }

    function setCircuitBreaker(address _cb) external {
        require(msg.sender == owner, "Only owner");
        circuitBreaker = ICircuitBreaker(_cb);
    }

    function storeReceipt(
        bytes32 _txHash,
        bytes32 _intentHash,
        address _agent,
        L1Result _l1Result,
        L2Result _l2Result
    ) external {
        if (address(circuitBreaker) != address(0)) require(!circuitBreaker.isPaused(_agent), "Agent is paused");
        require(receipts[_txHash].timestamp == 0, "Receipt already exists");
        require(dailyNonce[_agent] < MAX_DAILY_TX, "Daily limit reached");
        if (address(circuitBreaker) != address(0)) {
            if (_l1Result == L1Result.FAIL) circuitBreaker.recordFail(_agent);
            else circuitBreaker.recordSuccess(_agent);
        }

        receipts[_txHash] = VerificationReceipt({
            intentHash: _intentHash,
            txHash: _txHash,
            agent: _agent,
            l1Result: _l1Result,
            l2Result: _l2Result,
            timestamp: block.timestamp,
            blockNumber: block.number
        });

        agentReceipts[_agent].push(_txHash);
        dailyNonce[_agent]++;

        emit ReceiptStored(_txHash, _intentHash, _agent, _l1Result);
    }

    /// @notice Get receipt for a transaction
    function getReceipt(bytes32 _txHash) external view returns (VerificationReceipt memory) {
        return receipts[_txHash];
    }

    /// @notice Get all receipt hashes for an agent
    function getAgentReceipts(address _agent) external view returns (bytes32[] memory) {
        return agentReceipts[_agent];
    }


}
