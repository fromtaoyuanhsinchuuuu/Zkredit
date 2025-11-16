// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AgentRegistry} from "../contracts/agent/AgentRegistry.sol";
import {X402Payment} from "../contracts/payment/X402Payment.sol";
import {ZKVerifier} from "../contracts/zk/ZKVerifier.sol";

/**
 * @title DeployAll
 * @notice Deploys all ZKredit contracts to Hedera Testnet
 * @dev Usage: forge script script/DeployAll.s.sol:DeployAll --rpc-url testnet --broadcast
 */
contract DeployAll is Script {
    function run() external {
        // Load the private key from environment
        uint256 deployerPrivateKey = vm.envUint("HEDERA_PRIVATE_KEY");
        
        console.log("================================");
        console.log("Deploying ZKredit Contracts...");
        console.log("================================");
        console.log("");
        
        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);
        
        // Get deployer address
        address deployerAddress = vm.addr(deployerPrivateKey);
        console.log("Deployer Address:", deployerAddress);
        console.log("");
        
        // 1. Deploy AgentRegistry
        console.log("1. Deploying AgentRegistry...");
        AgentRegistry agentRegistry = new AgentRegistry();
        console.log("   AgentRegistry deployed to:", address(agentRegistry));
        console.log("");
        
        // 2. Deploy X402Payment
        console.log("2. Deploying X402Payment...");
        X402Payment x402Payment = new X402Payment();
        console.log("   X402Payment deployed to:", address(x402Payment));
        console.log("");
        
        // 3. Deploy ZKVerifier
        console.log("3. Deploying ZKVerifier...");
        ZKVerifier zkVerifier = new ZKVerifier();
        console.log("   ZKVerifier deployed to:", address(zkVerifier));
        console.log("");
        
        // Stop broadcasting
        vm.stopBroadcast();
        
        console.log("================================");
        console.log("All Contracts Deployed!");
        console.log("================================");
        console.log("");
        console.log("Update your .env file with:");
        console.log("NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=%s", address(agentRegistry));
        console.log("NEXT_PUBLIC_X402_PAYMENT_ADDRESS=%s", address(x402Payment));
        console.log("NEXT_PUBLIC_ZK_VERIFIER_ADDRESS=%s", address(zkVerifier));
        console.log("");
        console.log("Verify contracts with:");
        console.log("forge verify-contract %s contracts/agent/AgentRegistry.sol:AgentRegistry --chain-id 296 --verifier sourcify --verifier-url https://server-verify.hashscan.io/", address(agentRegistry));
        console.log("forge verify-contract %s contracts/payment/X402Payment.sol:X402Payment --chain-id 296 --verifier sourcify --verifier-url https://server-verify.hashscan.io/", address(x402Payment));
        console.log("forge verify-contract %s contracts/zk/ZKVerifier.sol:ZKVerifier --chain-id 296 --verifier sourcify --verifier-url https://server-verify.hashscan.io/", address(zkVerifier));
    }
}
