// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract CreatePoolScript is Script {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant HOOK = 0x984439E305dD17e7a16f2aAf876d99d9D7C710c0;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy Test Tokens
        MockERC20 tokenA = new MockERC20("FairFlow USD", "fUSD", 18);
        MockERC20 tokenB = new MockERC20("FairFlow ETH", "fETH", 18);

        address deployer = msg.sender;
        tokenA.mint(deployer, 1_000_000 ether);
        tokenB.mint(deployer, 1_000_000 ether);

        MockERC20 t0 = address(tokenA) < address(tokenB) ? tokenA : tokenB;
        MockERC20 t1 = address(tokenA) < address(tokenB) ? tokenB : tokenA;

        Currency c0 = Currency.wrap(address(t0));
        Currency c1 = Currency.wrap(address(t1));

        PoolKey memory poolKey = PoolKey({
            currency0: c0,
            currency1: c1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        // 2. Initialize Pool at 1:1 price
        uint160 startingPrice = 2 ** 96;
        IPoolManager(POOL_MANAGER).initialize(poolKey, startingPrice);

        vm.stopBroadcast();

        bytes32 pid = PoolId.unwrap(poolKey.toId());
        console2.log("=== FAIRFLOW POOL INITIALIZED ON BASE SEPOLIA ===");
        console2.log("Token0:", address(t0));
        console2.log("Token1:", address(t1));
        console2.log("PoolId:", vm.toString(pid));
    }
}
