//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/agent/AgentRegistry.sol";
import "./DeployHelpers.s.sol";

/**
 * @notice Deploy AgentRegistry contract
 * @dev Run with: forge script script/DeployAgentRegistry.s.sol --rpc-url hederaTestnet --broadcast
 */
contract DeployAgentRegistry is ScaffoldETHDeploy {
    function run() external returns (AgentRegistry) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert InvalidPrivateKey(
                "You don't have a deployer account. Make sure you have set DEPLOYER_PRIVATE_KEY in .env"
            );
        }

        vm.startBroadcast(deployerPrivateKey);
        AgentRegistry agentRegistry = new AgentRegistry();
        vm.stopBroadcast();

        console.logString(
            string.concat(
                "AgentRegistry deployed at: ",
                vm.toString(address(agentRegistry))
            )
        );

        return agentRegistry;
    }

    function test() public {}
}
