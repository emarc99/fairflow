'use client';

import Sparkline from './ui/Sparkline';

export default function FlowDebtGauge({ state, debtHistory }) {
  const maxTicks = 50;

  const blockPct = state ? Math.min(Math.abs(state.blockDebt) / maxTicks, 1) * 50 : 0;
  const maturePct = state ? Math.min(Math.abs(state.matureDebt) / maxTicks, 1) * 50 : 0;

  const blockPositive = state && state.blockDebt >= 0;
  const maturePositive = state && state.matureDebt >= 0;

  return (
    <div className="glass-card">
      <div className="card-header"><h3>③ Flow Debt</h3></div>
      <div className="card-body">
        <div className="gauge-container">
          {/* Block Debt */}
          <div className="gauge">
            <div className="gauge-label">Block Debt</div>
            <div className="gauge-bar-wrap">
              <div className="gauge-bar-center" />
              {blockPct > 0 && (
                <div
                  className={`gauge-bar-fill ${blockPositive ? 'positive' : 'negative'}`}
                  style={
                    blockPositive
                      ? { height: `${blockPct}%`, bottom: '50%' }
                      : { height: `${blockPct}%`, top: '50%' }
                  }
                />
              )}
            </div>
            <div className="gauge-value" style={{ color: state?.blockDebt === 0 ? 'var(--text-tertiary)' : blockPositive ? 'var(--accent-pink)' : 'var(--accent-blue)' }}>
              {state ? (state.blockDebt > 0 ? '+' : '') + state.blockDebt : '0'}
            </div>
            <Sparkline
              data={(debtHistory || []).map(h => h.blockDebt)}
              color={blockPositive ? '#ff007a' : '#3b82f6'}
              height={28}
            />
          </div>

          {/* Mature Debt */}
          <div className="gauge">
            <div className="gauge-label">Mature Debt</div>
            <div className="gauge-bar-wrap">
              <div className="gauge-bar-center" />
              {maturePct > 0 && (
                <div
                  className={`gauge-bar-fill ${maturePositive ? 'positive' : 'negative'}`}
                  style={
                    maturePositive
                      ? { height: `${maturePct}%`, bottom: '50%' }
                      : { height: `${maturePct}%`, top: '50%' }
                  }
                />
              )}
            </div>
            <div className="gauge-value" style={{ color: state?.matureDebt === 0 ? 'var(--text-tertiary)' : maturePositive ? 'var(--accent-pink)' : 'var(--accent-blue)' }}>
              {state ? (state.matureDebt > 0 ? '+' : '') + state.matureDebt : '0'}
            </div>
            <Sparkline
              data={(debtHistory || []).map(h => h.matureDebt)}
              color={maturePositive ? '#f97316' : '#06b6d4'}
              height={28}
            />
          </div>

          {/* Volatility EMA */}
          <div className="gauge">
            <div className="gauge-label">Volatility EMA</div>
            <div className="gauge-bar-wrap">
              <div className="gauge-bar-center" style={{ top: '100%' }} />
              <div
                className="gauge-bar-fill positive"
                style={{
                  bottom: 0,
                  height: `${state ? Math.min(state.volatilityEma / 30, 1) * 100 : 0}%`,
                  background: 'linear-gradient(to top, #8b5cf6, #a78bfa)',
                }}
              />
            </div>
            <div className="gauge-value" style={{ color: state?.volatilityEma ? '#a78bfa' : 'var(--text-tertiary)' }}>
              {state ? state.volatilityEma : '0'}
            </div>
            <Sparkline
              data={(debtHistory || []).map(h => h.volatilityEma)}
              color="#a78bfa"
              height={28}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
