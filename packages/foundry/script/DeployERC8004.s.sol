// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {IdentityRegistry} from "../contracts/erc8004/IdentityRegistry.sol";
import {ReputationRegistry} from "../contracts/erc8004/ReputationRegistry.sol";
import {ValidationRegistry} from "../contracts/erc8004/ValidationRegistry.sol";

/**
 * @title DeployERC8004
 * @notice Deploys all ERC-8004 registries to Hedera Testnet
 * @dev Usage: forge script script/DeployERC8004.s.sol:DeployERC8004 --rpc-url testnet --broadcast
 */
contract DeployERC8004 is Script {
    function run() external {
        // Load the private key from environment
        uint256 deployerPrivateKey = vm.envUint("HEDERA_PRIVATE_KEY");
        
        console.log("================================");
        console.log("Deploying ERC-8004 Registries...");
        console.log("================================");
        console.log("");
        
        // Get deployer address
        address deployerAddress = vm.addr(deployerPrivateKey);
        console.log("Deployer Address:", deployerAddress);
        console.log("");
        
        // 1. Deploy IdentityRegistry
        console.log("1. Deploying IdentityRegistry...");
        vm.startBroadcast(deployerPrivateKey);
        IdentityRegistry identityRegistry = new IdentityRegistry();
        vm.stopBroadcast();
        console.log("   IdentityRegistry deployed to:", address(identityRegistry));
        console.log("");
        
        // 2. Deploy ReputationRegistry
        console.log("2. Deploying ReputationRegistry...");
        vm.startBroadcast(deployerPrivateKey);
        ReputationRegistry reputationRegistry = new ReputationRegistry(
            address(identityRegistry)
        );
        vm.stopBroadcast();
        console.log("   ReputationRegistry deployed to:", address(reputationRegistry));
        console.log("");
        
        // 3. Deploy ValidationRegistry
        console.log("3. Deploying ValidationRegistry...");
        vm.startBroadcast(deployerPrivateKey);
        ValidationRegistry validationRegistry = new ValidationRegistry(
            address(identityRegistry)
        );
        vm.stopBroadcast();
        console.log("   ValidationRegistry deployed to:", address(validationRegistry));
        console.log("");
        
        console.log("================================");
        console.log("All ERC-8004 Contracts Deployed!");
        console.log("================================");
        console.log("");
        console.log("Update your .env file with:");
        console.log("NEXT_PUBLIC_IDENTITY_REGISTRY_ADDRESS=%s", address(identityRegistry));
        console.log("NEXT_PUBLIC_REPUTATION_REGISTRY_ADDRESS=%s", address(reputationRegistry));
        console.log("NEXT_PUBLIC_VALIDATION_REGISTRY_ADDRESS=%s", address(validationRegistry));
        console.log("");
        console.log("Verify contracts with:");
        console.log("forge verify-contract %s contracts/erc8004/IdentityRegistry.sol:IdentityRegistry --chain-id 296 --verifier sourcify --verifier-url https://server-verify.hashscan.io/", address(identityRegistry));
        console.log("forge verify-contract %s contracts/erc8004/ReputationRegistry.sol:ReputationRegistry --chain-id 296 --verifier sourcify --verifier-url https://server-verify.hashscan.io/ --constructor-args $(cast abi-encode 'constructor(address)' %s)", address(reputationRegistry), address(identityRegistry));
        console.log("forge verify-contract %s contracts/erc8004/ValidationRegistry.sol:ValidationRegistry --chain-id 296 --verifier sourcify --verifier-url https://server-verify.hashscan.io/ --constructor-args $(cast abi-encode 'constructor(address)' %s)", address(validationRegistry), address(identityRegistry));
    }
}
