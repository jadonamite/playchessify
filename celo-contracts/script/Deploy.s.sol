// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC2771Forwarder} from "@openzeppelin/contracts/metatx/ERC2771Forwarder.sol";
import {PlaychessifyToken} from "../src/PlaychessifyToken.sol";
import {PlaychessifyEngine} from "../src/PlaychessifyEngine.sol";

/// @notice Deploys ERC2771Forwarder → PlaychessifyToken(forwarder) → PlaychessifyEngine(token, forwarder),
///         then wires oracle + minter. Owner = deployer (master wallet). No transferOwnership.
///
///         Post-deploy (owner, before repointing the app):
///           1. importStats(...) batches with the v1 stats snapshot, then lockStatsSeed()
///           2. batchMint(...) with the v1 CHESS balance snapshot
///
/// Required env:
///   DEPLOYER_PRIVATE_KEY  — master wallet, deploys + owns both contracts
///   ORACLE_ADDRESS        — settlement oracle (set as PlaychessifyEngine.oracle)
///   MINTER_ADDRESS        — server minter (set as PlaychessifyToken.minter); may equal oracle
///
/// Usage:
///   forge script script/Deploy.s.sol:Deploy --rpc-url celo-sepolia --broadcast --verify
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address oracleAddr = vm.envAddress("ORACLE_ADDRESS");
        address minterAddr = vm.envAddress("MINTER_ADDRESS");

        vm.startBroadcast(deployerKey);

        ERC2771Forwarder forwarder = new ERC2771Forwarder("PlaychessifyForwarder");
        PlaychessifyToken token = new PlaychessifyToken(address(forwarder));
        PlaychessifyEngine game = new PlaychessifyEngine(address(token), address(forwarder));

        game.setOracle(oracleAddr);
        token.setMinter(minterAddr);

        vm.stopBroadcast();

        console.log("Forwarder: ", address(forwarder));
        console.log("PlaychessifyToken:", address(token));
        console.log("PlaychessifyEngine: ", address(game));
        console.log("Oracle:    ", oracleAddr);
        console.log("Minter:    ", minterAddr);
    }
}
