'use client';

import { pipsToBps } from '@/lib/fairflow-engine';

export default function LPValueCapture({ swaps }) {
  let fairTotal = 0;
  let vanillaTotal = 0;

  (swaps || []).forEach(s => {
    const fairPips = s.fee?.finalFee ?? ((s.feeBps || 5.0) * 100);
    const vanPips = s.vanillaFee ?? ((s.vanillaFeeBps || 5.0) * 100);
    fairTotal += fairPips;
    vanillaTotal += vanPips;
  });

  const fairBps = pipsToBps(fairTotal);
  const vanillaBps = pipsToBps(vanillaTotal);
  const delta = fairBps - vanillaBps;
  const deltaPct = vanillaBps > 0 ? ((delta / vanillaBps) * 100).toFixed(1) : '0.0';
  const maxVal = Math.max(fairBps, vanillaBps, 1);

  return (
    <div className="glass-card">
      <div className="card-header"><h3>④ LP Value Capture</h3></div>
      <div className="card-body">
        <div className="lp-capture">
          <div className="lp-bars">
            <div className="lp-bar-group">
              <div className="lp-bar-value" style={{ color: 'var(--text-secondary)' }}>
                {vanillaBps.toFixed(1)}bp
              </div>
              <div className="lp-bar-track">
                <div
                  className="lp-bar-fill vanilla"
                  style={{ height: `${(vanillaBps / maxVal) * 100}%` }}
                />
              </div>
              <div className="lp-bar-label">Vanilla</div>
            </div>
            <div className="lp-bar-group">
              <div className="lp-bar-value" style={{ color: 'var(--accent-pink)' }}>
                {fairBps.toFixed(1)}bp
              </div>
              <div className="lp-bar-track">
                <div
                  className="lp-bar-fill fairflow"
                  style={{ height: `${(fairBps / maxVal) * 100}%` }}
                />
              </div>
              <div className="lp-bar-label">FairFlow</div>
            </div>
          </div>
          {swaps && swaps.length > 0 && (
            <div className="lp-delta" style={{ color: delta >= 0 ? 'var(--positive)' : 'var(--negative)', background: delta >= 0 ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)' }}>
              {delta >= 0 ? '▲' : '▼'} {delta >= 0 ? '+' : ''}{delta.toFixed(1)}bp total ({deltaPct}% {delta >= 0 ? 'more' : 'less'} for LPs)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
