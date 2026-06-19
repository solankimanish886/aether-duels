import { CameraView } from './CameraView';
import './hand-ui.css';

/** Small mirrored camera preview so players can see their hand while drawing. */
export function CameraPip({ stream, corner = 'left' }: { stream: MediaStream | null; corner?: 'left' | 'right' }) {
  if (!stream) return null;
  return (
    <div className={`camera-pip ${corner === 'right' ? 'camera-pip--right' : ''}`}>
      <span className="camera-pip-label">You</span>
      <CameraView stream={stream} />
    </div>
  );
}
