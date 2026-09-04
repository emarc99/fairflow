# FairFlow

**Two-speed flow-debt pricing for Uniswap v4.** Same-block directional congestion and reversals pay more, while delayed counterflow that repairs mature imbalance pays less.

FairFlow is an oracle-free dynamic LP fee hook built for the Atrium Academy UHI10 Hookathon. It prices observable pool-level flow externalities rather than guessing trader identity.

## Why it is different

Ordinary directional-fee hooks can accidentally discount the back-run of a sandwich because the back-run reverses direction. FairFlow separates flow into two clocks:

- current-block debt receives congestion or reversal premiums;
- prior-block debt becomes mature and can earn a counterflow discount;
- volatility and mature debt decay during inactivity.

A same-block reversal can therefore never receive the restorative-flow discount.

## Hook lifecycle

- `afterInitialize` rejects non-dynamic-fee pools.
- `beforeSwap` matures/decays debt and returns a bounded per-swap fee override.
- `afterSwap` records realized tick movement and updates volatility.

The hook uses canonical v4 swaps and LP fee accounting. It takes no custody, returns no custom deltas, has no owner, and uses no allowlist or external oracle.

## Base Sepolia Live Deployment & On-Chain Verification

FairFlow is deployed live on **Base Sepolia** (Chain ID: `84532`) with dynamic fees and real on-chain flow debt tracking:

| Contract / Resource | Address / ID | Explorer Link |
|---|---|---|
| **FairFlow Hook** (Flags: `0x10C0`) | `0x984439E305dD17e7a16f2aAf876d99d9D7C710c0` | [BaseScan](https://sepolia.basescan.org/address/0x984439E305dD17e7a16f2aAf876d99d9D7C710c0) |
| **Uniswap v4 PoolManager** | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | [BaseScan](https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408) |
| **SwapRouter (PoolSwapTest)** | `0xc19922f7F21d96472FDee81d67636293c4c05Eee` | [BaseScan](https://sepolia.basescan.org/address/0xc19922f7F21d96472FDee81d67636293c4c05Eee) |
| **Token0 (fUSD)** | `0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E` | [BaseScan](https://sepolia.basescan.org/address/0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E) |
| **Token1 (fETH)** | `0x9693aAd2540D75057D0CDce4c16891230D335A6B` | [BaseScan](https://sepolia.basescan.org/address/0x9693aAd2540D75057D0CDce4c16891230D335A6B) |
| **Pool ID** | `0xbba6de280d0e89c085a89e01d0782dd155c2efca422a005af78e54b3f877af6e` | — |

### Proven On-Chain Transactions

Real MetaMask-signed swaps demonstrating FairFlow's dynamic pricing in action:

- **Calm Mode (5.00 bp baseline):** [`0x3afabd...`](https://sepolia.basescan.org/tx/0x3afabddace5c27a1f45116f57c6c384f5787bc88e87caa01b699657e6f2218ae) — baseline swap with zero prior debt.
- **Congestion Mode (5.30 bp):** [`0x72ace9...`](https://sepolia.basescan.org/tx/0x72ace9fe09d37c7560bdda6237cb51e4f95147cc7eef8446b0e966452175f93a) — directional buy accumulates `blockDebt`, raising the dynamic fee.
- **Congestion Escalating (5.34 bp):** [`0x931c22...`](https://sepolia.basescan.org/tx/0x931c223a9a1ad754ccf13c2579cc86ba5a804e12bcc7da54a47620561ed4b6c2) — repeated directional pressure further hikes the LP fee.
- **Counterflow Discount (4.61 bp):** [`0xf6a925...`](https://sepolia.basescan.org/tx/0xf6a925b23073060a34871036542885d93432f673ebb1b8d7eb45519ad5cd0e5a) — opposing sell repays accumulated flow debt, earning a discount below baseline!

## Interactive Web3 Dashboard

The repository includes a Next.js live dashboard in `frontend/` connected directly to Base Sepolia:
- **Live On-Chain Swap Feed:** real-time event indexing from PoolManager logs.
- **Interactive Swapper & Faucet:** mint test tokens and test live swaps directly via MetaMask.
- **One-Click Attack Visualizers:** test congestion bursts, sandwich reversals, and counterflow trades.
- **Dynamic Fee Breakdown:** real-time inspection of base fee, congestion premium, and counterflow discount.

To run the dashboard locally:
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) with MetaMask connected to Base Sepolia.

## Build and test

Requirements: Foundry stable.

```bash
forge build
forge test -vv
forge coverage --report summary
forge test --gas-report
```

The tests execute through a real local `PoolManager`, `PositionManager`, swap router, and canonical `V4Quoter`.

## Local deployment

Start Anvil and deploy the local v4 stack:

```bash
anvil
forge script script/testing/00_DeployV4.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
forge script script/00_DeployHook.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Set the deployed hook address before creating the dynamic-fee pool or swapping:

```bash
export HOOK_ADDRESS=<DEPLOYED_FAIRFLOW_ADDRESS>
forge script script/01_CreatePoolAndAddLiquidity.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
forge script script/03_Swap.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

Use a keystore/account rather than putting production private keys in command history.

## Key files

- `src/FairFlow.sol`: hook lifecycle, state machine and explainable fee API.
- `src/libraries/FlowDebtMath.sol`: bounded EMA and fixed-point decay.
- `test/FairFlow.t.sol`: PoolManager, router, quoter, fuzz and edge-case tests.
- `script/00_DeployHook.s.sol`: CREATE2 hook-address mining and deployment.

## Router support

The canonical v4 `V4Quoter` can quote FairFlow pools when supplied their `PoolKey`; this is covered by `testCanonicalV4QuoterCanQuoteFairFlowAndDoesNotPersistState`. The Uniswap web interface should not be described as natively routing the pool because FairFlow uses dynamic fees.

## Partner integrations

**No partner integrations.** FairFlow integrates Uniswap v4 core, periphery and OpenZeppelin's BaseHook implementation as protocol dependencies, not as claimed sponsor-track integrations.

## Scope and limitations

FairFlow mitigates LP exposure to directional congestion and increases the cost of same-block reversals. It does not claim universal MEV elimination, trader classification, or knowledge of an external fair price. Results are reported only when reproduced by committed tests.

## License

MIT. Dependency licenses remain governed by their respective repositories.
