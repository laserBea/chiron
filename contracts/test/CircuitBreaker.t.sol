// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import {Test} from "forge-std/Test.sol";
import {CircuitBreaker} from "../src/CircuitBreaker.sol";
contract CircuitBreakerTest is Test {
    CircuitBreaker cb;
    address agent = address(0x1234);
    function setUp() public { cb = new CircuitBreaker(); }
    function testRecordFailTriggersPause() public {
        for (uint i = 0; i < 5; i++) cb.recordFail(agent);
        assertTrue(cb.isPaused(agent));
    }
    function testRecordSuccessResets() public {
        for (uint i = 0; i < 4; i++) cb.recordFail(agent);
        cb.recordSuccess(agent);
        assertEq(cb.consecutiveFails(agent), 0);
    }
    function testResume() public {
        for (uint i = 0; i < 5; i++) cb.recordFail(agent);
        cb.resume(agent);
        assertFalse(cb.isPaused(agent));
    }
    function testCustomThreshold() public {
        cb.setThreshold(agent, 2);
        cb.recordFail(agent);
        assertFalse(cb.isPaused(agent));
        cb.recordFail(agent);
        assertTrue(cb.isPaused(agent));
    }
}
