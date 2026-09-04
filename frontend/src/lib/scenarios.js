/**
 * Scenario definitions for FairFlow demo.
 * Each scenario is a sequence of swap steps matching FairFlow demonstration cases.
 *
 * Each step: { label, zeroForOne, tickMovement, newBlock?, description }
 *   - newBlock: if true, advance block number before this swap
 *   - tickMovement: signed tick change (negative for zeroForOne by convention)
 */

export const scenarios = [
  {
    id: 'calm',
    name: 'Calm Retail Flow',
    icon: '🌊',
    description: 'Alternating small swaps from typical retail users. FairFlow charges baseline fees — no congestion, no premium.',
    steps: [
      { label: 'Buy 0.5 ETH',  zeroForOne: true,  tickMovement: -3,  description: 'Small buy — calm baseline fee' },
      { label: 'Sell 0.4 ETH',  zeroForOne: false, tickMovement: 2,   newBlock: true, description: 'Small sell next block — counterflow discount possible' },
      { label: 'Buy 0.3 ETH',  zeroForOne: true,  tickMovement: -2,  newBlock: true, description: 'Another calm buy' },
      { label: 'Sell 0.6 ETH',  zeroForOne: false, tickMovement: 3,   newBlock: true, description: 'Moderate sell — still calm' },
      { label: 'Buy 0.2 ETH',  zeroForOne: true,  tickMovement: -1,  newBlock: true, description: 'Tiny buy — minimal impact' },
      { label: 'Sell 0.3 ETH',  zeroForOne: false, tickMovement: 2,   newBlock: true, description: 'Small sell — calm conditions persist' },
    ],
  },
  {
    id: 'directional-burst',
    name: 'Directional Burst',
    icon: '📈',
    description: 'Repeated same-direction swaps within a single block — simulating an informed trader or arb. Congestion premium escalates.',
    steps: [
      { label: 'Arb buy #1',    zeroForOne: true, tickMovement: -8,   description: 'First large buy — begins building block debt' },
      { label: 'Arb buy #2',    zeroForOne: true, tickMovement: -10,  description: 'Second buy same block — congestion premium kicks in' },
      { label: 'Arb buy #3',    zeroForOne: true, tickMovement: -12,  description: 'Third buy — congestion escalates further' },
      { label: 'Arb buy #4',    zeroForOne: true, tickMovement: -8,   description: 'Fourth buy — premium near maximum' },
      { label: 'Arb buy #5',    zeroForOne: true, tickMovement: -6,   description: 'Fifth buy — LP protection maximized' },
    ],
  },
  {
    id: 'stale-arb',
    name: 'Stale-Price Arbitrage',
    icon: '⚡',
    description: 'An arbitrageur detects a stale price and pushes a large directional correction. FairFlow escalates fees to protect LPs.',
    steps: [
      { label: 'Arb push #1',   zeroForOne: true,  tickMovement: -15, description: 'Massive buy exploiting stale price' },
      { label: 'Arb push #2',   zeroForOne: true,  tickMovement: -12, description: 'Follow-up — congestion premium high' },
      { label: 'Arb push #3',   zeroForOne: true,  tickMovement: -8,  description: 'Final push — max flow premium' },
      { label: 'Market recovers', zeroForOne: false, tickMovement: 10, newBlock: true, description: 'Next block sell — counterflow discount rewards repair' },
      { label: 'More recovery',  zeroForOne: false, tickMovement: 8,  description: 'Continued repair — discount applied' },
    ],
  },
  {
    id: 'sandwich',
    name: 'Sandwich Attack',
    icon: '🥪',
    description: 'Classic MEV sandwich: front-run → victim swap → back-run. FairFlow makes the same-block reversal expensive.',
    steps: [
      { label: '🔴 Front-run',   zeroForOne: true,  tickMovement: -12, description: 'Attacker buys before victim — begins building debt' },
      { label: '🟡 Victim swap',  zeroForOne: true,  tickMovement: -5,  description: 'Victim buys at worse price — congestion premium active' },
      { label: '🔴 Back-run',    zeroForOne: false, tickMovement: 14,  description: 'Attacker sells same block — REVERSAL PREMIUM, no counterflow discount!' },
      { label: 'Next block calm', zeroForOne: true,  tickMovement: -2,  newBlock: true, description: 'Next block — debt matures, fees normalize' },
    ],
  },
  {
    id: 'fragmentation',
    name: 'Trade Fragmentation',
    icon: '🧩',
    description: 'A trader splits a large order into many small swaps hoping to avoid detection. FairFlow tracks cumulative block debt — splitting doesn\'t help.',
    steps: [
      { label: 'Fragment #1',  zeroForOne: true, tickMovement: -3,  description: 'Small piece — debt begins accumulating' },
      { label: 'Fragment #2',  zeroForOne: true, tickMovement: -3,  description: 'Another piece — congestion builds' },
      { label: 'Fragment #3',  zeroForOne: true, tickMovement: -3,  description: 'Third piece — premium escalates' },
      { label: 'Fragment #4',  zeroForOne: true, tickMovement: -3,  description: 'Fourth piece — cumulative debt is significant' },
      { label: 'Fragment #5',  zeroForOne: true, tickMovement: -3,  description: 'Fifth piece — same total cost as one large swap' },
      { label: 'Fragment #6',  zeroForOne: true, tickMovement: -3,  description: 'Sixth piece — fragmentation offers no escape' },
    ],
  },
  {
    id: 'counterflow',
    name: 'Restorative Counterflow',
    icon: '💚',
    description: 'After a directional burst, a later-block counterflow repairs the pool\'s imbalance and earns a fee discount. This is FairFlow\'s carrot.',
    steps: [
      { label: 'Push buy #1',     zeroForOne: true,  tickMovement: -10, description: 'Large buy — builds block debt' },
      { label: 'Push buy #2',     zeroForOne: true,  tickMovement: -8,  description: 'More buying pressure' },
      { label: 'Block passes',    zeroForOne: false, tickMovement: 5,   newBlock: true, description: 'Next block: sell repairs mature debt — COUNTERFLOW DISCOUNT!' },
      { label: 'More repair',     zeroForOne: false, tickMovement: 4,   description: 'Further repair — discount continues' },
      { label: 'Another block',   zeroForOne: false, tickMovement: 3,   newBlock: true, description: 'Continued repair in a new block' },
      { label: 'Full recovery',   zeroForOne: false, tickMovement: 2,   newBlock: true, description: 'Pool nearly balanced — fees approaching baseline' },
    ],
  },
  {
    id: 'multi-pool',
    name: 'Multi-Pool Activity',
    icon: '🔀',
    description: 'Activity in one pool does not affect another. State isolation demonstrated.',
    steps: [
      { label: 'Pool A: big buy',    zeroForOne: true,  tickMovement: -12, pool: 'A', description: 'Pool A gets heavy buy pressure' },
      { label: 'Pool B: small buy',  zeroForOne: true,  tickMovement: -2,  pool: 'B', description: 'Pool B: independent, calm activity' },
      { label: 'Pool A: buy #2',     zeroForOne: true,  tickMovement: -8,  pool: 'A', description: 'Pool A: congestion escalates' },
      { label: 'Pool B: sell',       zeroForOne: false, tickMovement: 3,   pool: 'B', description: 'Pool B: still calm, no cross-contamination' },
      { label: 'Pool A: reversal',   zeroForOne: false, tickMovement: 10,  pool: 'A', description: 'Pool A: reversal premium — Pool B unaffected' },
      { label: 'Pool B: buy',        zeroForOne: true,  tickMovement: -1,  pool: 'B', description: 'Pool B: baseline fee, completely isolated' },
    ],
  },
];

export function getScenario(id) {
  return scenarios.find(s => s.id === id) || scenarios[0];
}
