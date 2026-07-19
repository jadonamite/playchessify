// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {TournamentRewards} from "../src/TournamentRewards.sol";

/// @notice Deploys TournamentRewards wired to the already-live ERC2771Forwarder,
///         so gasless winners claim through the same relay as faucetClaim.
///         Owner = deployer (master wallet) — it seeds each season and sweeps.
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY  — master wallet, deploys + owns the vault
///   FORWARDER_ADDRESS     — the live PlaychessifyForwarder
///
/// Usage:
///   forge script script/DeployRewards.s.sol:DeployRewards --rpc-url celo --broadcast
contract DeployRewards is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address forwarderAddr = vm.envAddress("FORWARDER_ADDRESS");

        vm.startBroadcast(deployerKey);
        TournamentRewards rewards = new TournamentRewards(forwarderAddr);
        vm.stopBroadcast();

        console.log("TournamentRewards: ", address(rewards));
        console.log("Owner:             ", rewards.owner());
    }
}
