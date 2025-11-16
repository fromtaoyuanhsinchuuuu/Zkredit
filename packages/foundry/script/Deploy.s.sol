//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DeployHelpers.s.sol";
import { DeployYourContract } from "./DeployYourContract.s.sol";
import { DeployAgentRegistry } from "./DeployAgentRegistry.s.sol";
import { DeployX402Payment } from "./DeployX402Payment.s.sol";
import { DeployZKVerifier } from "./DeployZKVerifier.s.sol";

/**
 * @notice Main deployment script for all ZKredit contracts
 * @dev Run this when you want to deploy all contracts at once
 *
 * Example: forge script script/Deploy.s.sol --rpc-url hederaTestnet --broadcast
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        // Deploy ZKredit contracts sequentially
        
        console.logString("================================");
        console.logString("Deploying ZKredit Contracts...");
        console.logString("================================");
        
        // 1. Deploy AgentRegistry
        DeployAgentRegistry deployAgentRegistry = new DeployAgentRegistry();
        deployAgentRegistry.run();
        
        // 2. Deploy X402Payment
        DeployX402Payment deployX402Payment = new DeployX402Payment();
        deployX402Payment.run();
        
        // 3. Deploy ZKVerifier
        DeployZKVerifier deployZKVerifier = new DeployZKVerifier();
        deployZKVerifier.run();
        
        console.logString("================================");
        console.logString("All contracts deployed!");
        console.logString("Please update your .env file with the deployed addresses");
        console.logString("================================");
    }
}

