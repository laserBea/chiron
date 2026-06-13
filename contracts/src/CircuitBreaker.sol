// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title CircuitBreaker — Auto-pause agent on repeated violations
/// @notice Tracks consecutive L1 failures. Pauses agent after threshold.
contract CircuitBreaker {
    address public owner;
    uint256 public defaultThreshold = 5;
    uint256 public defaultCooldown = 86400; // 24h

    mapping(address agent => bool) public paused;
    mapping(address agent => uint256) public consecutiveFails;
    mapping(address agent => uint256) public dailyTxValue;
    mapping(address agent => uint256) public dailyValueReset;
    mapping(address agent => uint256) public threshold; // per-agent override

    event AgentPaused(address indexed agent, string reason);
    event AgentResumed(address indexed agent);
    event FailRecorded(address indexed agent, uint256 consecutive);
    event SuccessRecorded(address indexed agent);

    constructor() { owner = msg.sender; }

    modifier onlyOwner() { require(msg.sender == owner, "Only owner"); _; }

    function recordFail(address agent) external {
        if (paused[agent]) return;
        consecutiveFails[agent]++;
        emit FailRecorded(agent, consecutiveFails[agent]);
        uint256 t = threshold[agent] > 0 ? threshold[agent] : defaultThreshold;
        if (consecutiveFails[agent] >= t) {
            paused[agent] = true;
            emit AgentPaused(agent, "Consecutive failure limit reached");
        }
    }

    function recordSuccess(address agent) external {
        consecutiveFails[agent] = 0;
        emit SuccessRecorded(agent);
    }

    function resume(address agent) external {
        require(paused[agent], "Agent not paused");
        paused[agent] = false;
        consecutiveFails[agent] = 0;
        emit AgentResumed(agent);
    }

    function setThreshold(address agent, uint256 t) external onlyOwner {
        threshold[agent] = t;
    }

    function isPaused(address agent) external view returns (bool) {
        return paused[agent];
    }
}
