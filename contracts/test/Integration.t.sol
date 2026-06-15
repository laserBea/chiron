// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {Chiron} from "../src/Chiron.sol";
import {BondPool} from "../src/BondPool.sol";
import {CircuitBreaker} from "../src/CircuitBreaker.sol";
import {IntentTemplateRegistry} from "../src/IntentTemplateRegistry.sol";

contract IntegrationTest is Test {
    Chiron chiron;
    BondPool pool;
    CircuitBreaker cb;
    IntentTemplateRegistry itr;
    address agent = address(0x4444);

    function setUp() public {
        chiron = new Chiron();
        pool = new BondPool();
        cb = new CircuitBreaker();
        itr = new IntentTemplateRegistry();
        chiron.setCircuitBreaker(address(cb));
    }

    function testStoreReceipt() public {
        chiron.storeReceipt(keccak256("tx1"), keccak256("intent1"), agent, Chiron.L1Result.PASS, Chiron.L2Result.NONE);
        Chiron.VerificationReceipt memory r = chiron.getReceipt(keccak256("tx1"));
        assertEq(r.agent, agent, "Agent should match");
        assertTrue(r.timestamp > 0, "Receipt stored");
    }

    function testDuplicateReceipt() public {
        chiron.storeReceipt(keccak256("tx1"), keccak256("i1"), agent, Chiron.L1Result.PASS, Chiron.L2Result.NONE);
        vm.expectRevert("Receipt already exists");
        chiron.storeReceipt(keccak256("tx1"), keccak256("i2"), agent, Chiron.L1Result.PASS, Chiron.L2Result.NONE);
    }

    function testCbIntegration() public {
        for (uint i = 0; i < 5; i++) {
            chiron.storeReceipt(keccak256(abi.encode(i)), keccak256("i"), agent, Chiron.L1Result.FAIL, Chiron.L2Result.NONE);
        }
        assertTrue(cb.isPaused(agent), "Paused after 5 FAILs");
        vm.expectRevert("Agent is paused");
        chiron.storeReceipt(keccak256("extra"), keccak256("i"), agent, Chiron.L1Result.FAIL, Chiron.L2Result.NONE);
    }

    function testBondPool() public {
        pool.deposit(agent, 1 ether);
        assertEq(pool.stakes(agent), 1 ether);
        assertEq(pool.getTxLimit(agent), 10 ether);
        pool.withdraw(agent, 0.5 ether);
        assertEq(pool.stakes(agent), 0.5 ether);
    }

    function testRegistry() public {
        bytes32 hash = keccak256("my_protocol");
        address[] memory contracts = new address[](1);
        contracts[0] = address(0xaaaa);
        bytes4[] memory sels = new bytes4[](1);
        sels[0] = hex"414bf389";
        itr.registerProtocol(hash, contracts, sels, 1);
        assertEq(itr.getActionType(address(0xaaaa)), 1);
        assertEq(itr.getRegisteredContractCount(), 1);
    }
}
