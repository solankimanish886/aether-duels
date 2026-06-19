import { useEffect, useRef } from 'react';
import './hand-ui.css';

/** Small mirrored camera preview so players can see their hand while drawing. */
export function CameraPip({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);

  if (!stream) return null;
  return (
    <div className="camera-pip">
      <span className="camera-pip-label">You</span>
      <video ref={ref} autoPlay playsInline muted />
    </div>
  );
}
