import { useEffect, useRef } from 'react';

/**
 * Mirrored live-camera `<video>`. Mounts the element ONLY once a stream exists,
 * then attaches via an effect — the reliable pattern (a video mounted before its
 * stream, or attached via a ref callback, can render black). Shared by the
 * corner CameraPip and the framed tutorial preview.
 */
export function CameraView({ stream, className }: { stream: MediaStream | null; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) v.play().catch(() => {});
  }, [stream]);

  if (!stream) return null;
  return <video ref={ref} className={className} autoPlay playsInline muted />;
}
