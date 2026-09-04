/**
 * FairFlow Engine — 1:1 JavaScript port of FairFlow.sol + FlowDebtMath.sol
 *
 * All arithmetic mirrors the Solidity implementation exactly:
 * - Fees in "pips" (1 pip = 0.0001% = 1e-6)
 * - Debt in tick units (int64 range)
 * - EMA / decay using BPS (10 000) fixed-point
 * - powWad using WAD (1e18) exponentiation by squaring
 */

// ─── Constants (matching FairFlow.sol) ─────────────────────────────────────────

export const DEFAULTS = Object.freeze({
  MIN_FEE: 100,             // 1 bp
  BASE_FEE: 500,            // 5 bps
  MAX_FEE: 10_000,          // 100 bps

  VOLATILITY_FEE_PER_TICK: 6,
  CONGESTION_FEE_PER_TICK: 8,
  REVERSAL_FEE_PER_TICK: 15,
  MATURE_RISK_FEE_PER_TICK: 4,
  COUNTERFLOW_DISCOUNT_PER_TICK: 3,

  MAX_VOLATILITY_PREMIUM: 2_500,
  MAX_FLOW_PREMIUM: 7_000,
  MAX_COUNTERFLOW_DISCOUNT: 300,

  EMA_ALPHA_BPS: 2_500,
  DEBT_DECAY_BPS: 8_500,
  VOLATILITY_DECAY_BPS: 8_500,
  MAX_TRACKED_TICKS: 20_000,
});

// ─── Fee Modes ─────────────────────────────────────────────────────────────────

export const FeeMode = Object.freeze({
  Calm: 'Calm',
  Congestion: 'Congestion',
  Reversal: 'Reversal',
  MatureRisk: 'MatureRisk',
  Counterflow: 'Counterflow',
});

// ─── FlowDebtMath (mirrors FlowDebtMath.sol) ────────────────────────────────

const BPS = 10_000n;
const WAD = 1_000_000_000_000_000_000n; // 1e18

export function absVal(value) {
  return value < 0 ? -value : value;
}

export function sameSign(value, direction) {
  if (value === 0) return false;
  return (value > 0 && direction > 0) || (value < 0 && direction < 0);
}

export function clampSigned(value, limit) {
  if (value > limit) return limit;
  if (value < -limit) return -limit;
  return value;
}

export function ewma(previous, observation, alphaBps) {
  const weighted = previous * (BPS - BigInt(alphaBps)) + BigInt(observation) * BigInt(alphaBps);
  return Number(weighted / BPS);
}

function powWad(base, exponent) {
  let b = BigInt(base);
  let e = BigInt(exponent);
  let result = WAD;
  while (e !== 0n) {
    if ((e & 1n) !== 0n) result = result * b / WAD;
    e >>= 1n;
    if (e !== 0n) b = b * b / WAD;
  }
  return result;
}

export function decay(value, factorBps, periods) {
  if (value === 0 || periods === 0) return value;
  const factor = powWad(BigInt(factorBps) * 100_000_000_000_000n, BigInt(periods)); // factorBps * 1e14
  const magnitude = BigInt(absVal(value));
  const decayed = Number(magnitude * factor / WAD);
  return value < 0 ? -decayed : decayed;
}

export function decayUnsigned(value, factorBps, periods) {
  if (value === 0 || periods === 0) return value;
  const factor = powWad(BigInt(factorBps) * 100_000_000_000_000n, BigInt(periods));
  return Number(BigInt(value) * factor / WAD);
}

// ─── Flow State ────────────────────────────────────────────────────────────────

export function createFlowState() {
  return {
    blockDebt: 0,
    matureDebt: 0,
    volatilityEma: 0,
    lastBlock: 0,
    preSwapTick: 0,
    lastFee: 0,
  };
}

export function cloneState(state) {
  return { ...state };
}

// ─── State Rolling (mirrors FairFlow._rollState) ────────────────────────────

export function rollState(state, currentBlock, params = DEFAULTS) {
  if (state.lastBlock === 0) {
    state.lastBlock = currentBlock;
    return;
  }
  if (currentBlock === state.lastBlock) return;

  const elapsed = currentBlock - state.lastBlock;
  const oldMature = decay(state.matureDebt, params.DEBT_DECAY_BPS, elapsed);
  const newlyMatured = decay(state.blockDebt, params.DEBT_DECAY_BPS, elapsed - 1);

  state.matureDebt = clampSigned(oldMature + newlyMatured, params.MAX_TRACKED_TICKS);
  state.blockDebt = 0;
  state.volatilityEma = decayUnsigned(state.volatilityEma, params.VOLATILITY_DECAY_BPS, elapsed);
  state.lastBlock = currentBlock;
}

export function previewRolledState(state, currentBlock, params = DEFAULTS) {
  const copy = cloneState(state);
  rollState(copy, currentBlock, params);
  return copy;
}

// ─── Fee Calculation (mirrors FairFlow._calculateFee) ───────────────────────

export function calculateFee(state, zeroForOne, params = DEFAULTS) {
  const direction = zeroForOne ? -1 : 1;
  const result = {
    baseFee: params.BASE_FEE,
    volatilityPremium: 0,
    flowPremium: 0,
    counterflowDiscount: 0,
    finalFee: 0,
    mode: FeeMode.Calm,
  };

  result.volatilityPremium = Math.min(
    state.volatilityEma * params.VOLATILITY_FEE_PER_TICK,
    params.MAX_VOLATILITY_PREMIUM,
  );

  let flowPremium = 0;
  let discount = 0;

  if (state.blockDebt !== 0) {
    const blockMagnitude = absVal(state.blockDebt);
    if (sameSign(state.blockDebt, direction)) {
      result.mode = FeeMode.Congestion;
      flowPremium += blockMagnitude * params.CONGESTION_FEE_PER_TICK;
    } else {
      result.mode = FeeMode.Reversal;
      flowPremium += blockMagnitude * params.REVERSAL_FEE_PER_TICK;
    }
  } else if (state.matureDebt !== 0 && !sameSign(state.matureDebt, direction)) {
    result.mode = FeeMode.Counterflow;
    discount = absVal(state.matureDebt) * params.COUNTERFLOW_DISCOUNT_PER_TICK;
  }

  if (sameSign(state.matureDebt, direction)) {
    if (result.mode === FeeMode.Calm) result.mode = FeeMode.MatureRisk;
    flowPremium += absVal(state.matureDebt) * params.MATURE_RISK_FEE_PER_TICK;
  }

  result.flowPremium = Math.min(flowPremium, params.MAX_FLOW_PREMIUM);
  result.counterflowDiscount = Math.min(discount, params.MAX_COUNTERFLOW_DISCOUNT);

  const grossFee = params.BASE_FEE + result.volatilityPremium + result.flowPremium;
  const discountedFee = grossFee > result.counterflowDiscount ? grossFee - result.counterflowDiscount : 0;
  result.finalFee = Math.min(Math.max(discountedFee, params.MIN_FEE), params.MAX_FEE);

  return result;
}

// ─── Swap Simulation ───────────────────────────────────────────────────────────

/**
 * Simulates a single swap step, mirroring FairFlow's beforeSwap + afterSwap.
 *
 * @param {object} state   – mutable FlowState
 * @param {number} block   – current block number
 * @param {boolean} zeroForOne – swap direction
 * @param {number} tickMovement – signed tick change (negative for zeroForOne)
 * @param {object} params  – fee constants (defaults to DEFAULTS)
 * @returns {{ fee: object, stateBefore: object, stateAfter: object }}
 */
export function simulateSwap(state, block, zeroForOne, tickMovement, params = DEFAULTS) {
  const stateBefore = cloneState(state);

  // beforeSwap: roll state for new block
  rollState(state, block, params);
  state.preSwapTick = state.preSwapTick || 0;

  // Calculate fee
  const fee = calculateFee(state, zeroForOne, params);
  state.lastFee = fee.finalFee;

  // afterSwap: update block debt and volatility
  const movement = tickMovement;
  state.blockDebt = clampSigned(state.blockDebt + movement, params.MAX_TRACKED_TICKS);

  const absoluteMovement = absVal(movement);
  state.volatilityEma = ewma(BigInt(state.volatilityEma), absoluteMovement, params.EMA_ALPHA_BPS);
  state.preSwapTick = state.preSwapTick + movement;

  const stateAfter = cloneState(state);

  return { fee, stateBefore, stateAfter };
}

/**
 * Computes the static vanilla-pool fee for comparison.
 */
export function vanillaFee(params = DEFAULTS) {
  return {
    baseFee: params.BASE_FEE,
    volatilityPremium: 0,
    flowPremium: 0,
    counterflowDiscount: 0,
    finalFee: params.BASE_FEE,
    mode: FeeMode.Calm,
  };
}

/**
 * Converts a fee in pips to basis points (1 bp = 100 pips).
 */
export function pipsToBps(pips) {
  return pips / 100;
}

/**
 * Converts a fee in pips to percentage.
 */
export function pipsToPercent(pips) {
  return pips / 10_000;
}
