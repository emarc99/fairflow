'use client';

import { scenarios } from '@/lib/scenarios';

export default function ScenarioToolbar({
  currentScenario,
  onScenarioChange,
  isPlaying,
  onPlayPause,
  onReset,
  speed,
  onSpeedChange,
  currentBlock,
  onOpenParams,
  onOpenHowItWorks,
}) {
  return (
    <div className="toolbar">
      <select
        className="scenario-select"
        value={currentScenario}
        onChange={(e) => onScenarioChange(e.target.value)}
      >
        {scenarios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.icon} {s.name}
          </option>
        ))}
      </select>

      <button
        className={`toolbar-btn primary`}
        onClick={onPlayPause}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      <button className="toolbar-btn" onClick={onReset}>
        ↻ Reset
      </button>

      <div className="toolbar-divider" />

      <div className="speed-group">
        {[1, 2, 5].map((s) => (
          <button
            key={s}
            className={`speed-btn ${speed === s ? 'active' : ''}`}
            onClick={() => onSpeedChange(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      <div className="toolbar-divider" />

      <div className="block-counter">
        Block <span>#{currentBlock}</span>
      </div>

      <div className="toolbar-divider" />

      <button className="toolbar-btn" onClick={onOpenParams}>
        ⚙ Parameters
      </button>

      <button className="toolbar-btn" onClick={onOpenHowItWorks}>
        ? How It Works
      </button>
    </div>
  );
}
