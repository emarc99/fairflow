# FairFlow Security Model

## Trust assumptions

FairFlow has no owner, allowlist, external oracle, keeper, token custody or upgradeable proxy. The immutable trust boundary is the configured Uniswap v4 `PoolManager`.

## Enforced properties

- Hook callbacks are restricted to `PoolManager` by `BaseHook`.
- Only pools marked with `DYNAMIC_FEE_FLAG` can initialize with FairFlow.
- Fee overrides remain within `MIN_FEE` and `MAX_FEE`.
- Same-block opposite flow is classified as reversal and cannot receive a counterflow discount.
- All state is keyed by `PoolId`.
- Debt and volatility use bounded values and fixed-point decay.
- Canonical quoter simulations revert their temporary state changes.

## Known limitations

- Flow debt is a pool-internal risk signal, not an external fair-price oracle.
- The hook cannot identify intent or distinguish retail users from searchers.
- A congestion premium can also affect legitimate correlated flow.
- Fee parameters are research defaults and require calibration against representative market data before production use.
- The mechanism raises the cost of same-block reversal patterns but does not guarantee sandwich prevention.

FairFlow is Hookathon research software and has not been audited for production deployment.
