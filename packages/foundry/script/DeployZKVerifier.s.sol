//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/zk/ZKVerifier.sol";
import "./DeployHelpers.s.sol";

/**
 * @notice Deploy ZKVerifier contract
 * @dev Run with: forge script script/DeployZKVerifier.s.sol --rpc-url hederaTestnet --broadcast
 */
contract DeployZKVerifier is ScaffoldETHDeploy {
    function run() external returns (ZKVerifier) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert InvalidPrivateKey(
                "You don't have a deployer account. Make sure you have set DEPLOYER_PRIVATE_KEY in .env"
            );
        }

        vm.startBroadcast(deployerPrivateKey);
        ZKVerifier zkVerifier = new ZKVerifier();
        vm.stopBroadcast();

        console.logString(
            string.concat(
                "ZKVerifier deployed at: ",
                vm.toString(address(zkVerifier))
            )
        );

        return zkVerifier;
    }

    function test() public {}
}
