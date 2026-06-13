// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title IntentTemplateRegistry — Community protocol registration
/// @notice Register new protocol → Action mappings for the Chiron registry
contract IntentTemplateRegistry {
    address public owner;
    
    struct ProtocolMapping {
        bytes32 protocolHash;
        address[] contracts;
        bytes4[] selectors;
        uint8 actionType;
        bool active;
        uint256 registeredAt;
    }

    mapping(bytes32 protocolHash => ProtocolMapping) public protocols;
    mapping(address contractAddr => bytes32 protocolHash) public contractToProtocol;
    address[] public registeredContracts;

    event ProtocolRegistered(bytes32 indexed protocolHash, uint8 actionType, uint256 contractCount);
    event ProtocolDeactivated(bytes32 indexed protocolHash);

    constructor() { owner = msg.sender; }

    function registerProtocol(
        bytes32 protocolHash,
        address[] calldata contracts,
        bytes4[] calldata selectors,
        uint8 actionType
    ) external {
        require(contracts.length > 0, "At least one contract");
        ProtocolMapping storage p = protocols[protocolHash];
        p.protocolHash = protocolHash;
        p.actionType = actionType;
        p.active = true;
        p.registeredAt = block.timestamp;
        for (uint i = 0; i < contracts.length; i++) {
            p.contracts.push(contracts[i]);
            contractToProtocol[contracts[i]] = protocolHash;
            registeredContracts.push(contracts[i]);
        }
        for (uint i = 0; i < selectors.length; i++) {
            p.selectors.push(selectors[i]);
        }
        emit ProtocolRegistered(protocolHash, actionType, contracts.length);
    }

    function deactivateProtocol(bytes32 protocolHash) external {
        require(msg.sender == owner, "Only owner");
        protocols[protocolHash].active = false;
        emit ProtocolDeactivated(protocolHash);
    }

    function getProtocol(bytes32 protocolHash) external view returns (ProtocolMapping memory) {
        return protocols[protocolHash];
    }

    function getActionType(address contractAddr) external view returns (uint8) {
        bytes32 ph = contractToProtocol[contractAddr];
        if (ph == bytes32(0) || !protocols[ph].active) return 0;
        return protocols[ph].actionType;
    }

    function getRegisteredContractCount() external view returns (uint256) {
        return registeredContracts.length;
    }
}
