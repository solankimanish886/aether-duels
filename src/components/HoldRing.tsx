import './HoldRing.css';

interface Props {
  /** Viewport position (px) — typically the hand cursor. */
  x: number;
  y: number;
  /** 0..1 fill progress. */
  progress: number;
  color: string;
  label: string;
}

/** Progress ring drawn at the cursor while a hold-to-confirm gesture charges. */
export function HoldRing({ x, y, progress, color, label }: Props) {
  const R = 42;
  const circ = 2 * Math.PI * (R - 3);
  return (
    <div className="holdring" style={{ left: x, top: y }}>
      <svg width={R * 2} height={R * 2}>
        <circle cx={R} cy={R} r={R - 3} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={4} />
        <circle
          cx={R}
          cy={R}
          r={R - 3}
          fill="none"
          stroke={color}
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - progress)}
          transform={`rotate(-90 ${R} ${R})`}
        />
      </svg>
      <span className="holdring-label">{label}</span>
    </div>
  );
}
