'use client';

import { FeeMode } from '@/lib/fairflow-engine';

const modeLabels = {
  [FeeMode.Calm]: '● Calm',
  [FeeMode.Congestion]: '▲ Congestion',
  [FeeMode.Reversal]: '⚠ Reversal',
  [FeeMode.MatureRisk]: '◆ Mature Risk',
  [FeeMode.Counterflow]: '↻ Counterflow',
};

export default function FeeBadge({ mode }) {
  return (
    <span className={`fee-badge ${mode}`}>
      {modeLabels[mode] || mode}
    </span>
  );
}
