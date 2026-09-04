'use client';

import FeeBadge from './ui/FeeBadge';
import { pipsToBps, FeeMode } from '@/lib/fairflow-engine';

const modeExplanations = {
  [FeeMode.Calm]: 'No significant directional pressure detected. The pool is in a balanced state and charges the baseline fee.',
  [FeeMode.Congestion]: 'Multiple same-direction swaps are building up within this block. FairFlow escalates the fee to protect LPs from directional pressure.',
  [FeeMode.Reversal]: 'This swap reverses direction within the same block — a pattern consistent with the back-run leg of a sandwich attack. FairFlow charges the highest premium because same-block reversals should never receive a counterflow discount.',
  [FeeMode.MatureRisk]: 'The mature debt (from previous blocks) is in the same direction as this swap, adding to the pool\'s existing imbalance. A risk premium is applied.',
  [FeeMode.Counterflow]: 'This swap opposes the pool\'s matured directional imbalance from prior blocks. Because it helps repair the pool, FairFlow rewards it with a fee discount.',
};

export default function TransactionExplainer({ swap }) {
  if (!swap) {
    return (
      <div className="glass-card">
        <div className="card-header"><h3>⑥ Transaction Explainer</h3></div>
        <div className="card-body">
          <div className="explainer-empty">
            <div className="icon">🔍</div>
            Click any swap in the feed above to see its full fee breakdown
          </div>
        </div>
      </div>
    );
  }

  const isZeroForOne = swap.zeroForOne ?? (swap.direction === 'buy');
  const label = swap.label ?? `${swap.direction === 'buy' ? 'Buy' : 'Sell'} ${swap.amount} ${swap.token || 'ETH'}`;
  const mode = swap.mode ?? swap.fee?.mode ?? 'Calm';

  const fairBps = swap.feeBps ?? pipsToBps(swap.fee?.finalFee || 500);
  const vanillaBps = swap.vanillaFeeBps ?? pipsToBps(swap.vanillaFee || 500);

  const baseBps = swap.components?.base ? swap.components.base : (swap.fee ? pipsToBps(swap.fee.baseFee) : 5.0);
  const volBps = swap.components?.volatility ? swap.components.volatility : (swap.fee ? pipsToBps(swap.fee.volatilityPremium) : 0);
  const flowBps = swap.components?.flow ? swap.components.flow : (swap.fee ? pipsToBps(swap.fee.flowPremium) : 0);
  const discountBps = swap.components?.counterflow ? swap.components.counterflow : (swap.fee ? pipsToBps(swap.fee.counterflowDiscount) : 0);

  return (
    <div className="glass-card">
      <div className="card-header">
        <h3>⑥ Transaction Explainer</h3>
        <FeeBadge mode={mode} />
      </div>
      <div className="card-body">
        <div className="explainer-card">
          <div className="explainer-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{isZeroForOne ? '↓' : '↑'}</span>
            <span>{label}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>
              Block #{swap.block}
            </span>
            {swap.txHash && (
              <a
                href={`https://sepolia.basescan.org/tx/${swap.txHash}`}
                target="_blank"
                rel="noreferrer"
                style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--accent-pink)', textDecoration: 'underline' }}
              >
                View on Basescan ↗
              </a>
            )}
          </div>

          <div className="explainer-desc">
            {swap.explanation || swap.description || modeExplanations[mode] || 'FairFlow dynamic pricing execution.'}
          </div>

          {/* Fee components */}
          <div className="fee-components">
            <div className="fee-component">
              <span className="comp-label">Base Fee</span>
              <span className="comp-value">{baseBps.toFixed(1)}bp</span>
            </div>
            <div className="fee-component">
              <span className="comp-label">Volatility Premium</span>
              <span className="comp-value" style={{ color: volBps > 0 ? '#a78bfa' : undefined }}>
                {volBps > 0 ? '+' : ''}{volBps.toFixed(1)}bp
              </span>
            </div>
            <div className="fee-component">
              <span className="comp-label">Flow Premium</span>
              <span className={`comp-value ${flowBps > 0 ? 'positive' : ''}`}>
                {flowBps > 0 ? '+' : ''}{flowBps.toFixed(1)}bp
              </span>
            </div>
            <div className="fee-component">
              <span className="comp-label">Counterflow Discount</span>
              <span className={`comp-value ${discountBps > 0 ? 'discount' : ''}`}>
                {discountBps > 0 ? '−' : ''}{discountBps.toFixed(1)}bp
              </span>
            </div>
          </div>

          {/* Final fee summary */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--accent-gradient-subtle)', marginBottom: '16px',
            fontWeight: 700, fontSize: '0.9rem',
          }}>
            <span>Final Fee</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--accent-pink)' }}>
              {fairBps.toFixed(1)}bp
            </span>
          </div>

          {/* vs Vanilla */}
          <div style={{
            textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '16px',
          }}>
            Vanilla pool would charge <strong style={{ color: 'var(--text-primary)' }}>{vanillaBps.toFixed(1)}bp</strong> for this swap
            {fairBps > vanillaBps && <span style={{ color: 'var(--positive)', fontWeight: 700 }}> — LP earns {(fairBps - vanillaBps).toFixed(1)}bp more</span>}
            {fairBps < vanillaBps && <span style={{ color: 'var(--mode-counterflow)', fontWeight: 700 }}> — Trader saves {(vanillaBps - fairBps).toFixed(1)}bp (restorative)</span>}
          </div>

          {/* State snapshot */}
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
            Flow State After Swap
          </div>
          <div className="state-grid">
            <div className="state-item">
              <div className="si-label">Block Debt</div>
              <div className="si-value" style={{ color: (swap.stateAfter?.blockDebt || 0) !== 0 ? 'var(--accent-pink)' : 'var(--text-tertiary)' }}>
                {(swap.stateAfter?.blockDebt || 0) > 0 ? '+' : ''}{swap.stateAfter?.blockDebt || 0}
              </div>
            </div>
            <div className="state-item">
              <div className="si-label">Mature Debt</div>
              <div className="si-value" style={{ color: (swap.stateAfter?.matureDebt || 0) !== 0 ? '#f97316' : 'var(--text-tertiary)' }}>
                {(swap.stateAfter?.matureDebt || 0) > 0 ? '+' : ''}{swap.stateAfter?.matureDebt || 0}
              </div>
            </div>
            <div className="state-item">
              <div className="si-label">Volatility EMA</div>
              <div className="si-value" style={{ color: (swap.stateAfter?.volatilityEma || 0) > 0 ? '#a78bfa' : 'var(--text-tertiary)' }}>
                {swap.stateAfter?.volatilityEma || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
