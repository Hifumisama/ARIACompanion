import React, { useRef, useCallback } from 'react';
import { PersonalityAxis } from '../types';

interface RadarChartProps {
  axes: PersonalityAxis[];
  onChange: (axes: PersonalityAxis[]) => void;
  size?: number;
}

const LEVELS = 5;
const COLOR = '#4CAF50';
const COLOR_FILL = 'rgba(76, 175, 80, 0.2)';
const COLOR_GRID = '#333';
const COLOR_LABEL = '#ccc';

export const RadarChart = ({ axes, onChange, size = 320 }: RadarChartProps) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<number | null>(null);

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;

  const count = axes.length;
  if (count < 3) {
    return (
      <div style={{ color: '#666', fontSize: 13, textAlign: 'center', padding: 16 }}>
        Ajoute au moins 3 traits de personnalité pour afficher le radar.
      </div>
    );
  }

  const angleStep = (2 * Math.PI) / count;
  const startAngle = -Math.PI / 2; // top

  function getPoint(index: number, value: number): [number, number] {
    const angle = startAngle + index * angleStep;
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  function getAxisEnd(index: number): [number, number] {
    const angle = startAngle + index * angleStep;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }

  function getLabelPos(index: number): [number, number] {
    const angle = startAngle + index * angleStep;
    const r = radius + 24;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  }

  // Grid polygons
  const gridPolygons = [];
  for (let level = 1; level <= LEVELS; level++) {
    const val = (level / LEVELS) * 100;
    const points = axes.map((_, i) => getPoint(i, val).join(',')).join(' ');
    gridPolygons.push(
      <polygon key={level} points={points} fill="none" stroke={COLOR_GRID} strokeWidth={1} opacity={0.5} />
    );
  }

  // Axis lines
  const axisLines = axes.map((_, i) => {
    const [ex, ey] = getAxisEnd(i);
    return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke={COLOR_GRID} strokeWidth={1} opacity={0.3} />;
  });

  // Data polygon
  const dataPoints = axes.map((a, i) => getPoint(i, a.value).join(',')).join(' ');

  // Drag handlers
  const valueFromEvent = useCallback((e: React.MouseEvent | MouseEvent, index: number): number => {
    const svg = svgRef.current;
    if (!svg) return 50;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - cx;
    const dy = my - cy;
    const angle = startAngle + index * angleStep;
    const projLen = dx * Math.cos(angle) + dy * Math.sin(angle);
    const val = Math.round(Math.max(0, Math.min(100, (projLen / radius) * 100)));
    return val;
  }, [cx, cy, radius, angleStep, startAngle]);

  const handleMouseDown = useCallback((index: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = index;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (draggingRef.current === null) return;
      const newVal = valueFromEvent(moveEvent, draggingRef.current);
      const newAxes = axes.map((a, i) => i === draggingRef.current ? { ...a, value: newVal } : a);
      onChange(newAxes);
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [axes, onChange, valueFromEvent]);

  // Handle click directly on chart area to set value
  const handleClick = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const dx = mx - cx;
    const dy = my - cy;

    // Find closest axis
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < count; i++) {
      const angle = startAngle + i * angleStep;
      const ax = Math.cos(angle);
      const ay = Math.sin(angle);
      const proj = dx * ax + dy * ay;
      const perpDist = Math.abs(dx * (-ay) + dy * ax);
      if (proj >= 0 && perpDist < closestDist) {
        closestDist = perpDist;
        closestIdx = i;
      }
    }

    if (closestDist < 30) {
      const newVal = valueFromEvent(e, closestIdx);
      const newAxes = axes.map((a, i) => i === closestIdx ? { ...a, value: newVal } : a);
      onChange(newAxes);
    }
  }, [axes, onChange, valueFromEvent, cx, cy, count, angleStep, startAngle]);

  // Draggable points
  const handles = axes.map((a, i) => {
    const [px, py] = getPoint(i, a.value);
    return (
      <circle
        key={i}
        cx={px}
        cy={py}
        r={6}
        fill={COLOR}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown(i)}
      />
    );
  });

  // Labels
  const labels = axes.map((a, i) => {
    const [lx, ly] = getLabelPos(i);
    const angle = startAngle + i * angleStep;
    const isRight = Math.cos(angle) > 0.1;
    const isLeft = Math.cos(angle) < -0.1;
    const anchor = isRight ? 'start' : isLeft ? 'end' : 'middle';
    return (
      <text
        key={i}
        x={lx}
        y={ly}
        textAnchor={anchor}
        dominantBaseline="central"
        fill={COLOR_LABEL}
        fontSize={12}
        fontWeight={500}
        style={{ userSelect: 'none' }}
      >
        {a.name || `Trait ${i + 1}`}
        <tspan dx={4} fill={COLOR} fontSize={11}>
          {a.value}
        </tspan>
      </text>
    );
  });

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', margin: '0 auto' }}
      onClick={handleClick}
    >
      {gridPolygons}
      {axisLines}
      <polygon points={dataPoints} fill={COLOR_FILL} stroke={COLOR} strokeWidth={2} />
      {handles}
      {labels}
    </svg>
  );
};
