# FairFlow Verified Results

Results in this file come from committed Foundry tests or a local Anvil broadcast. No projected performance percentage is presented as measured data.

## Build and tests

- Compiler: Solidity 0.8.30
- Foundry: 1.8.1 stable
- Tests: 21 passing, 0 failing
- Fuzzing: 256 generated dynamic-fee swap cases per fuzz run
- Canonical `V4Quoter`: returns a non-zero quote and rolls back temporary hook state
- Vanilla comparison: a second same-direction FairFlow swap produces greater LP fee-growth than the same swap in a static 5-bps pool

## Core coverage

| Contract | Lines | Functions | Branches |
| --- | ---: | ---: | ---: |
| `src/FairFlow.sol` | 82/90 (91.11%) | 12/13 (92.31%) | 12/12 (100%) |
| `src/libraries/FlowDebtMath.sol` | 26/26 (100%) | 7/7 (100%) | 6/6 (100%) |

Generated deployment scripts and imported test helpers are excluded from the core-contract coverage claim.

## Local deployment evidence

FairFlow was broadcast successfully to a fresh Anvil chain (chain ID 31337):

- Hook: `0xcce735ca089eceeb5b5e1f171ed471d686c7d0c0`
- Transaction: `0xc65af6d55017410fa2a2607f2ada3c89ee1c1dc0a2d0f73f1daa074f16b18af3`
- Permission mask: `0x10c0` (`afterInitialize`, `beforeSwap`, `afterSwap`)
- Read-back check: `BASE_FEE()` returned `500` pips

This address belongs to an ephemeral local chain and is evidence of script functionality, not a persistent testnet deployment.

## Base Sepolia Live Deployment & Verified Transactions

FairFlow was deployed to Base Sepolia (Chain ID `84532`) and tested with live transactions:

- Hook Address: `0x984439E305dD17e7a16f2aAf876d99d9D7C710c0`
- Deployment Tx: `0xca11ed4c73d748fe13c2a118f7d1a0da90d9b842c26373ac18591879d106670e`
- Pool ID: `0xbba6de280d0e89c085a89e01d0782dd155c2efca422a005af78e54b3f877af6e`
- PoolManager: `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408`
- SwapRouter: `0xc19922f7F21d96472FDee81d67636293c4c05Eee`
- Token0 (fUSD): `0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E`
- Token1 (fETH): `0x9693aAd2540D75057D0CDce4c16891230D335A6B`

### Verified On-Chain Swaps
1. **Calm Mode (5.00 bp):** `0x3afabddace5c27a1f45116f57c6c384f5787bc88e87caa01b699657e6f2218ae` (Block 46269176) — baseline dynamic fee override.
2. **Congestion Mode (5.30 bp):** `0x72ace9fe09d37c7560bdda6237cb51e4f95147cc7eef8446b0e966452175f93a` (Block 46269180) — directional debt accrual increases fee.
3. **Congestion Escalating (5.34 bp):** `0x931c223a9a1ad754ccf13c2579cc86ba5a804e12bcc7da54a47620561ed4b6c2` (Block 46269188) — rapid sequential pressure hikes fee further.
4. **Counterflow Discount (4.61 bp):** `0xf6a925b23073060a34871036542885d93432f673ebb1b8d7eb45519ad5cd0e5a` (Block 46269192) — opposing trade repays flow debt, earning fee discount below 5.00 bp baseline.

## Reproduce

```bash
forge test -vv
forge coverage --report summary
forge test --gas-report
```

The principal behavioural tests are:

- `testSameBlockCongestionAndReversalArePricedDifferently`
- `testCounterflowDiscountOnlyAfterDebtMatures`
- `testDirectionalBurstCapturesMoreFeesForLPsThanVanilla`
- `testCanonicalV4QuoterCanQuoteFairFlowAndDoesNotPersistState`
- `testFuzzFeeBoundsAfterArbitrarySwap`
- `testStateIsIsolatedAcrossPools`
