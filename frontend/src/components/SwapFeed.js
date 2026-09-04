'use client';

import FeeBadge from './ui/FeeBadge';
import { pipsToBps } from '@/lib/fairflow-engine';

export default function SwapFeed({ swaps, selectedIdx, onSelect }) {
  if (!swaps || swaps.length === 0) {
    return (
      <div className="glass-card">
        <div className="card-header"><h3>① Live Swap Feed</h3></div>
        <div className="card-body" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}>⚡</div>
          Select a scenario and press Play to begin
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card panel-full">
      <div className="card-header">
        <h3>① Live Swap Feed</h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', fontFamily: "'JetBrains Mono', monospace" }}>
          {swaps.length} swaps
        </span>
      </div>
      <div className="swap-feed">
        {/* Header */}
        <div className="swap-row" style={{ borderBottom: '1px solid var(--bg-glass-border)', cursor: 'default', animation: 'none' }}>
          <div />
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Swap</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Mode</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, textAlign: 'right' }}>FairFlow</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, textAlign: 'right' }}>Δ vs 5bp</div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Breakdown</div>
        </div>

        {swaps.map((swap, i) => {
          const fairBps = swap.feeBps ?? pipsToBps(swap.fee?.finalFee || 500);
          const vanillaBps = swap.vanillaFeeBps ?? pipsToBps(swap.vanillaFee || 500);
          const delta = swap.deltaBps ?? (fairBps - vanillaBps);
          const mode = swap.mode ?? swap.fee?.mode ?? 'Calm';
          const isZeroForOne = swap.zeroForOne ?? (swap.direction === 'buy');
          const label = swap.label ?? `${swap.direction === 'buy' ? 'Buy' : 'Sell'} ${swap.amount} ${swap.token || 'ETH'}`;

          const baseFee = swap.components?.base ? swap.components.base * 100 : (swap.fee?.baseFee || 500);
          const volFee = swap.components?.volatility ? swap.components.volatility * 100 : (swap.fee?.volatilityPremium || 0);
          const flowFee = swap.components?.flow ? swap.components.flow * 100 : (swap.fee?.flowPremium || 0);
          const totalFee = baseFee + volFee + flowFee;
          const maxBar = Math.max(totalFee, 1);

          return (
            <div
              key={swap.id || i}
              className={`swap-row ${selectedIdx === i ? 'selected' : ''}`}
              onClick={() => onSelect(i)}
            >
              <div className={`direction ${isZeroForOne ? 'buy' : 'sell'}`}>
                {isZeroForOne ? '↓' : '↑'}
              </div>
              <div className="swap-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{label}</span>
                {swap.txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${swap.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: '0.65rem', color: 'var(--accent-pink)', textDecoration: 'underline' }}
                  >
                    Basescan ↗
                  </a>
                )}
              </div>
              <FeeBadge mode={mode} />
              <div className="fee-value" style={{ color: delta > 0 ? 'var(--accent-pink)' : delta < 0 ? 'var(--mode-counterflow)' : 'var(--text-primary)' }}>
                {fairBps.toFixed(1)}bp
              </div>
              <div className={`fee-delta ${delta > 0 ? 'positive' : delta < 0 ? 'negative' : ''}`}>
                {delta > 0 ? '+' : ''}{delta.toFixed(1)}bp
              </div>
              <div className="fee-bar-cell">
                <div className="fee-bar">
                  <div className="bar-base" style={{ width: `${(baseFee / maxBar) * 100}%` }} />
                  <div className="bar-volatility" style={{ width: `${(volFee / maxBar) * 100}%` }} />
                  <div className={`bar-flow ${mode}`} style={{ width: `${(flowFee / maxBar) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
