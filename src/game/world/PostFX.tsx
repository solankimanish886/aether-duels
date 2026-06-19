import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { Quality } from './constants';

interface Props {
  quality: Quality;
}

/**
 * Cinematic postprocessing, quality-tiered so it doesn't starve the MediaPipe
 * hand tracking that shares the GPU:
 *   low  → ACES tone mapping + vignette
 *   med  → + bloom (lava/sun glow)
 *   high → + bloom with extra multisampling
 *
 * Only screen-space, geometry-independent effects are used. SSAO/SSR are
 * deliberately omitted: the terrain is GPU-displaced in its vertex shader, which
 * the postprocessing normal/depth G-buffer passes don't see, so AO/reflection
 * would be computed against the flat plane. Relief is instead conveyed by real
 * in-shader sun lighting (slope shading), tree shadows, and the day/night sun.
 */
export function PostFX({ quality }: Props) {
  const withBloom = quality !== 'low';

  return (
    <EffectComposer multisampling={quality === 'high' ? 4 : 0}>
      {withBloom ? (
        <Bloom mipmapBlur intensity={0.7} luminanceThreshold={0.75} luminanceSmoothing={0.2} />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette eskil={false} offset={0.2} darkness={0.55} />
    </EffectComposer>
  );
}
