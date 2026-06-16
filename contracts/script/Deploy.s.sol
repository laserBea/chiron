// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import "forge-std/console.sol";
import {Chiron} from "../src/Chiron.sol";
import {BondPool} from "../src/BondPool.sol";
import {CircuitBreaker} from "../src/CircuitBreaker.sol";
import {IntentTemplateRegistry} from "../src/IntentTemplateRegistry.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        Chiron chiron = new Chiron();
        console.log("Chiron deployed at:", address(chiron));

        BondPool bondPool = new BondPool();
        console.log("BondPool deployed at:", address(bondPool));

        CircuitBreaker circuitBreaker = new CircuitBreaker();
        console.log("CircuitBreaker deployed at:", address(circuitBreaker));

        chiron.setCircuitBreaker(address(circuitBreaker));
        console.log("CircuitBreaker connected to Chiron");

        IntentTemplateRegistry registry = new IntentTemplateRegistry();
        console.log("IntentTemplateRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
