// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

library FairFlowTypes {
    /// @notice Human-readable reason for the dominant fee adjustment.
    enum FeeMode {
        Calm,
        Congestion,
        Reversal,
        MatureRisk,
        Counterflow
    }

    /// @notice Per-pool state. Tick units make debt comparable in both swap directions.
    struct FlowState {
        int64 blockDebt;
        int64 matureDebt;
        uint64 volatilityEma;
        uint64 lastBlock;
        int24 preSwapTick;
        uint24 lastFee;
    }

    /// @notice Explainable fee components, all denominated in Uniswap v4 fee pips.
    struct FeeBreakdown {
        uint24 baseFee;
        uint24 volatilityPremium;
        uint24 flowPremium;
        uint24 counterflowDiscount;
        uint24 finalFee;
        FeeMode mode;
    }
}
