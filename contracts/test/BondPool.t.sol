// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import {Test} from "forge-std/Test.sol";
import {BondPool} from "../src/BondPool.sol";
contract BondPoolTest is Test {
    BondPool pool;
    address agent = address(0x1234);
    function setUp() public { pool = new BondPool(); }
    function testDeposit() public {
        pool.deposit(agent, 100 ether);
        assertEq(pool.stakes(agent), 100 ether);
    }
    function testTxLimit() public {
        pool.deposit(agent, 100 ether);
        assertEq(pool.getTxLimit(agent), 1000 ether);
    }
    function testWithdraw() public {
        pool.deposit(agent, 100 ether);
        pool.withdraw(agent, 40 ether);
        assertEq(pool.stakes(agent), 60 ether);
    }
    function testCannotWithdrawMoreThanStaked() public {
        vm.expectRevert("Insufficient stake");
        pool.withdraw(agent, 1 ether);
    }
}
