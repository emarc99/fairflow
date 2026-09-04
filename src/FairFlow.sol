// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@openzeppelin/uniswap-hooks/src/base/BaseHook.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {IPoolManager, SwapParams} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

import {FlowDebtMath} from "./libraries/FlowDebtMath.sol";
import {FairFlowTypes} from "./types/FairFlowTypes.sol";

/// @title FairFlow
/// @notice Two-speed flow-debt pricing for Uniswap v4 dynamic-fee pools.
/// @dev Prices pool-level flow externalities without trader identity or an external oracle.
contract FairFlow is BaseHook {
    using FlowDebtMath for int64;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    uint24 public constant MIN_FEE = 100; // 1 bp
    uint24 public constant BASE_FEE = 500; // 5 bps
    uint24 public constant MAX_FEE = 10_000; // 100 bps

    uint24 public constant VOLATILITY_FEE_PER_TICK = 6;
    uint24 public constant CONGESTION_FEE_PER_TICK = 8;
    uint24 public constant REVERSAL_FEE_PER_TICK = 15;
    uint24 public constant MATURE_RISK_FEE_PER_TICK = 4;
    uint24 public constant COUNTERFLOW_DISCOUNT_PER_TICK = 3;

    uint24 public constant MAX_VOLATILITY_PREMIUM = 2_500;
    uint24 public constant MAX_FLOW_PREMIUM = 7_000;
    uint24 public constant MAX_COUNTERFLOW_DISCOUNT = 300;

    uint16 public constant EMA_ALPHA_BPS = 2_500;
    uint16 public constant DEBT_DECAY_BPS = 8_500;
    uint16 public constant VOLATILITY_DECAY_BPS = 8_500;
    int64 public constant MAX_TRACKED_TICKS = 20_000;

    mapping(PoolId poolId => FairFlowTypes.FlowState state) private _flowStates;

    event FairFlowAssessment(
        PoolId indexed poolId,
        bool indexed zeroForOne,
        FairFlowTypes.FeeMode mode,
        uint24 finalFee,
        uint24 volatilityPremium,
        uint24 flowPremium,
        uint24 counterflowDiscount,
        int64 blockDebt,
        int64 matureDebt
    );

    event FlowDebtUpdated(
        PoolId indexed poolId, int24 tickBefore, int24 tickAfter, int64 blockDebt, uint64 volatilityEma
    );

    error NotDynamicFee();

    constructor(IPoolManager _poolManager) BaseHook(_poolManager) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    /// @notice Returns the stored state without applying a pending block transition.
    function getFlowState(PoolId poolId) external view returns (FairFlowTypes.FlowState memory) {
        return _flowStates[poolId];
    }

    /// @notice Router- and UI-friendly directional fee preview at the current block.
    /// @dev The returned effective state includes decay and maturation that the next swap will apply.
    function previewFee(PoolKey calldata key, bool zeroForOne)
        external
        view
        returns (FairFlowTypes.FeeBreakdown memory breakdown, FairFlowTypes.FlowState memory effectiveState)
    {
        effectiveState = _previewRolledState(_flowStates[key.toId()]);
        breakdown = _calculateFee(effectiveState, zeroForOne);
    }

    function _afterInitialize(address, PoolKey calldata key, uint160, int24) internal pure override returns (bytes4) {
        if (!LPFeeLibrary.isDynamicFee(key.fee)) revert NotDynamicFee();
        return BaseHook.afterInitialize.selector;
    }

    function _beforeSwap(address sender, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        internal
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        uint24 fee = _getFee(sender, key, params, hookData);
        return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, fee | LPFeeLibrary.OVERRIDE_FEE_FLAG);
    }

    function _getFee(address, PoolKey calldata key, SwapParams calldata params, bytes calldata)
        internal
        returns (uint24)
    {
        PoolId poolId = key.toId();
        FairFlowTypes.FlowState storage state = _flowStates[poolId];
        _rollState(state);

        (, int24 tick,,) = poolManager.getSlot0(poolId);
        state.preSwapTick = tick;

        FairFlowTypes.FeeBreakdown memory breakdown = _calculateFee(state, params.zeroForOne);
        state.lastFee = breakdown.finalFee;

        emit FairFlowAssessment(
            poolId,
            params.zeroForOne,
            breakdown.mode,
            breakdown.finalFee,
            breakdown.volatilityPremium,
            breakdown.flowPremium,
            breakdown.counterflowDiscount,
            state.blockDebt,
            state.matureDebt
        );

        return breakdown.finalFee;
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal
        override
        returns (bytes4, int128)
    {
        PoolId poolId = key.toId();
        FairFlowTypes.FlowState storage state = _flowStates[poolId];
        (, int24 tickAfter,,) = poolManager.getSlot0(poolId);

        int256 movement = int256(tickAfter) - int256(state.preSwapTick);
        state.blockDebt = FlowDebtMath.clampSigned(int256(state.blockDebt) + movement, MAX_TRACKED_TICKS);

        uint64 absoluteMovement = uint64(uint256(movement < 0 ? -movement : movement));
        state.volatilityEma = FlowDebtMath.ewma(state.volatilityEma, absoluteMovement, EMA_ALPHA_BPS);

        emit FlowDebtUpdated(poolId, state.preSwapTick, tickAfter, state.blockDebt, state.volatilityEma);
        return (BaseHook.afterSwap.selector, 0);
    }

    function _rollState(FairFlowTypes.FlowState storage state) internal {
        uint64 currentBlock = uint64(block.number);
        if (state.lastBlock == 0) {
            state.lastBlock = currentBlock;
            return;
        }
        if (currentBlock == state.lastBlock) return;

        uint256 elapsed = currentBlock - state.lastBlock;
        int64 oldMature = FlowDebtMath.decay(state.matureDebt, DEBT_DECAY_BPS, elapsed);
        int64 newlyMatured = FlowDebtMath.decay(state.blockDebt, DEBT_DECAY_BPS, elapsed - 1);

        state.matureDebt = FlowDebtMath.clampSigned(int256(oldMature) + int256(newlyMatured), MAX_TRACKED_TICKS);
        state.blockDebt = 0;
        state.volatilityEma = FlowDebtMath.decayUnsigned(state.volatilityEma, VOLATILITY_DECAY_BPS, elapsed);
        state.lastBlock = currentBlock;
    }

    function _previewRolledState(FairFlowTypes.FlowState memory state)
        internal
        view
        returns (FairFlowTypes.FlowState memory)
    {
        uint64 currentBlock = uint64(block.number);
        if (state.lastBlock == 0) {
            state.lastBlock = currentBlock;
            return state;
        }
        if (currentBlock == state.lastBlock) return state;

        uint256 elapsed = currentBlock - state.lastBlock;
        int64 oldMature = FlowDebtMath.decay(state.matureDebt, DEBT_DECAY_BPS, elapsed);
        int64 newlyMatured = FlowDebtMath.decay(state.blockDebt, DEBT_DECAY_BPS, elapsed - 1);

        state.matureDebt = FlowDebtMath.clampSigned(int256(oldMature) + int256(newlyMatured), MAX_TRACKED_TICKS);
        state.blockDebt = 0;
        state.volatilityEma = FlowDebtMath.decayUnsigned(state.volatilityEma, VOLATILITY_DECAY_BPS, elapsed);
        state.lastBlock = currentBlock;
        return state;
    }

    function _calculateFee(FairFlowTypes.FlowState memory state, bool zeroForOne)
        internal
        pure
        returns (FairFlowTypes.FeeBreakdown memory result)
    {
        int8 direction = zeroForOne ? int8(-1) : int8(1);
        result.baseFee = BASE_FEE;
        result.mode = FairFlowTypes.FeeMode.Calm;

        result.volatilityPremium =
            uint24(_min(uint256(state.volatilityEma) * VOLATILITY_FEE_PER_TICK, MAX_VOLATILITY_PREMIUM));

        uint256 flowPremium;
        uint256 discount;

        if (state.blockDebt != 0) {
            uint256 blockMagnitude = state.blockDebt.abs();
            if (state.blockDebt.sameSign(direction)) {
                result.mode = FairFlowTypes.FeeMode.Congestion;
                flowPremium += blockMagnitude * CONGESTION_FEE_PER_TICK;
            } else {
                result.mode = FairFlowTypes.FeeMode.Reversal;
                flowPremium += blockMagnitude * REVERSAL_FEE_PER_TICK;
            }
        } else if (state.matureDebt != 0 && !state.matureDebt.sameSign(direction)) {
            result.mode = FairFlowTypes.FeeMode.Counterflow;
            discount = uint256(state.matureDebt.abs()) * COUNTERFLOW_DISCOUNT_PER_TICK;
        }

        if (state.matureDebt.sameSign(direction)) {
            if (result.mode == FairFlowTypes.FeeMode.Calm) result.mode = FairFlowTypes.FeeMode.MatureRisk;
            flowPremium += uint256(state.matureDebt.abs()) * MATURE_RISK_FEE_PER_TICK;
        }

        result.flowPremium = uint24(_min(flowPremium, MAX_FLOW_PREMIUM));
        result.counterflowDiscount = uint24(_min(discount, MAX_COUNTERFLOW_DISCOUNT));

        uint256 grossFee = uint256(BASE_FEE) + result.volatilityPremium + result.flowPremium;
        uint256 discountedFee = grossFee > result.counterflowDiscount ? grossFee - result.counterflowDiscount : 0;
        result.finalFee = uint24(_min(_max(discountedFee, MIN_FEE), MAX_FEE));
    }

    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }

    function _max(uint256 a, uint256 b) private pure returns (uint256) {
        return a > b ? a : b;
    }
}
