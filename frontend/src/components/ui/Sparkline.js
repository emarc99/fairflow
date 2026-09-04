'use client';

import { useRef, useEffect } from 'react';

/**
 * Tiny inline SVG sparkline for debt history.
 * @param {{ data: number[], color?: string, height?: number }} props
 */
export default function Sparkline({ data = [], color = '#8b5cf6', height = 30 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || data.length < 2) return;

    const svg = svgRef.current;
    const w = svg.clientWidth || 120;
    const h = height;
    const maxAbs = Math.max(...data.map(Math.abs), 1);
    const mid = h / 2;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = mid - (val / maxAbs) * (mid - 2);
      return `${x},${y}`;
    });

    svg.innerHTML = `
      <line x1="0" y1="${mid}" x2="${w}" y2="${mid}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
      <polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
      <circle cx="${points[points.length - 1].split(',')[0]}" cy="${points[points.length - 1].split(',')[1]}" r="2.5" fill="${color}"/>
    `;
  }, [data, color, height]);

  if (data.length < 2) {
    return <div className="sparkline-wrap" style={{ height, opacity: 0.3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>no data</div>;
  }

  return (
    <div className="sparkline-wrap" style={{ height }}>
      <svg ref={svgRef} width="100%" height={height} />
    </div>
  );
}
