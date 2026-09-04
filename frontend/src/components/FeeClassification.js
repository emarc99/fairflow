'use client';

import { useRef, useEffect } from 'react';
import { FeeMode } from '@/lib/fairflow-engine';

const MODES = [FeeMode.Calm, FeeMode.Congestion, FeeMode.Reversal, FeeMode.MatureRisk, FeeMode.Counterflow];
const MODE_COLORS = {
  [FeeMode.Calm]: '#22c55e',
  [FeeMode.Congestion]: '#f59e0b',
  [FeeMode.Reversal]: '#ef4444',
  [FeeMode.MatureRisk]: '#f97316',
  [FeeMode.Counterflow]: '#06b6d4',
};

export default function FeeClassification({ swaps }) {
  const canvasRef = useRef(null);

  const counts = {};
  MODES.forEach(m => { counts[m] = 0; });
  (swaps || []).forEach(s => {
    const m = s.mode ?? s.fee?.mode;
    if (m && counts[m] !== undefined) counts[m]++;
  });
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 160;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = 72;
    const innerR = 50;

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2, true);
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();
      return;
    }

    let startAngle = -Math.PI / 2;
    MODES.forEach((mode) => {
      const fraction = counts[mode] / total;
      if (fraction === 0) return;
      const endAngle = startAngle + fraction * Math.PI * 2;

      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, endAngle);
      ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = MODE_COLORS[mode];
      ctx.fill();

      // Gap between segments
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, endAngle - 0.02, endAngle + 0.02);
      ctx.arc(cx, cy, innerR, endAngle + 0.02, endAngle - 0.02, true);
      ctx.closePath();
      ctx.fillStyle = '#0a0b0f';
      ctx.fill();

      startAngle = endAngle;
    });
  }, [counts, total]);

  return (
    <div className="glass-card">
      <div className="card-header"><h3>② Fee Classification</h3></div>
      <div className="card-body">
        <div className="donut-container">
          <div className="donut-canvas-wrap">
            <canvas ref={canvasRef} />
            <div className="donut-center-label">
              <div className="big">{total}</div>
              <div className="small">swaps</div>
            </div>
          </div>
          <div className="donut-legend">
            {MODES.map(mode => (
              <div key={mode} className="legend-item">
                <div className="legend-dot" style={{ background: MODE_COLORS[mode] }} />
                <span>{mode}</span>
                <span className="legend-count">{counts[mode]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
