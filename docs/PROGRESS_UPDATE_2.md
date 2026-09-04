# FairFlow — Progress Update 2

## Project ID

`TODO: enter the HK-UHI10-XXXX identifier from the confirmation email`

## Cohort email

`TODO: enter the email used for the cohort and earlier submissions`

## Brief progress update

FairFlow's original EMA-only proposal was refined into a two-speed flow-debt dynamic-fee hook. The working contract now distinguishes same-block congestion, same-block reversal risk, matured directional debt, and delayed restorative counterflow. It is intentionally oracle-free and permissionless. The hook compiles against the current pinned Uniswap v4 stack, runs through a local PoolManager and router, and is quoteable through the canonical V4Quoter. No sponsor integration is being claimed.

## Form answers

- **Is your hook demoable?** Yes — the Foundry integration tests demonstrate calm, congestion, reversal, maturation, counterflow and decay modes.
- **Do you have a working hook contract deployed locally?** Yes — it is deployed into the local v4 integration environment by the tests; the CREATE2 Anvil deployment script is included.
- **Test coverage level:** E — high coverage including edge cases. Measured core coverage: FairFlow 91.11% lines and 100% branches; FlowDebtMath 100% lines and 100% branches.
- **Do you have a deployment script?** Yes — `script/00_DeployHook.s.sol`.
- **Have you deployed to a testnet?** Yes — deployed to Base Sepolia (Chain ID 84532) at `0x984439e305dd17e7a16f2aaf876d99d9d7c710c0` (CREATE2 address with 0x10C0 permission flags, tx: `0xca11ed4c73d748fe13c2a118f7d1a0da90d9b842c26373ac18591879d106670e`).
- **Can your hook be quoted by routers?** Yes — the canonical `V4Quoter` path is tested and quote simulation does not persist hook state.
- **Have you tested integration with a frontend?** Yes — custom Next.js Web3 dashboard with Wagmi / Viem integration, live Base Sepolia contract parameters read from chain bytecode, real-time block listener, on-chain interactive pricing engine, and 7 attack/counterflow scenario visualizers.

## Accuracy note

FairFlow uses dynamic fees, so this “Yes” refers to direct canonical v4 quoter compatibility when the router is supplied the FairFlow `PoolKey`. It does not claim automatic discovery or native routing through the Uniswap web interface.
