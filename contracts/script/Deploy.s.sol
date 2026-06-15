// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script} from "forge-std/Script.sol";
import {Chiron} from "../src/Chiron.sol";
import {BondPool} from "../src/BondPool.sol";
import {CircuitBreaker} from "../src/CircuitBreaker.sol";
import {IntentTemplateRegistry} from "../src/IntentTemplateRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Deploy Chiron (VerificationStore)
        Chiron chiron = new Chiron();
        console.log("Chiron deployed at:", address(chiron));

        // Step 2: Deploy BondPool
        BondPool bondPool = new BondPool();
        console.log("BondPool deployed at:", address(bondPool));

        // Step 3: Deploy CircuitBreaker
        CircuitBreaker circuitBreaker = new CircuitBreaker();
        console.log("CircuitBreaker deployed at:", address(circuitBreaker));

        // Step 4: Connect Chiron → CircuitBreaker
        chiron.setCircuitBreaker(address(circuitBreaker));
        console.log("CircuitBreaker connected to Chiron");

        // Step 5: Deploy IntentTemplateRegistry
        IntentTemplateRegistry registry = new IntentTemplateRegistry();
        console.log("IntentTemplateRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
