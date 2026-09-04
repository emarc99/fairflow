// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {PoolModifyLiquidityTest} from "@uniswap/v4-core/src/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";

contract DeployRoutersAndAddLiquidityScript is Script {
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant HOOK = 0x984439E305dD17e7a16f2aAf876d99d9D7C710c0;
    address constant T0 = 0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E;
    address constant T1 = 0x9693aAd2540D75057D0CDce4c16891230D335A6B;

    function run() external {
        vm.startBroadcast();

        // 1. Deploy test swapper and test liquidity modifier
        PoolModifyLiquidityTest lpRouter = new PoolModifyLiquidityTest(IPoolManager(POOL_MANAGER));
        PoolSwapTest swapRouter = new PoolSwapTest(IPoolManager(POOL_MANAGER));

        // 2. Token Approvals
        MockERC20(T0).approve(address(lpRouter), type(uint256).max);
        MockERC20(T1).approve(address(lpRouter), type(uint256).max);
        MockERC20(T0).approve(address(swapRouter), type(uint256).max);
        MockERC20(T1).approve(address(swapRouter), type(uint256).max);

        // 3. Pool Key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(T0),
            currency1: Currency.wrap(T1),
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        // 4. Add Initial Liquidity
        lpRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -600,
                tickUpper: 600,
                liquidityDelta: 10_000 ether,
                salt: bytes32(0)
            }),
            new bytes(0)
        );

        // 5. Execute Test Swap
        swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: true,
                amountSpecified: -1 ether,
                sqrtPriceLimitX96: 4295128739 + 1
            }),
            PoolSwapTest.TestSettings({
                takeClaims: false,
                settleUsingBurn: false
            }),
            new bytes(0)
        );

        vm.stopBroadcast();

        console2.log("=== LIQUIDITY ADDED & TEST SWAP EXECUTED ===");
        console2.log("PoolModifyLiquidityTest:", address(lpRouter));
        console2.log("PoolSwapTest (SwapRouter):", address(swapRouter));
    }
}
