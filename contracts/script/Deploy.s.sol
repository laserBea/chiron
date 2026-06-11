// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import {Script} from "forge-std/Script.sol";
import {Chiron} from "../src/Chiron.sol";
contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        Chiron chiron = new Chiron();
        console.log("Chiron deployed at:", address(chiron));
        vm.stopBroadcast();
    }
}
