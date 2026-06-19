import { ELEMENT_BEATS, ELEMENT_LIST, type ElementKey } from '@/game/elemental';
import './elemental.css';

const SIZE = 300;
const C = SIZE / 2;
const R = 108; // node ring radius
const NODE = 26; // node circle radius

const POS = ELEMENT_LIST.map((_, i) => {
  const ang = -Math.PI / 2 + (i * 2 * Math.PI) / ELEMENT_LIST.length;
  return { x: C + R * Math.cos(ang), y: C + R * Math.sin(ang) };
});
const INDEX: Record<ElementKey, number> = ELEMENT_LIST.reduce(
  (acc, el, i) => ((acc[el.key] = i), acc),
  {} as Record<ElementKey, number>,
);

/** Geometry for one "a beats b" arrow, trimmed clear of both node circles. */
function arrow(ai: number, bi: number) {
  const a = POS[ai];
  const b = POS[bi];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const gap = NODE + 7;
  const x1 = a.x + ux * gap;
  const y1 = a.y + uy * gap;
  const x2 = b.x - ux * gap;
  const y2 = b.y - uy * gap;
  const head = 9;
  const halfW = 5;
  const baseX = x2 - ux * head;
  const baseY = y2 - uy * head;
  const px = -uy;
  const py = ux;
  const points = `${x2},${y2} ${baseX + px * halfW},${baseY + py * halfW} ${baseX - px * halfW},${baseY - py * halfW}`;
  return { x1, y1, x2: baseX, y2: baseY, points };
}

/** Visual "what beats what" pentagon. Arrow A→B means A defeats B. */
export function MatchupWheel() {
  return (
    <div className="mwheel">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label="Element matchup chart">
        {ELEMENT_LIST.map((el) =>
          ELEMENT_BEATS[el.key].map((target) => {
            const g = arrow(INDEX[el.key], INDEX[target]);
            return (
              <g key={`${el.key}-${target}`} opacity={0.85}>
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={el.color} strokeWidth={2.5} strokeLinecap="round" />
                <polygon points={g.points} fill={el.color} />
              </g>
            );
          }),
        )}
        {ELEMENT_LIST.map((el, i) => (
          <g key={el.key}>
            <circle cx={POS[i].x} cy={POS[i].y} r={NODE} fill="rgba(12,14,24,0.92)" stroke={el.color} strokeWidth={2.5} />
            <text x={POS[i].x} y={POS[i].y + 8} textAnchor="middle" fontSize={24}>
              {el.emoji}
            </text>
          </g>
        ))}
      </svg>
      <p className="mwheel-legend">An arrow from one element points to what it defeats.</p>
    </div>
  );
}
