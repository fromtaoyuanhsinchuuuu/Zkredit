//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/payment/X402Payment.sol";
import "./DeployHelpers.s.sol";

/**
 * @notice Deploy X402Payment contract
 * @dev Run with: forge script script/DeployX402Payment.s.sol --rpc-url hederaTestnet --broadcast
 */
contract DeployX402Payment is ScaffoldETHDeploy {
    function run() external returns (X402Payment) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert InvalidPrivateKey(
                "You don't have a deployer account. Make sure you have set DEPLOYER_PRIVATE_KEY in .env"
            );
        }

        vm.startBroadcast(deployerPrivateKey);
        X402Payment x402Payment = new X402Payment();
        vm.stopBroadcast();

        console.logString(
            string.concat(
                "X402Payment deployed at: ",
                vm.toString(address(x402Payment))
            )
        );

        return x402Payment;
    }

    function test() public {}
}
