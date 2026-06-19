/**
 * Scanline-free stack flood fill, ported from the legacy engine.
 * Operates in device pixels. `cssX/cssY` are CSS-pixel coords; `dpr` scales them.
 * Returns true if any pixels were filled.
 */
const TOLERANCE = 40;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function floodFill(
  ctx: CanvasRenderingContext2D,
  cssX: number,
  cssY: number,
  color: string,
  dpr: number,
): boolean {
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const sx = Math.max(0, Math.min(cw - 1, Math.floor(cssX * dpr)));
  const sy = Math.max(0, Math.min(ch - 1, Math.floor(cssY * dpr)));

  const img = ctx.getImageData(0, 0, cw, ch);
  const d = img.data;
  const si = (sy * cw + sx) * 4;
  const tR = d[si],
    tG = d[si + 1],
    tB = d[si + 2],
    tA = d[si + 3];

  const [fR, fG, fB] = hexToRgb(color);
  if (tR === fR && tG === fG && tB === fB) return false;

  const match = (i: number) =>
    Math.abs(d[i] - tR) + Math.abs(d[i + 1] - tG) + Math.abs(d[i + 2] - tB) + Math.abs(d[i + 3] - tA) <
    TOLERANCE;

  const visited = new Uint8Array(cw * ch);
  const stack = [sy * cw + sx];
  while (stack.length) {
    const pos = stack.pop()!;
    if (visited[pos]) continue;
    visited[pos] = 1;
    const pi = pos * 4;
    d[pi] = fR;
    d[pi + 1] = fG;
    d[pi + 2] = fB;
    d[pi + 3] = 255;
    const cx = pos % cw;
    const cy = (pos / cw) | 0;
    if (cx > 0 && !visited[pos - 1] && match((pos - 1) * 4)) stack.push(pos - 1);
    if (cx < cw - 1 && !visited[pos + 1] && match((pos + 1) * 4)) stack.push(pos + 1);
    if (cy > 0 && !visited[pos - cw] && match((pos - cw) * 4)) stack.push(pos - cw);
    if (cy < ch - 1 && !visited[pos + cw] && match((pos + cw) * 4)) stack.push(pos + cw);
  }
  ctx.putImageData(img, 0, 0);
  return true;
}
