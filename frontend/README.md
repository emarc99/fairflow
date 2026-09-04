# FairFlow Web3 Dashboard & Protocol Explorer

An interactive Next.js Web3 application that interfaces directly with the **FairFlow Uniswap v4 Dynamic Fee Hook** deployed on **Base Sepolia** (Chain ID: `84532`).

The dashboard serves as an interactive testing environment and telemetry station for hackathon judges, liquidity providers, and researchers to verify FairFlow's two-speed flow-debt pricing in real time.

---

## Key Features

### 1. Live On-Chain Telemetry (Base Sepolia)
- **Real-Time Swap Feed:** Queries the canonical Uniswap v4 `PoolManager` (`0x05E73354...`) for `Swap` events using optimized `eth_getLogs` block chunking.
- **Dynamic Fee Classification:** Automatically categorizes each on-chain transaction into one of FairFlow's 5 operational states:
  - 🌊 **Calm Mode:** Baseline 5.00 bp fee for benign alternating flow.
  - 📈 **Congestion Mode:** Dynamic fee surcharge (e.g. 5.30 bp → 5.34 bp) penalizing rapid same-direction runs.
  - 🥪 **Reversal Mode:** 15 pips/tick penalty on toxic same-block reversals to neutralize sandwich back-runs.
  - ⏳ **Mature Risk Mode:** Elevated fees during volatile regimes.
  - 💚 **Counterflow Mode:** Dynamic fee discounts (e.g. 4.61 bp) rewarding trades that restore depleted pool inventory.
- **On-Chain Faucet:** 1-click test token minter (`1,000 fUSD` and `1,000 fETH`) allowing any tester with MetaMask on Base Sepolia to interact immediately.
- **Interactive Live Swapper:** Direct execution through Uniswap v4's `PoolSwapTest` router with automated ERC-20 allowance approvals and sqrt-price limit boundary enforcement.
- **One-Click Attack Tests:** Pre-configured buttons to execute real multi-swap sequences (Congestion bursts, Sandwich reversals, Restorative counterflow trades) on-chain.

### 2. Client-Side Simulation & Scenario Explorer
- **7 Pre-Built Flow Scenarios:**
  1. *Calm Retail Flow:* Alternating organic trades paying baseline fees.
  2. *Congestion Burst:* Multi-trade directional run driving fees to peak levels.
  3. *Sandwich Attack:* Front-run, victim swap, and penalized same-block back-run.
  4. *Stale-Price Arbitrage:* External CEX price shock absorption.
  5. *Restorative Counterflow:* Delayed opposing flow earning the counterflow rebate.
  6. *Volatility Clustering:* EMA volatility decay across blocks.
  7. *Multi-Pool Isolation:* Proving independent `PoolId` state encapsulation.
- **LP Value Capture Comparison:** Side-by-side benchmark measuring cumulative fee revenue in FairFlow vs. a static 5.00 bp vanilla pool.
- **Visual Debt Gauge:** Real-time dual-clock visualization of `blockDebt` (fast clock) and decayed `matureDebt` (slow clock).

---

## Contract Addresses (Base Sepolia — Chain ID: 84532)

| Contract | Address | Explorer |
|---|---|---|
| **FairFlow Hook** (`0x10C0` flags) | `0x984439E305dD17e7a16f2aAf876d99d9D7C710c0` | [BaseScan](https://sepolia.basescan.org/address/0x984439E305dD17e7a16f2aAf876d99d9D7C710c0) |
| **Uniswap v4 PoolManager** | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | [BaseScan](https://sepolia.basescan.org/address/0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408) |
| **PoolSwapTest (Router)** | `0xc19922f7F21d96472FDee81d67636293c4c05Eee` | [BaseScan](https://sepolia.basescan.org/address/0xc19922f7F21d96472FDee81d67636293c4c05Eee) |
| **Token0 (fUSD)** | `0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E` | [BaseScan](https://sepolia.basescan.org/address/0x3953E210A6F81BBe5d9cAA0BD2Cc89dED255f95E) |
| **Token1 (fETH)** | `0x9693aAd2540D75057D0CDce4c16891230D335A6B` | [BaseScan](https://sepolia.basescan.org/address/0x9693aAd2540D75057D0CDce4c16891230D335A6B) |
| **Active Pool ID** | `0xbba6de280d0e89c085a89e01d0782dd155c2efca422a005af78e54b3f877af6e` | Dynamic Fee Key |

---

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Web3 Layer:** [Viem](https://viem.sh/) & [Wagmi v2](https://wagmi.sh/)
- **Styling:** Bespoke Vanilla CSS design system (dark obsidian palette, glassmorphism, responsive micro-animations, zero external CSS dependencies)
- **Visualizations:** Custom SVG gauges, dynamic sparklines, and transaction explainers

---

## Getting Started

### Prerequisites
- Node.js 18.17+ or higher
- MetaMask or any EIP-1193 compatible Web3 wallet connected to **Base Sepolia**

### Installation

1. Navigate to the `frontend` directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Interacting on Base Sepolia
1. Click **Connect Wallet** in the top right toolbar. If your wallet is on another chain, click **Switch to Base Sepolia**.
2. Click **Mint 1,000 fUSD & fETH** on the Faucet card.
3. Switch between **Live On-Chain** and **Simulate Scenarios** to inspect real-time Base Sepolia swaps or test synthetic attack flows.
