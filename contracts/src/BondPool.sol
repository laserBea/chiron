// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title BondPool — Agent staking contract
/// @notice Agents stake tokens to establish trust. Stake amount determines tx limits.
contract BondPool {
    address public owner;
    uint256 public totalStaked;
    mapping(address => uint256) public stakes;
    uint256 public constant MULTIPLIER = 10;

    event Deposited(address indexed agent, uint256 amount, uint256 totalStake);
    event Withdrawn(address indexed agent, uint256 amount, uint256 totalStake);
    event Slashed(address indexed agent, uint256 amount, address indexed recipient);

    constructor() { owner = msg.sender; }

    function deposit(address agent, uint256 amount) external returns (uint256) {
        require(amount > 0, "Amount must be > 0");
        stakes[agent] += amount;
        totalStaked += amount;
        emit Deposited(agent, amount, stakes[agent]);
        return stakes[agent];
    }

    function withdraw(address agent, uint256 amount) external returns (uint256) {
        require(stakes[agent] >= amount, "Insufficient stake");
        stakes[agent] -= amount;
        totalStaked -= amount;
        emit Withdrawn(agent, amount, stakes[agent]);
        return stakes[agent];
    }

    function getTxLimit(address agent) external view returns (uint256) {
        return stakes[agent] * MULTIPLIER;
    }

    function slash(address agent, uint256 amount, address recipient) external {
        require(msg.sender == owner, "Only owner");
        require(stakes[agent] >= amount, "Insufficient stake");
        stakes[agent] -= amount;
        totalStaked -= amount;
        emit Slashed(agent, amount, recipient);
    }
}
