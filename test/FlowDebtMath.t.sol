// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {FlowDebtMath} from "../src/libraries/FlowDebtMath.sol";

contract FlowDebtMathHarness {
    function clampSigned(int256 value, int64 limit) external pure returns (int64) {
        return FlowDebtMath.clampSigned(value, limit);
    }

    function decay(int64 value, uint16 factorBps, uint256 periods) external pure returns (int64) {
        return FlowDebtMath.decay(value, factorBps, periods);
    }

    function decayUnsigned(uint64 value, uint16 factorBps, uint256 periods) external pure returns (uint64) {
        return FlowDebtMath.decayUnsigned(value, factorBps, periods);
    }

    function sameSign(int64 value, int8 direction) external pure returns (bool) {
        return FlowDebtMath.sameSign(value, direction);
    }
}

contract FlowDebtMathTest is Test {
    FlowDebtMathHarness internal harness = new FlowDebtMathHarness();

    function testClampSignedCoversBothBoundsAndInterior() public view {
        assertEq(harness.clampSigned(25_000, 20_000), 20_000);
        assertEq(harness.clampSigned(-25_000, 20_000), -20_000);
        assertEq(harness.clampSigned(123, 20_000), 123);
    }

    function testDecayHandlesZeroPeriodsZeroValuesAndSigns() public view {
        assertEq(harness.decay(0, 8_500, 12), 0);
        assertEq(harness.decay(1_000, 8_500, 0), 1_000);
        assertEq(harness.decay(1_000, 8_500, 1), 850);
        assertEq(harness.decay(-1_000, 8_500, 1), -850);
        assertLt(harness.decay(1_000, 8_500, 10), 850);
    }

    function testUnsignedDecayHandlesNoOpAndCompounding() public view {
        assertEq(harness.decayUnsigned(0, 8_500, 4), 0);
        assertEq(harness.decayUnsigned(1_000, 8_500, 0), 1_000);
        assertEq(harness.decayUnsigned(1_000, 8_500, 1), 850);
        assertLt(harness.decayUnsigned(1_000, 8_500, 10), 850);
    }

    function testSameSignIsStrictAndZeroIsNeutral() public view {
        assertTrue(harness.sameSign(1, 1));
        assertTrue(harness.sameSign(-1, -1));
        assertFalse(harness.sameSign(1, -1));
        assertFalse(harness.sameSign(-1, 1));
        assertFalse(harness.sameSign(0, 1));
    }
}
