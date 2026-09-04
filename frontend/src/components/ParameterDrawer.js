'use client';

import { DEFAULTS } from '@/lib/fairflow-engine';

const PARAMS = [
  { key: 'BASE_FEE', label: 'Base Fee (pips)', min: 50, max: 2000, step: 50 },
  { key: 'VOLATILITY_FEE_PER_TICK', label: 'Volatility Fee / Tick', min: 0, max: 30, step: 1 },
  { key: 'CONGESTION_FEE_PER_TICK', label: 'Congestion Fee / Tick', min: 0, max: 30, step: 1 },
  { key: 'REVERSAL_FEE_PER_TICK', label: 'Reversal Fee / Tick', min: 0, max: 50, step: 1 },
  { key: 'MATURE_RISK_FEE_PER_TICK', label: 'Mature Risk Fee / Tick', min: 0, max: 20, step: 1 },
  { key: 'COUNTERFLOW_DISCOUNT_PER_TICK', label: 'Counterflow Discount / Tick', min: 0, max: 20, step: 1 },
  { key: 'MAX_VOLATILITY_PREMIUM', label: 'Max Volatility Premium', min: 0, max: 5000, step: 100 },
  { key: 'MAX_FLOW_PREMIUM', label: 'Max Flow Premium', min: 0, max: 10000, step: 100 },
  { key: 'MAX_COUNTERFLOW_DISCOUNT', label: 'Max Counterflow Discount', min: 0, max: 1000, step: 50 },
  { key: 'EMA_ALPHA_BPS', label: 'EMA Alpha (BPS)', min: 500, max: 5000, step: 100 },
  { key: 'DEBT_DECAY_BPS', label: 'Debt Decay (BPS)', min: 5000, max: 9900, step: 100 },
];

export default function ParameterDrawer({ params, onChange, onClose, onReset }) {
  return (
    <>
      <div className="param-drawer-overlay" onClick={onClose} />
      <div className="param-drawer">
        <h3>⚙ Fee Parameters</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '20px', lineHeight: 1.6 }}>
          Adjust FairFlow&apos;s fee constants and watch how they affect the simulation in real-time. These map directly to the immutable constants in FairFlow.sol.
        </p>

        {PARAMS.map(({ key, label, min, max, step }) => (
          <div key={key} className="param-group">
            <div className="param-label">
              <span>{label}</span>
              <span className="param-val">{params[key]}</span>
            </div>
            <input
              type="range"
              className="param-slider"
              min={min}
              max={max}
              step={step}
              value={params[key]}
              onChange={(e) => onChange(key, Number(e.target.value))}
            />
          </div>
        ))}

        <button className="toolbar-btn param-reset-btn" onClick={onReset}>
          ↻ Reset to Defaults
        </button>
      </div>
    </>
  );
}
