// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Bounded fixed-point helpers used by FairFlow's per-pool state machine.
library FlowDebtMath {
    uint256 internal constant BPS = 10_000;
    uint256 internal constant WAD = 1e18;

    function abs(int64 value) internal pure returns (uint64) {
        return uint64(value < 0 ? -value : value);
    }

    function sameSign(int64 value, int8 direction) internal pure returns (bool) {
        return value != 0 && ((value > 0 && direction > 0) || (value < 0 && direction < 0));
    }

    function clampSigned(int256 value, int64 limit) internal pure returns (int64) {
        if (value > limit) return limit;
        if (value < -int256(limit)) return -limit;
        return int64(value);
    }

    function ewma(uint64 previous, uint64 observation, uint16 alphaBps) internal pure returns (uint64) {
        uint256 weighted = uint256(previous) * (BPS - alphaBps) + uint256(observation) * alphaBps;
        return uint64(weighted / BPS);
    }

    /// @notice Applies a per-period BPS decay with exponentiation by squaring.
    function decay(int64 value, uint16 factorBps, uint256 periods) internal pure returns (int64) {
        if (value == 0 || periods == 0) return value;

        uint256 factor = _powWad(uint256(factorBps) * 1e14, periods);
        uint256 decayed = uint256(abs(value)) * factor / WAD;
        return value < 0 ? -int64(uint64(decayed)) : int64(uint64(decayed));
    }

    function decayUnsigned(uint64 value, uint16 factorBps, uint256 periods) internal pure returns (uint64) {
        if (value == 0 || periods == 0) return value;
        uint256 factor = _powWad(uint256(factorBps) * 1e14, periods);
        return uint64(uint256(value) * factor / WAD);
    }

    function _powWad(uint256 base, uint256 exponent) private pure returns (uint256 result) {
        result = WAD;
        while (exponent != 0) {
            if (exponent & 1 != 0) result = result * base / WAD;
            exponent >>= 1;
            if (exponent != 0) base = base * base / WAD;
        }
    }
}
