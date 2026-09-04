'use client';

import FeeBadge from './ui/FeeBadge';
import { pipsToBps } from '@/lib/fairflow-engine';

export default function Comparison({ swaps }) {
  if (!swaps || swaps.length === 0) {
    return (
      <div className="glass-card">
        <div className="card-header"><h3>⑤ Vanilla vs FairFlow</h3></div>
        <div className="card-body" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '6px', opacity: 0.4 }}>⚖️</div>
          Run a scenario to compare fees
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="card-header"><h3>⑤ Vanilla vs FairFlow</h3></div>
      <div className="card-body">
        <div className="comparison-header">
          <div>Swap</div>
          <div>Vanilla</div>
          <div>FairFlow</div>
          <div>Delta</div>
        </div>
        <div className="comparison-list">
          {swaps.map((swap, i) => {
            const fairBps = swap.feeBps ?? pipsToBps(swap.fee?.finalFee || 500);
            const vanillaBps = swap.vanillaFeeBps ?? pipsToBps(swap.vanillaFee || 500);
            const delta = swap.deltaBps ?? (fairBps - vanillaBps);
            const mode = swap.mode ?? swap.fee?.mode ?? 'Calm';
            const isZeroForOne = swap.zeroForOne ?? (swap.direction === 'buy');
            const label = swap.label ?? `${swap.direction === 'buy' ? 'Buy' : 'Sell'} ${swap.amount} ${swap.token || 'ETH'}`;

            return (
              <div key={swap.id || i} className="comparison-row">
                <div className="label">
                  <span style={{ marginRight: '6px' }}>{isZeroForOne ? '↓' : '↑'}</span>
                  {label}
                  <span style={{ marginLeft: '6px' }}><FeeBadge mode={mode} /></span>
                </div>
                <div className="vanilla-fee">{vanillaBps.toFixed(1)}bp</div>
                <div className="fair-fee">{fairBps.toFixed(1)}bp</div>
                <div className={`delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral'}`}>
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
