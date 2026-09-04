'use client';

export default function HowItWorksModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>✕</button>
        <h2>How FairFlow Works</h2>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>
          FairFlow is a Uniswap v4 dynamic-fee hook that prices <strong style={{ color: 'var(--text-primary)' }}>flow externalities</strong> instead of attempting to identify traders.
          Same-block directional congestion and reversals pay more, while delayed counterflow that repairs a pool&apos;s mature imbalance pays less.
        </p>

        {/* Fee Formula */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 'var(--radius-md)',
          padding: '16px 20px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82rem',
          lineHeight: 2,
          marginBottom: '24px',
          borderLeft: '3px solid var(--accent-pink)',
        }}>
          <div><span style={{ color: 'var(--text-tertiary)' }}>fee =</span> base fee</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;+ <span style={{ color: '#a78bfa' }}>volatility premium</span></div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;+ <span style={{ color: '#f59e0b' }}>directional congestion premium</span></div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;+ <span style={{ color: '#ef4444' }}>same-block reversal premium</span></div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;− <span style={{ color: '#06b6d4' }}>mature counterflow discount</span></div>
        </div>

        {/* Flow Chart */}
        <div className="flow-chart">
          <div className="flow-node start">Swap enters PoolManager</div>
          <div className="flow-arrow" />
          <div className="flow-node start">FairFlow beforeSwap — roll expired block debt</div>
          <div className="flow-arrow" />
          <div className="flow-node decision">What is the relationship to existing flow debt?</div>
          <div style={{ height: '8px' }} />

          <div className="flow-branch">
            <div style={{ textAlign: 'center' }}>
              <div className="flow-branch-label">No debt</div>
              <div className="flow-node calm">Calm → Baseline fee</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="flow-branch-label">Same dir, same block</div>
              <div className="flow-node congestion">Congestion → Premium ↑</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="flow-branch-label">Opposite, same block</div>
              <div className="flow-node reversal">Reversal → High premium ↑↑</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="flow-branch-label">Opposite, mature debt</div>
              <div className="flow-node counterflow">Counterflow → Discount ↓</div>
            </div>
          </div>

          <div style={{ height: '8px' }} />
          <div className="flow-arrow" />
          <div className="flow-node start">Execute canonical v4 swap</div>
          <div className="flow-arrow" />
          <div className="flow-node start">FairFlow afterSwap — update block debt &amp; volatility EMA</div>
        </div>

        {/* Key Rules */}
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '12px', color: 'var(--text-primary)' }}>Key Rules</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { icon: '🟢', text: 'Calm flow receives the baseline fee (5 bps).' },
              { icon: '🟡', text: 'Repeated same-direction swaps within a block pay an increasing congestion premium.' },
              { icon: '🔴', text: 'Opposite-direction flow in the same block pays a reversal premium — never a discount. This prevents subsidizing sandwich back-runs.' },
              { icon: '🔵', text: 'Opposite-direction flow in a later block can earn a counterflow discount (the "carrot").' },
              { icon: '⚪', text: 'Mature debt and volatility decay during inactive blocks, returning fees toward baseline.' },
              { icon: '🔒', text: 'Every fee is bounded between MIN_FEE (1 bp) and MAX_FEE (100 bps).' },
            ].map((rule, i) => (
              <div key={i} style={{
                display: 'flex', gap: '10px', alignItems: 'flex-start',
                padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(255,255,255,0.02)', fontSize: '0.82rem',
                color: 'var(--text-secondary)', lineHeight: 1.5,
              }}>
                <span style={{ flexShrink: 0 }}>{rule.icon}</span>
                <span>{rule.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
