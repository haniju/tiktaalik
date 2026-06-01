import { describe, it, expect } from 'vitest';
import { movingAverageSmooth, bezierSmooth } from './smoothing';

// ─── Helpers ───

/** Flat array → array de {x,y} */
function toPoints(flat: number[]): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  return pts;
}

/** Points formant un zigzag (jitter simulé) */
function zigzagPoints(n: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => ({
    x: i * 10,
    y: i % 2 === 0 ? 0 : 5,
  }));
}

/** Ligne droite */
function straightLine(n: number): Array<{ x: number; y: number }> {
  return Array.from({ length: n }, (_, i) => ({ x: i * 10, y: 0 }));
}

// ─── movingAverageSmooth ───

describe('movingAverageSmooth', () => {
  it('retourne un tableau vide pour un input vide', () => {
    expect(movingAverageSmooth([], 5)).toEqual([]);
  });

  it('retourne le point tel quel pour un seul point', () => {
    const result = movingAverageSmooth([{ x: 10, y: 20 }], 5);
    expect(result).toEqual([10, 20]);
  });

  it('produit un flat array de même longueur que l\'input', () => {
    const pts = zigzagPoints(10);
    const result = movingAverageSmooth(pts, 5);
    expect(result.length).toBe(pts.length * 2);
  });

  it('conserve le premier et dernier Y proches des originaux', () => {
    const pts = zigzagPoints(10);
    const result = movingAverageSmooth(pts, 3);
    const smoothed = toPoints(result);
    // Premier point Y : fenêtre tronquée → moyenne de 2 voisins seulement
    expect(Math.abs(smoothed[0].y - pts[0].y)).toBeLessThan(3);
    // Dernier point Y : idem
    expect(Math.abs(smoothed[pts.length - 1].y - pts[pts.length - 1].y)).toBeLessThan(3);
  });

  it('réduit l\'amplitude du jitter (zigzag)', () => {
    const pts = zigzagPoints(20);
    const result = movingAverageSmooth(pts, 7);
    const smoothed = toPoints(result);
    // L'amplitude Y du zigzag original est 5. Après lissage elle doit être réduite.
    const midIdx = 10; // point au milieu
    const originalAmplitude = Math.abs(pts[midIdx].y - pts[midIdx - 1].y);
    const smoothedAmplitude = Math.abs(smoothed[midIdx].y - smoothed[midIdx - 1].y);
    expect(smoothedAmplitude).toBeLessThan(originalAmplitude);
  });

  it('ne modifie pas le Y d\'une ligne droite horizontale', () => {
    const pts = straightLine(10);
    const result = movingAverageSmooth(pts, 7);
    const smoothed = toPoints(result);
    // Y doit rester 0 (la moyenne de 0 = 0)
    for (let i = 0; i < pts.length; i++) {
      expect(smoothed[i].y).toBeCloseTo(0, 5);
    }
  });

  it('windowSize=1 ne change pas les points', () => {
    const pts = zigzagPoints(5);
    const result = movingAverageSmooth(pts, 1);
    const smoothed = toPoints(result);
    for (let i = 0; i < pts.length; i++) {
      expect(smoothed[i].x).toBeCloseTo(pts[i].x, 5);
      expect(smoothed[i].y).toBeCloseTo(pts[i].y, 5);
    }
  });
});

// ─── bezierSmooth ───

describe('bezierSmooth', () => {
  it('retourne un tableau vide pour un input vide', () => {
    expect(bezierSmooth([], 0.5, 8)).toEqual([]);
  });

  it('retourne le point tel quel pour un seul point', () => {
    const result = bezierSmooth([{ x: 5, y: 10 }], 0.5, 8);
    expect(result).toEqual([5, 10]);
  });

  it('retourne les deux points pour deux points', () => {
    const result = bezierSmooth([{ x: 0, y: 0 }, { x: 10, y: 10 }], 0.5, 8);
    expect(result).toEqual([0, 0, 10, 10]);
  });

  it('produit plus de points que l\'input (interpolation)', () => {
    const pts = zigzagPoints(5);
    const samplesPerSegment = 8;
    const result = bezierSmooth(pts, 0.5, samplesPerSegment);
    // 5 points → 4 segments → 1 (premier) + 4×8 = 33 points → 66 valeurs
    expect(result.length).toBe((1 + (pts.length - 1) * samplesPerSegment) * 2);
  });

  it('commence et finit aux mêmes points que l\'input', () => {
    const pts = zigzagPoints(10);
    const result = bezierSmooth(pts, 0.5, 8);
    const smoothed = toPoints(result);
    expect(smoothed[0].x).toBeCloseTo(pts[0].x, 5);
    expect(smoothed[0].y).toBeCloseTo(pts[0].y, 5);
    expect(smoothed[smoothed.length - 1].x).toBeCloseTo(pts[pts.length - 1].x, 5);
    expect(smoothed[smoothed.length - 1].y).toBeCloseTo(pts[pts.length - 1].y, 5);
  });

  it('lisse un zigzag (points intermédiaires plus proches de la moyenne)', () => {
    const pts = zigzagPoints(10);
    const result = bezierSmooth(pts, 0.5, 8);
    const smoothed = toPoints(result);
    // Points interpolés au milieu d'un segment doivent être entre les extrêmes Y
    // du zigzag — pas au-delà
    const midPoint = smoothed[Math.floor(smoothed.length / 2)];
    expect(midPoint.y).toBeGreaterThanOrEqual(-1);
    expect(midPoint.y).toBeLessThanOrEqual(6);
  });

  it('tightness=0 produit des segments quasi-droits', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }];
    const result = bezierSmooth(pts, 0, 4);
    const smoothed = toPoints(result);
    // Avec tightness=0, les control points collapsent → interpolation linéaire
    // Le point milieu du 1er segment doit être ~(5, 5)
    expect(smoothed[2].x).toBeCloseTo(5, 0);
    expect(smoothed[2].y).toBeCloseTo(5, 0);
  });

  it('ne modifie pas une ligne droite', () => {
    const pts = straightLine(5);
    const result = bezierSmooth(pts, 0.5, 4);
    const smoothed = toPoints(result);
    for (const p of smoothed) {
      expect(p.y).toBeCloseTo(0, 5);
    }
  });
});

// ─── Intégration : mode de lissage → smoothingMode sur le stroke ───

describe('smoothingMode tagging', () => {
  // Simule la logique de sélection de mode dans handleMouseDown
  function getSmoothingMode(bezier: boolean, ma: boolean): 'bezier' | 'movingAverage' | undefined {
    return bezier ? 'bezier' : ma ? 'movingAverage' : undefined;
  }

  it('retourne undefined quand aucun mode avancé actif (classique)', () => {
    expect(getSmoothingMode(false, false)).toBeUndefined();
  });

  it('retourne "bezier" quand bezierSmoothing est actif', () => {
    expect(getSmoothingMode(true, false)).toBe('bezier');
  });

  it('retourne "movingAverage" quand movingAverageSmoothing est actif', () => {
    expect(getSmoothingMode(false, true)).toBe('movingAverage');
  });

  it('bezier a priorité si les deux sont actifs (ne devrait pas arriver)', () => {
    expect(getSmoothingMode(true, true)).toBe('bezier');
  });
});

// ─── Tap simple (1 point) → micro-offset pour rendu Konva ───

describe('tap simple — finalisation stroke avec lissage avancé', () => {
  // Simule la logique de handleMouseUp : si le lissage avancé retourne
  // seulement 2 valeurs (un seul point), on ajoute un micro-offset
  // pour que Konva Line rende un point rond visible (lineCap="round").
  function finalizeSinglePoint(
    rawPoints: Array<{ x: number; y: number }>,
    mode: 'bezier' | 'movingAverage',
  ): number[] {
    let finalPoints: number[];
    if (mode === 'bezier') {
      finalPoints = bezierSmooth(rawPoints, 0.5, 8);
    } else {
      finalPoints = movingAverageSmooth(rawPoints, 7);
    }
    // Guard identique à useCanvasGestures handleMouseUp
    if (finalPoints.length === 2) {
      finalPoints = [finalPoints[0], finalPoints[1], finalPoints[0] + 0.1, finalPoints[1] + 0.1];
    }
    return finalPoints;
  }

  it('bezier — tap simple produit au moins 4 valeurs (2 points)', () => {
    const result = finalizeSinglePoint([{ x: 100, y: 200 }], 'bezier');
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(200);
    expect(result[2]).toBeCloseTo(100.1, 5);
    expect(result[3]).toBeCloseTo(200.1, 5);
  });

  it('movingAverage — tap simple produit au moins 4 valeurs (2 points)', () => {
    const result = finalizeSinglePoint([{ x: 50, y: 75 }], 'movingAverage');
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[0]).toBe(50);
    expect(result[1]).toBe(75);
    expect(result[2]).toBeCloseTo(50.1, 5);
    expect(result[3]).toBeCloseTo(75.1, 5);
  });

  it('bezier — tracé normal (>1 point) n\'est pas modifié par le guard', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }];
    const result = finalizeSinglePoint(pts, 'bezier');
    // 3 points → interpolation → bien plus de 4 valeurs
    expect(result.length).toBeGreaterThan(4);
  });

  it('movingAverage — tracé normal (>1 point) n\'est pas modifié par le guard', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 5 }];
    const result = finalizeSinglePoint(pts, 'movingAverage');
    expect(result.length).toBe(6); // 3 points × 2
  });
});

// ─── Facteur de conversion par mode ───

describe('smoothingScale par mode', () => {
  function getSmoothingScale(bezier: boolean, ma: boolean): number {
    return bezier ? 1.8 : ma ? 0.84 : 12;
  }

  it('classique → facteur 12', () => {
    expect(getSmoothingScale(false, false)).toBe(12);
  });

  it('bézier → facteur 1.8', () => {
    expect(getSmoothingScale(true, false)).toBe(1.8);
  });

  it('moyenne glissante → facteur 0.84', () => {
    expect(getSmoothingScale(false, true)).toBe(0.84);
  });
});
