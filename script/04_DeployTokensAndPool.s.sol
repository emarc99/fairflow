// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {MockERC20} from "solmate/src/test/utils/mocks/MockERC20.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";
import {Actions} from "@uniswap/v4-periphery/src/libraries/Actions.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract DeployTokensAndPoolScript is Script {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant POSITION_MANAGER = 0x4B2C77d209D3405F41a037Ec6c77F7F5b8e2ca80;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant HOOK = 0x984439E305dD17e7a16f2aAf876d99d9D7C710c0;

    struct PoolDeployData {
        MockERC20 t0;
        MockERC20 t1;
        Currency c0;
        Currency c1;
        PoolKey key;
    }

    function run() external {
        vm.startBroadcast();

        PoolDeployData memory data;
        (data.t0, data.t1) = _deployTokens();
        data.c0 = Currency.wrap(address(data.t0));
        data.c1 = Currency.wrap(address(data.t1));

        data.key = PoolKey({
            currency0: data.c0,
            currency1: data.c1,
            fee: LPFeeLibrary.DYNAMIC_FEE_FLAG,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        // Initialize
        uint160 startingPrice = 2 ** 96;
        IPoolManager(POOL_MANAGER).initialize(data.key, startingPrice);

        // Approvals & Liquidity
        _addLiquidity(data.t0, data.t1, data.key, startingPrice);

        vm.stopBroadcast();

        console2.log("=== POOL CREATED SUCCESSFULLY ===");
        console2.log("Token0 (Currency0):", address(data.t0));
        console2.log("Token1 (Currency1):", address(data.t1));
        console2.log("PoolId:", vm.toString(PoolId.unwrap(data.key.toId())));
    }

    function _deployTokens() internal returns (MockERC20 t0, MockERC20 t1) {
        MockERC20 a = new MockERC20("FairFlow USD", "fUSD", 18);
        MockERC20 b = new MockERC20("FairFlow ETH", "fETH", 18);
        a.mint(msg.sender, 1_000_000 ether);
        b.mint(msg.sender, 1_000_000 ether);

        if (address(a) < address(b)) {
            return (a, b);
        } else {
            return (b, a);
        }
    }

    function _addLiquidity(
        MockERC20 t0,
        MockERC20 t1,
        PoolKey memory key,
        uint160 startingPrice
    ) internal {
        address deployer = msg.sender;
        t0.approve(PERMIT2, type(uint256).max);
        t1.approve(PERMIT2, type(uint256).max);
        IPermit2(PERMIT2).approve(address(t0), POSITION_MANAGER, type(uint160).max, type(uint48).max);
        IPermit2(PERMIT2).approve(address(t1), POSITION_MANAGER, type(uint160).max, type(uint48).max);

        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            startingPrice,
            TickMath.getSqrtPriceAtTick(-600),
            TickMath.getSqrtPriceAtTick(600),
            10_000 ether,
            10_000 ether
        );

        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP), uint8(Actions.SWEEP)
        );

        bytes[] memory mintParams = new bytes[](4);
        mintParams[0] = abi.encode(key, -600, 600, liquidity, 10_001 ether, 10_001 ether, deployer, bytes(""));
        mintParams[1] = abi.encode(key.currency0, key.currency1);
        mintParams[2] = abi.encode(key.currency0, deployer);
        mintParams[3] = abi.encode(key.currency1, deployer);

        bytes[] memory multicallParams = new bytes[](1);
        multicallParams[0] = abi.encodeWithSelector(
            IPositionManager.modifyLiquidities.selector,
            abi.encode(actions, mintParams),
            block.timestamp + 3600
        );

        IPositionManager(POSITION_MANAGER).multicall(multicallParams);
    }
}
