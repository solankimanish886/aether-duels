import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  NormalBlending,
  Points,
  ShaderMaterial,
  type Texture,
} from 'three';
import type { WorldEngine } from './WorldEngine';
import { gridToWorld, surfaceY } from './worldCoords';

const POINTS_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;
uniform float uPixelRatio;
void main() {
  vColor = aColor;
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPixelRatio * (8.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;
const POINTS_FRAG = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
uniform sampler2D uTex;
void main() {
  float a = texture2D(uTex, gl_PointCoord).a;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha * a);
}
`;

/** Pooled point-sprite system. Dead points have alpha/size 0; we draw all N. */
class Pool {
  geom: BufferGeometry;
  points: Points;
  private pos: Float32Array;
  private size: Float32Array;
  private color: Float32Array;
  private alpha: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private grav: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private fade: Uint8Array; // 0 normal fade-out, 1 cloud-style fade-in+out
  private isRain: Uint8Array;
  private landY: Float32Array;
  private rgx: Float32Array;
  private rgy: Float32Array;
  private free: number[] = [];
  private n: number;

  constructor(capacity: number, tex: Texture, additive: boolean, pixelRatio: number) {
    this.n = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.color = new Float32Array(capacity * 3);
    this.alpha = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.vz = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.fade = new Uint8Array(capacity);
    this.isRain = new Uint8Array(capacity);
    this.landY = new Float32Array(capacity);
    this.rgx = new Float32Array(capacity);
    this.rgy = new Float32Array(capacity);
    for (let i = capacity - 1; i >= 0; i--) this.free.push(i);

    this.geom = new BufferGeometry();
    this.geom.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.geom.setAttribute('aSize', new BufferAttribute(this.size, 1));
    this.geom.setAttribute('aColor', new BufferAttribute(this.color, 3));
    this.geom.setAttribute('aAlpha', new BufferAttribute(this.alpha, 1));

    const mat = new ShaderMaterial({
      uniforms: { uTex: { value: tex }, uPixelRatio: { value: pixelRatio } },
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(this.geom, mat);
    this.points.frustumCulled = false;
  }

  spawn(opts: {
    x: number; y: number; z: number;
    vx: number; vy: number; vz: number;
    grav: number; size: number; life: number;
    r: number; g: number; b: number;
    fadeInOut?: boolean;
    rain?: { landY: number; gx: number; gy: number };
  }): void {
    const i = this.free.pop();
    if (i === undefined) return;
    this.pos[i * 3] = opts.x;
    this.pos[i * 3 + 1] = opts.y;
    this.pos[i * 3 + 2] = opts.z;
    this.vx[i] = opts.vx;
    this.vy[i] = opts.vy;
    this.vz[i] = opts.vz;
    this.grav[i] = opts.grav;
    this.size[i] = opts.size;
    this.life[i] = this.maxLife[i] = opts.life;
    this.color[i * 3] = opts.r;
    this.color[i * 3 + 1] = opts.g;
    this.color[i * 3 + 2] = opts.b;
    this.alpha[i] = 0;
    this.fade[i] = opts.fadeInOut ? 1 : 0;
    this.isRain[i] = opts.rain ? 1 : 0;
    if (opts.rain) {
      this.landY[i] = opts.rain.landY;
      this.rgx[i] = opts.rain.gx;
      this.rgy[i] = opts.rain.gy;
    }
  }

  update(dt: number, onRainLand: (gx: number, gy: number) => void): void {
    const { pos, size, alpha, vx, vy, vz, grav, life, maxLife, fade, isRain } = this;
    for (let i = 0; i < this.n; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      const landed = isRain[i] === 1 && pos[i * 3 + 1] <= this.landY[i];
      if (life[i] <= 0 || landed) {
        if (landed) onRainLand(this.rgx[i], this.rgy[i]);
        life[i] = 0;
        alpha[i] = 0;
        size[i] = 0;
        this.free.push(i);
        continue;
      }
      vy[i] += grav[i] * dt;
      pos[i * 3] += vx[i] * dt;
      pos[i * 3 + 1] += vy[i] * dt;
      pos[i * 3 + 2] += vz[i] * dt;
      const t = life[i] / maxLife[i]; // 1 → 0
      alpha[i] = fade[i] === 1 ? Math.min(1, (1 - t) * 3) * Math.min(1, t * 3) : t;
    }
    this.geom.attributes.position.needsUpdate = true;
    (this.geom.attributes.aSize as BufferAttribute).needsUpdate = true;
    (this.geom.attributes.aAlpha as BufferAttribute).needsUpdate = true;
    (this.geom.attributes.aColor as BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.geom.dispose();
    (this.points.material as ShaderMaterial).dispose();
  }
}

function softTexture(): Texture {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new CanvasTexture(c);
}

interface Props {
  engine: WorldEngine;
  pixelRatio?: number;
  onLightning?: (intensity: number) => void;
}

/**
 * 3D particle effects (steam, sparks, clouds, rain). Registers the engine's
 * effect callbacks and turns grid-space events into world-space point bursts.
 * Rain landing feeds water back into the sim via engine.rainLand.
 */
export function Particles3D({ engine, pixelRatio = 1.5, onLightning }: Props) {
  const tex = useMemo(softTexture, []);
  const soft = useMemo(() => new Pool(700, tex, false, pixelRatio), [tex, pixelRatio]);
  const add = useMemo(() => new Pool(400, tex, true, pixelRatio), [tex, pixelRatio]);

  useEffect(() => {
    engine.setEffects({
      onSteam: (gx, gy) => {
        const [x, , z] = gridToWorld(engine, gx + 0.5, gy + 0.5);
        const y = surfaceY(engine, gx, gy);
        soft.spawn({
          x, y: y + 0.02, z,
          vx: (Math.random() - 0.5) * 0.2, vy: 0.5 + Math.random() * 0.4, vz: (Math.random() - 0.5) * 0.2,
          grav: 0.1, size: 1.6, life: 1.1 + Math.random() * 0.8, r: 1, g: 1, b: 1, fadeInOut: true,
        });
      },
      onSpark: (gx, gy, count) => {
        const [x, , z] = gridToWorld(engine, gx + 0.5, gy + 0.5);
        const y = surfaceY(engine, gx, gy) + 0.05;
        for (let k = 0; k < count; k++) {
          const a = Math.random() * Math.PI * 2;
          const sp = 0.6 + Math.random() * 1.6;
          add.spawn({
            x, y, z,
            vx: Math.cos(a) * sp, vy: 1.2 + Math.random() * 1.4, vz: Math.sin(a) * sp,
            grav: -4, size: 0.7, life: 0.5 + Math.random() * 0.5,
            r: 1, g: Math.random() > 0.5 ? 0.8 : 0.45, b: 0.2,
          });
        }
      },
      onCloud: (gx, gy, r) => {
        for (let k = 0; k < 4; k++) {
          const cgx = gx + (Math.random() - 0.5) * r;
          const cgy = gy + (Math.random() - 0.5) * r;
          const [x, , z] = gridToWorld(engine, cgx, cgy);
          const y = surfaceY(engine, gx, gy) + 1.0 + Math.random() * 0.4;
          soft.spawn({
            x, y, z,
            vx: (Math.random() - 0.5) * 0.1, vy: 0, vz: (Math.random() - 0.5) * 0.1,
            grav: 0, size: 4.5, life: 3 + Math.random() * 2, r: 0.95, g: 0.97, b: 1, fadeInOut: true,
          });
        }
      },
      onRain: (gx, gy, r, drops) => {
        for (let k = 0; k < drops; k++) {
          const dgx = gx + (Math.random() - 0.5) * r;
          const dgy = gy + (Math.random() - 0.5) * r;
          const [x, , z] = gridToWorld(engine, dgx, dgy);
          const landY = surfaceY(engine, dgx, dgy);
          soft.spawn({
            x, y: landY + 1.4 + Math.random() * 0.6, z,
            vx: 0.05, vy: -2.6 - Math.random() * 1.4, vz: 0,
            grav: -2, size: 0.5, life: 2.0,
            r: 0.75, g: 0.88, b: 1,
            rain: { landY, gx: dgx, gy: dgy },
          });
        }
      },
      onLightning: (i) => onLightning?.(i),
    });
    return () => engine.setEffects({});
  }, [engine, soft, add, onLightning]);

  useEffect(
    () => () => {
      soft.dispose();
      add.dispose();
      tex.dispose();
    },
    [soft, add, tex],
  );

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta);
    soft.update(dt, (gx, gy) => engine.rainLand(gx, gy));
    add.update(dt, () => {});
  });

  return (
    <>
      <primitive object={soft.points} />
      <primitive object={add.points} />
    </>
  );
}
