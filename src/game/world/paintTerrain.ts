import type { WorldState } from './WorldState';

/**
 * Composite the simulation grids into an RGBA pixel buffer (one cell → one
 * pixel) for upload as a texture. Renderer-agnostic: it only touches the passed
 * `ImageData`, which must be `cols × rows`. Layers, cheap to most expensive:
 * terrain height ramp → hillshade → vegetation → water → lava glow.
 */
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// terrain colour stops by elevation (sand → grass-rock → highland → snow)
function terrainRamp(h: number, rock: number, out: [number, number, number]): void {
  let r: number;
  let g: number;
  let b: number;
  if (h < 0.34) {
    // shoreline sand
    const t = h / 0.34;
    r = lerp(214, 198, t);
    g = lerp(196, 178, t);
    b = lerp(150, 120, t);
  } else if (h < 0.62) {
    // lowland → highland soil
    const t = (h - 0.34) / 0.28;
    r = lerp(150, 110, t);
    g = lerp(132, 104, t);
    b = lerp(96, 86, t);
  } else if (h < 0.82) {
    // bare rock
    const t = (h - 0.62) / 0.2;
    r = lerp(120, 150, t);
    g = lerp(114, 150, t);
    b = lerp(104, 152, t);
  } else {
    // snow cap
    const t = (h - 0.82) / 0.18;
    r = lerp(170, 244, t);
    g = lerp(170, 248, t);
    b = lerp(172, 255, t);
  }
  if (rock) {
    // fresh volcanic rock is darker and slightly warm
    r = lerp(r, 60, 0.55);
    g = lerp(g, 52, 0.55);
    b = lerp(b, 54, 0.55);
  }
  out[0] = r;
  out[1] = g;
  out[2] = b;
}

const rgb: [number, number, number] = [0, 0, 0];

export function paintTerrain(s: WorldState, img: ImageData): void {
  const { cols, rows, height, water, lava, vegetation, temp, rock } = s;
  const px = img.data;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = y * cols + x;
      const h = height[i];
      terrainRamp(h, rock[i], rgb);
      let r = rgb[0];
      let g = rgb[1];
      let b = rgb[2];

      // hillshade: dot the height gradient with a fixed light direction.
      const hl = x > 0 ? height[i - 1] : h;
      const hu = y > 0 ? height[i - cols] : h;
      const shade = 1 + ((h - hl) + (h - hu)) * 2.2; // >1 lit, <1 shadowed
      const sh = shade < 0.7 ? 0.7 : shade > 1.3 ? 1.3 : shade;
      r *= sh;
      g *= sh;
      b *= sh;

      // vegetation greens the surface
      const v = vegetation[i];
      if (v > 0.02) {
        const a = v * 0.85;
        r = lerp(r, 34, a);
        g = lerp(g, 120, a);
        b = lerp(b, 46, a);
      }

      // water as translucent blue, deeper = darker
      const w = water[i];
      if (w > 0.004) {
        const a = Math.min(0.85, w * 4);
        r = lerp(r, 24, a);
        g = lerp(g, 96, a);
        b = lerp(b, 188, a);
      }

      // lava glow (hot → bright orange/white)
      const l = lava[i];
      if (l > 0.008) {
        const a = Math.min(1, l * 6);
        const hot = temp[i];
        r = lerp(r, 255, a);
        g = lerp(g, lerp(70, 200, hot), a);
        b = lerp(b, lerp(20, 120, hot * hot), a * 0.7);
      }

      const o = i * 4;
      px[o] = r < 0 ? 0 : r > 255 ? 255 : r;
      px[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      px[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      px[o + 3] = 255;
    }
  }
}
