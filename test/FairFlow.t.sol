// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {CurrencyLibrary, Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";
import {IPositionManager} from "@uniswap/v4-periphery/src/interfaces/IPositionManager.sol";
import {IV4Quoter} from "@uniswap/v4-periphery/src/interfaces/IV4Quoter.sol";
import {V4Quoter} from "@uniswap/v4-periphery/src/lens/V4Quoter.sol";
import {Constants} from "@uniswap/v4-core/test/utils/Constants.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";

import {EasyPosm} from "./utils/libraries/EasyPosm.sol";
import {FairFlow} from "../src/FairFlow.sol";
import {FairFlowTypes} from "../src/types/FairFlowTypes.sol";
import {BaseTest} from "./utils/BaseTest.sol";

contract FairFlowTest is BaseTest {
    using EasyPosm for IPositionManager;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;

    Currency internal currency0;
    Currency internal currency1;
    PoolKey internal poolKey;
    PoolKey internal vanillaKey;
    FairFlow internal hook;
    PoolId internal poolId;

    function setUp() public {
        deployArtifactsAndLabel();
        (currency0, currency1) = deployCurrencyPair();

        address flags = address(
            uint160(Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG) ^ (0xF1F0 << 144)
        );
        deployCodeTo("FairFlow.sol:FairFlow", abi.encode(poolManager), flags);
        hook = FairFlow(flags);

        poolKey = PoolKey(currency0, currency1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolId = poolKey.toId();
        poolManager.initialize(poolKey, Constants.SQRT_PRICE_1_1);

        int24 tickLower = TickMath.minUsableTick(poolKey.tickSpacing);
        int24 tickUpper = TickMath.maxUsableTick(poolKey.tickSpacing);
        uint128 liquidityAmount = 100e18;

        (uint256 amount0Expected, uint256 amount1Expected) = LiquidityAmounts.getAmountsForLiquidity(
            Constants.SQRT_PRICE_1_1,
            TickMath.getSqrtPriceAtTick(tickLower),
            TickMath.getSqrtPriceAtTick(tickUpper),
            liquidityAmount
        );

        positionManager.mint(
            poolKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            amount0Expected + 1,
            amount1Expected + 1,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );

        vanillaKey = PoolKey(currency0, currency1, hook.BASE_FEE(), 60, IHooks(address(0)));
        poolManager.initialize(vanillaKey, Constants.SQRT_PRICE_1_1);
        positionManager.mint(
            vanillaKey,
            tickLower,
            tickUpper,
            liquidityAmount,
            amount0Expected + 1,
            amount1Expected + 1,
            address(this),
            block.timestamp,
            Constants.ZERO_BYTES
        );
    }

    function testInitialQuoteIsCalmBaseline() public view {
        (FairFlowTypes.FeeBreakdown memory quote, FairFlowTypes.FlowState memory state) = hook.previewFee(poolKey, true);

        assertEq(quote.finalFee, hook.BASE_FEE());
        assertEq(uint8(quote.mode), uint8(FairFlowTypes.FeeMode.Calm));
        assertEq(state.blockDebt, 0);
        assertEq(state.matureDebt, 0);
    }

    function testRejectsStaticFeePool() public {
        PoolKey memory staticFeeKey = PoolKey(currency0, currency1, 3_000, 60, IHooks(hook));
        // PoolManager wraps hook errors with the hook address and callback selector.
        vm.expectRevert();
        poolManager.initialize(staticFeeKey, Constants.SQRT_PRICE_1_1);
    }

    function testCanonicalV4QuoterCanQuoteFairFlowAndDoesNotPersistState() public {
        V4Quoter quoter = new V4Quoter(poolManager);
        FairFlowTypes.FlowState memory beforeState = hook.getFlowState(poolId);

        (uint256 amountOut, uint256 gasEstimate) = quoter.quoteExactInputSingle(
            IV4Quoter.QuoteExactSingleParams({
                poolKey: poolKey, zeroForOne: true, exactAmount: 1e18, hookData: Constants.ZERO_BYTES
            })
        );

        FairFlowTypes.FlowState memory afterState = hook.getFlowState(poolId);
        assertGt(amountOut, 0);
        assertGt(gasEstimate, 0);
        assertEq(afterState.blockDebt, beforeState.blockDebt);
        assertEq(afterState.volatilityEma, beforeState.volatilityEma);
        assertEq(afterState.lastBlock, beforeState.lastBlock);
    }

    function testDirectionalBurstCapturesMoreFeesForLPsThanVanilla() public {
        _swap(true, 1e18);
        _swapOn(vanillaKey, true, 1e18);

        (uint256 fairBefore,) = poolManager.getFeeGrowthGlobals(poolId);
        (uint256 vanillaBefore,) = poolManager.getFeeGrowthGlobals(vanillaKey.toId());

        _swap(true, 1e18);
        _swapOn(vanillaKey, true, 1e18);

        (uint256 fairAfter,) = poolManager.getFeeGrowthGlobals(poolId);
        (uint256 vanillaAfter,) = poolManager.getFeeGrowthGlobals(vanillaKey.toId());

        assertGt(fairAfter - fairBefore, vanillaAfter - vanillaBefore);
    }

    function testSameBlockCongestionAndReversalArePricedDifferently() public {
        _swap(true, 1e18);

        FairFlowTypes.FlowState memory state = hook.getFlowState(poolId);
        assertLt(state.blockDebt, 0);
        assertGt(state.volatilityEma, 0);

        (FairFlowTypes.FeeBreakdown memory congestion,) = hook.previewFee(poolKey, true);
        (FairFlowTypes.FeeBreakdown memory reversal,) = hook.previewFee(poolKey, false);

        assertEq(uint8(congestion.mode), uint8(FairFlowTypes.FeeMode.Congestion));
        assertEq(uint8(reversal.mode), uint8(FairFlowTypes.FeeMode.Reversal));
        assertGt(reversal.flowPremium, congestion.flowPremium);
        assertGt(reversal.finalFee, congestion.finalFee);
    }

    function testCounterflowDiscountOnlyAfterDebtMatures() public {
        _swap(true, 1e18);

        (FairFlowTypes.FeeBreakdown memory sameBlockReverse,) = hook.previewFee(poolKey, false);
        assertEq(sameBlockReverse.counterflowDiscount, 0);
        assertEq(uint8(sameBlockReverse.mode), uint8(FairFlowTypes.FeeMode.Reversal));

        vm.roll(block.number + 1);

        (FairFlowTypes.FeeBreakdown memory restorative, FairFlowTypes.FlowState memory effectiveState) =
            hook.previewFee(poolKey, false);
        (FairFlowTypes.FeeBreakdown memory adverse,) = hook.previewFee(poolKey, true);

        assertEq(effectiveState.blockDebt, 0);
        assertLt(effectiveState.matureDebt, 0);
        assertEq(uint8(restorative.mode), uint8(FairFlowTypes.FeeMode.Counterflow));
        assertGt(restorative.counterflowDiscount, 0);
        assertLt(restorative.finalFee, adverse.finalFee);
    }

    function testPreviewAppliesLongInactivityDecayWithoutWriting() public {
        _swap(true, 1e18);
        FairFlowTypes.FlowState memory stored = hook.getFlowState(poolId);
        vm.roll(block.number + 20);

        (, FairFlowTypes.FlowState memory previewed) = hook.previewFee(poolKey, false);
        FairFlowTypes.FlowState memory stillStored = hook.getFlowState(poolId);

        assertLt(_abs(previewed.matureDebt), _abs(stored.blockDebt));
        assertEq(stillStored.blockDebt, stored.blockDebt);
        assertEq(stillStored.lastBlock, stored.lastBlock);
    }

    function testOnlyPoolManagerCanEnterCallbacks() public {
        SwapParams memory params =
            SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1});

        vm.expectRevert(BaseHook.NotPoolManager.selector);
        hook.afterSwap(address(this), poolKey, params, BalanceDeltaLibrary.ZERO_DELTA, Constants.ZERO_BYTES);
    }

    function testFeesRemainBoundedDuringRepeatedFlow() public {
        for (uint256 i; i < 12; ++i) {
            _swap(true, 1e18);
        }

        (FairFlowTypes.FeeBreakdown memory quote,) = hook.previewFee(poolKey, true);
        assertGe(quote.finalFee, hook.MIN_FEE());
        assertLe(quote.finalFee, hook.MAX_FEE());
    }

    function testStateIsIsolatedAcrossPools() public {
        (Currency other0, Currency other1) = deployCurrencyPair();
        PoolKey memory otherKey = PoolKey(other0, other1, LPFeeLibrary.DYNAMIC_FEE_FLAG, 60, IHooks(hook));
        poolManager.initialize(otherKey, Constants.SQRT_PRICE_1_1);

        _swap(true, 1e18);

        FairFlowTypes.FlowState memory active = hook.getFlowState(poolId);
        FairFlowTypes.FlowState memory untouched = hook.getFlowState(otherKey.toId());
        assertNotEq(active.blockDebt, 0);
        assertEq(untouched.blockDebt, 0);
        assertEq(untouched.matureDebt, 0);
    }

    function testFuzzFeeBoundsAfterArbitrarySwap(uint96 rawAmount, bool zeroForOne) public {
        uint256 amount = bound(uint256(rawAmount), 1e12, 2e18);
        _swap(zeroForOne, amount);

        (FairFlowTypes.FeeBreakdown memory sameDirection,) = hook.previewFee(poolKey, zeroForOne);
        (FairFlowTypes.FeeBreakdown memory reverseDirection,) = hook.previewFee(poolKey, !zeroForOne);

        assertGe(sameDirection.finalFee, hook.MIN_FEE());
        assertLe(sameDirection.finalFee, hook.MAX_FEE());
        assertGe(reverseDirection.finalFee, hook.MIN_FEE());
        assertLe(reverseDirection.finalFee, hook.MAX_FEE());
    }

    function _swap(bool zeroForOne, uint256 amountIn) internal returns (BalanceDelta) {
        return _swapOn(poolKey, zeroForOne, amountIn);
    }

    function _swapOn(PoolKey memory key, bool zeroForOne, uint256 amountIn) internal returns (BalanceDelta) {
        return swapRouter.swapExactTokensForTokens({
            amountIn: amountIn,
            amountOutMin: 0,
            zeroForOne: zeroForOne,
            poolKey: key,
            hookData: Constants.ZERO_BYTES,
            receiver: address(this),
            deadline: block.timestamp + 1
        });
    }

    function _abs(int64 value) private pure returns (uint64) {
        return uint64(value < 0 ? -value : value);
    }
}
