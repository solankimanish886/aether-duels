import { describe, it, expect } from 'vitest';
import { hitShape, norm } from '@/game/sandbox/drawShape';
import type { SceneShape } from '@/game/sandbox/types';

function shape(partial: Partial<SceneShape>): SceneShape {
  return { id: 'x', kind: 'rect', x: 0, y: 0, w: 100, h: 100, stroke: '#000', strokeWidth: 4, fill: null, ...partial };
}

describe('sandbox drawShape', () => {
  it('normalises negative-size bounding boxes', () => {
    const n = norm(shape({ x: 100, y: 80, w: -60, h: -40 }));
    expect(n).toEqual({ x: 40, y: 40, w: 60, h: 40 });
  });

  it('hit-tests a rectangle by its box', () => {
    const r = shape({ kind: 'rect', x: 10, y: 10, w: 80, h: 60 });
    expect(hitShape(r, 50, 40)).toBe(true);
    expect(hitShape(r, 200, 200)).toBe(false);
  });

  it('hit-tests a circle by its ellipse (box corners are outside)', () => {
    const c = shape({ kind: 'circle', x: 0, y: 0, w: 100, h: 100 });
    expect(hitShape(c, 50, 50)).toBe(true); // centre
    expect(hitShape(c, 2, 2)).toBe(false); // near a bbox corner — outside the disc
  });

  it('hit-tests a triangle via point-in-polygon', () => {
    const t = shape({ kind: 'triangle', x: 0, y: 0, w: 100, h: 100 });
    expect(hitShape(t, 50, 70)).toBe(true); // low-centre is inside
    expect(hitShape(t, 5, 5)).toBe(false); // top corner of the box is outside the triangle
  });

  it('hit-tests a freehand path near its polyline', () => {
    const p = shape({ kind: 'path', x: 0, y: 0, w: 0, h: 0, strokeWidth: 6, points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ] });
    expect(hitShape(p, 50, 2)).toBe(true); // on the line
    expect(hitShape(p, 50, 60)).toBe(false); // far away
  });
});
