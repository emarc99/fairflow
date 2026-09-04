// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

import {BaseScript} from "./base/BaseScript.sol";

import {FairFlow} from "../src/FairFlow.sol";

/// @notice Mines the permissioned address and deploys the FairFlow hook.
contract DeployHookScript is BaseScript {
    function run() public {
        // hook contracts must have specific flags encoded in the address
        uint160 flags = uint160(Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        // Mine a salt that will produce a hook address with the correct flags
        bytes memory constructorArgs = abi.encode(poolManager);
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_FACTORY, flags, type(FairFlow).creationCode, constructorArgs);

        // Deploy the hook using CREATE2 Factory
        vm.startBroadcast();
        bytes memory initCode = abi.encodePacked(type(FairFlow).creationCode, constructorArgs);
        (bool success, bytes memory returnData) = CREATE2_FACTORY.call(abi.encodePacked(salt, initCode));
        require(success, "DeployHookScript: CREATE2 deploy failed");
        address deployedAddress = address(uint160(bytes20(returnData)));
        FairFlow fairFlow = FairFlow(deployedAddress);
        vm.stopBroadcast();

        require(address(fairFlow) == hookAddress, "DeployHookScript: Hook Address Mismatch");
    }
}
