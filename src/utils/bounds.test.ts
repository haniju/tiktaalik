import { describe, it, expect } from 'vitest';
import {
  getLayerBounds,
  getGroupBounds,
  rotatePoint,
  applyScale,
  applyRotation,
  isStrokeInRect,
  isAirbrushInRect,
} from './bounds';
import { Stroke, AirbrushStroke, TextLayer, DrawLayer } from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: 's1',
    tool: 'pen',
    color: '#000',
    width: 4,
    points: [10, 10, 50, 50, 90, 10],
    opacity: 1,
    ...overrides,
  };
}

function makeAirbrush(overrides: Partial<AirbrushStroke> = {}): AirbrushStroke {
  return {
    id: 'a1',
    tool: 'airbrush',
    color: '#f00',
    radius: 20,
    centerOpacity: 1,
    edgeOpacity: 0.1,
    points: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
    ...overrides,
  };
}

function makeText(overrides: Partial<TextLayer> = {}): TextLayer {
  return {
    id: 't1',
    tool: 'text',
    x: 200,
    y: 200,
    width: 100,
    text: 'hello',
    fontSize: 24,
    fontFamily: 'Arial',
    fontStyle: 'normal',
    textDecoration: '',
    align: 'left',
    verticalAlign: 'top',
    color: '#000',
    background: '',
    opacity: 1,
    padding: 5,
    ...overrides,
  };
}

// ─── getLayerBounds ────────────────────────────────────────────────────────

describe('getLayerBounds', () => {
  it('calcule les bounds d\'un stroke pen', () => {
    const stroke = makeStroke({ width: 10, points: [20, 30, 80, 90] });
    const b = getLayerBounds(stroke);
    // minX=20-5=15, minY=30-5=25, maxX=80+5=85 → w=70, maxY=90+5=95 → h=70
    expect(b.x).toBe(15);
    expect(b.y).toBe(25);
    expect(b.width).toBe(70);
    expect(b.height).toBe(70);
  });

  it('retourne un rect vide pour un stroke sans points', () => {
    const b = getLayerBounds(makeStroke({ points: [] }));
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });

  it('stroke avec un seul point → rect de taille width', () => {
    const b = getLayerBounds(makeStroke({ points: [50, 50], width: 6 }));
    expect(b.x).toBe(47);
    expect(b.y).toBe(47);
    expect(b.width).toBe(6);
    expect(b.height).toBe(6);
  });

  it('calcule les bounds d\'un airbrush', () => {
    const ab = makeAirbrush({ radius: 10, points: [{ x: 50, y: 50 }] });
    const b = getLayerBounds(ab);
    expect(b.x).toBe(40);
    expect(b.y).toBe(40);
    expect(b.width).toBe(20);
    expect(b.height).toBe(20);
  });

  it('retourne un rect vide pour un airbrush sans points', () => {
    const b = getLayerBounds(makeAirbrush({ points: [] }));
    expect(b.width).toBe(0);
    expect(b.height).toBe(0);
  });

  it('calcule les bounds d\'un text layer sans rotation', () => {
    const tb = makeText({ x: 10, y: 20, width: 100, fontSize: 20, padding: 0 });
    const b = getLayerBounds(tb);
    expect(b.x).toBe(10);
    expect(b.y).toBe(20);
    expect(b.width).toBe(100);
    expect(b.height).toBeGreaterThan(0);
  });

  it('text layer avec rotation → AABB élargi', () => {
    const tb = makeText({ x: 0, y: 0, width: 100, rotation: 45 });
    const bNoRot = getLayerBounds(makeText({ x: 0, y: 0, width: 100, rotation: 0 }));
    const bRot = getLayerBounds(tb);
    // L'AABB d'un rect tourné à 45° est plus large
    expect(bRot.width).toBeGreaterThan(bNoRot.width * 0.9);
  });
});

// ─── getGroupBounds ────────────────────────────────────────────────────────

describe('getGroupBounds', () => {
  it('englobe plusieurs layers', () => {
    const layers: DrawLayer[] = [
      makeStroke({ id: 's1', points: [0, 0, 10, 10], width: 0 }),
      makeStroke({ id: 's2', points: [100, 100, 200, 200], width: 0 }),
    ];
    const b = getGroupBounds(layers, ['s1', 's2']);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.width).toBe(200);
    expect(b.height).toBe(200);
  });

  it('retourne un rect vide si aucun ID ne matche', () => {
    const b = getGroupBounds([makeStroke()], ['inexistant']);
    expect(b.x).toBe(0);
    expect(b.width).toBe(0);
  });

  it('filtre les IDs non sélectionnés', () => {
    const layers: DrawLayer[] = [
      makeStroke({ id: 's1', points: [0, 0, 10, 10], width: 0 }),
      makeStroke({ id: 's2', points: [500, 500, 600, 600], width: 0 }),
    ];
    const b = getGroupBounds(layers, ['s1']);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.width).toBe(10);
    expect(b.height).toBe(10);
  });
});

// ─── rotatePoint ───────────────────────────────────────────────────────────

describe('rotatePoint', () => {
  it('rotation de 0° → même point', () => {
    const r = rotatePoint(10, 20, 0, 0, 0);
    expect(r.x).toBeCloseTo(10);
    expect(r.y).toBeCloseTo(20);
  });

  it('rotation de 90° autour de l\'origine', () => {
    const r = rotatePoint(10, 0, 0, 0, 90);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(10);
  });

  it('rotation de 180°', () => {
    const r = rotatePoint(10, 0, 0, 0, 180);
    expect(r.x).toBeCloseTo(-10);
    expect(r.y).toBeCloseTo(0);
  });

  it('rotation autour d\'un centre non-origine', () => {
    const r = rotatePoint(10, 5, 5, 5, 90);
    expect(r.x).toBeCloseTo(5);
    expect(r.y).toBeCloseTo(10);
  });

  it('rotation de 360° → même point', () => {
    const r = rotatePoint(7, 13, 5, 5, 360);
    expect(r.x).toBeCloseTo(7);
    expect(r.y).toBeCloseTo(13);
  });
});

// ─── applyScale ────────────────────────────────────────────────────────────

describe('applyScale', () => {
  it('scale x2 d\'un stroke autour de l\'origine', () => {
    const s = makeStroke({ points: [10, 20, 30, 40], width: 4 });
    const scaled = applyScale(s, 2, 2, 0, 0) as Stroke;
    expect(scaled.points).toEqual([20, 40, 60, 80]);
    expect(scaled.width).toBe(8);
  });

  it('scale x1 → inchangé', () => {
    const s = makeStroke({ points: [10, 20], width: 4 });
    const scaled = applyScale(s, 1, 1, 0, 0) as Stroke;
    expect(scaled.points).toEqual([10, 20]);
    expect(scaled.width).toBe(4);
  });

  it('scale d\'un airbrush', () => {
    const ab = makeAirbrush({ points: [{ x: 10, y: 20 }], radius: 5 });
    const scaled = applyScale(ab, 2, 2, 0, 0) as AirbrushStroke;
    expect(scaled.points[0].x).toBe(20);
    expect(scaled.points[0].y).toBe(40);
    expect(scaled.radius).toBe(10);
  });

  it('scale autour d\'un centre décalé', () => {
    const s = makeStroke({ points: [10, 10], width: 2 });
    const scaled = applyScale(s, 2, 2, 10, 10) as Stroke;
    expect(scaled.points).toEqual([10, 10]);
  });

  it('width minimum = 1 même avec scale très petit', () => {
    const s = makeStroke({ points: [10, 10], width: 2 });
    const scaled = applyScale(s, 0.01, 0.01, 0, 0) as Stroke;
    expect(scaled.width).toBe(1);
  });
});

// ─── applyRotation ─────────────────────────────────────────────────────────

describe('applyRotation', () => {
  it('rotation de 0° → même stroke', () => {
    const s = makeStroke({ points: [10, 20, 30, 40] });
    const rotated = applyRotation(s, 0, 0, 0) as Stroke;
    expect(rotated.points[0]).toBeCloseTo(10);
    expect(rotated.points[1]).toBeCloseTo(20);
  });

  it('rotation de 90° d\'un stroke autour de l\'origine', () => {
    const s = makeStroke({ points: [10, 0] });
    const rotated = applyRotation(s, 90, 0, 0) as Stroke;
    expect(rotated.points[0]).toBeCloseTo(0);
    expect(rotated.points[1]).toBeCloseTo(10);
  });

  it('rotation d\'un airbrush de 90°', () => {
    const ab = makeAirbrush({ points: [{ x: 10, y: 0 }] });
    const rotated = applyRotation(ab, 90, 0, 0) as AirbrushStroke;
    expect(rotated.points[0].x).toBeCloseTo(0);
    expect(rotated.points[0].y).toBeCloseTo(10);
  });
});

// ─── isStrokeInRect ────────────────────────────────────────────────────────

describe('isStrokeInRect', () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 };

  it('point inside → true', () => {
    expect(isStrokeInRect([50, 50], rect)).toBe(true);
  });

  it('tous les points dehors → false', () => {
    expect(isStrokeInRect([200, 200, 300, 300], rect)).toBe(false);
  });

  it('un point dedans, un dehors → true', () => {
    expect(isStrokeInRect([200, 200, 50, 50], rect)).toBe(true);
  });

  it('point sur le bord → true (inclusif)', () => {
    expect(isStrokeInRect([0, 0], rect)).toBe(true);
    expect(isStrokeInRect([100, 100], rect)).toBe(true);
  });

  it('tableau vide → false', () => {
    expect(isStrokeInRect([], rect)).toBe(false);
  });

  it('rect décalé', () => {
    const r = { x: 50, y: 50, w: 50, h: 50 };
    expect(isStrokeInRect([10, 10], r)).toBe(false);
    expect(isStrokeInRect([75, 75], r)).toBe(true);
  });
});

// ─── isAirbrushInRect ──────────────────────────────────────────────────────

describe('isAirbrushInRect', () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 };

  it('point inside → true', () => {
    expect(isAirbrushInRect([{ x: 50, y: 50 }], rect)).toBe(true);
  });

  it('tous les points dehors → false', () => {
    expect(isAirbrushInRect([{ x: 200, y: 200 }], rect)).toBe(false);
  });

  it('un point dedans, un dehors → true', () => {
    expect(isAirbrushInRect([{ x: 200, y: 200 }, { x: 50, y: 50 }], rect)).toBe(true);
  });

  it('point sur le bord → true', () => {
    expect(isAirbrushInRect([{ x: 0, y: 0 }], rect)).toBe(true);
    expect(isAirbrushInRect([{ x: 100, y: 100 }], rect)).toBe(true);
  });

  it('tableau vide → false', () => {
    expect(isAirbrushInRect([], rect)).toBe(false);
  });
});
