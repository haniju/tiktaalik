import { describe, it, expect } from 'vitest';
import {
  boundsCorners, oppositeCorner, boundsCenter, halfDiagonal,
  cornerScaleFactor, centerScaleFactor, MIN_SCALE_FACTOR,
} from './scaleHandles';
import { applyScale } from './bounds';
import { Stroke } from '../types';

// bbox 100×100 à (0,0) → coins (0,0) (100,0) (100,100) (0,100), centre (50,50)
const B = { x: 0, y: 0, width: 100, height: 100 };

describe('boundsCorners / oppositeCorner', () => {
  it('énumère les coins dans l’ordre horaire depuis le top-left', () => {
    expect(boundsCorners(B)).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 },
    ]);
  });

  it('associe chaque coin à sa diagonale', () => {
    expect(oppositeCorner(B, 0)).toEqual({ x: 100, y: 100 });
    expect(oppositeCorner(B, 1)).toEqual({ x: 0, y: 100 });
    expect(oppositeCorner(B, 2)).toEqual({ x: 0, y: 0 });
    expect(oppositeCorner(B, 3)).toEqual({ x: 100, y: 0 });
  });

  it('est involutif : l’opposé de l’opposé est le coin de départ', () => {
    const corners = boundsCorners(B);
    corners.forEach((c, i) => {
      const oppIdx = (i + 2) % 4;
      expect(oppositeCorner(B, oppIdx)).toEqual(c);
    });
  });

  it('gère une bbox décalée et non carrée', () => {
    const b = { x: 10, y: 20, width: 30, height: 5 };
    expect(oppositeCorner(b, 0)).toEqual({ x: 40, y: 25 });
    expect(boundsCenter(b)).toEqual({ x: 25, y: 22.5 });
    expect(halfDiagonal(b)).toBeCloseTo(Math.hypot(30, 5) / 2);
  });
});

describe('cornerScaleFactor', () => {
  const origin = { x: 100, y: 100 };          // coin opposé au top-left
  const refDist = Math.hypot(100, 100);       // dist(coin, origine) figée au dragStart

  it('vaut 1 quand le pointeur est resté sur le coin', () => {
    expect(cornerScaleFactor({ x: 0, y: 0 }, origin, refDist)).toBeCloseTo(1);
  });

  it('double quand le pointeur s’éloigne à 2× la distance à l’origine', () => {
    expect(cornerScaleFactor({ x: -100, y: -100 }, origin, refDist)).toBeCloseTo(2);
  });

  it('vaut 0.5 quand le pointeur est à mi-chemin de l’origine', () => {
    expect(cornerScaleFactor({ x: 50, y: 50 }, origin, refDist)).toBeCloseTo(0.5);
  });

  it('est continu quand le pointeur traverse l’origine', () => {
    const before = cornerScaleFactor({ x: 100.5, y: 100 }, origin, refDist);
    const after = cornerScaleFactor({ x: 99.5, y: 100 }, origin, refDist);
    expect(Math.abs(before - after)).toBeLessThan(1e-6);
  });

  it('plancher : ne s’effondre jamais à zéro sur l’origine exacte', () => {
    expect(cornerScaleFactor(origin, origin, refDist)).toBe(MIN_SCALE_FACTOR);
  });

  it('neutralise le facteur si la distance de référence est dégénérée', () => {
    // bbox de taille nulle → refDist 0 → pas de division
    expect(cornerScaleFactor({ x: 500, y: 500 }, origin, 0)).toBe(1);
  });
});

describe('centerScaleFactor', () => {
  const origin = { x: 50, y: 50 };
  const refDist = halfDiagonal(B); // ≈ 70.71

  it('vaut 1 au démarrage, pointeur sur le centre', () => {
    expect(centerScaleFactor(origin, origin, refDist)).toBeCloseTo(1);
  });

  it('agrandit vers le haut, réduit vers le bas', () => {
    expect(centerScaleFactor({ x: 50, y: 20 }, origin, refDist)).toBeGreaterThan(1);
    expect(centerScaleFactor({ x: 50, y: 80 }, origin, refDist)).toBeLessThan(1);
  });

  it('double la taille sur un drag d’une demi-diagonale vers le haut', () => {
    expect(centerScaleFactor({ x: 50, y: 50 - refDist }, origin, refDist)).toBeCloseTo(2);
  });

  it('ignore le déplacement horizontal', () => {
    const a = centerScaleFactor({ x: 50, y: 30 }, origin, refDist);
    const b = centerScaleFactor({ x: -900, y: 30 }, origin, refDist);
    expect(a).toBeCloseTo(b);
  });

  // Régression : une distance radiale signée par « au-dessus / en-dessous du centre »
  // sauterait de ~1.5 à ~0.5 en traversant y = cy sur un drag horizontal.
  it('reste continu quand un drag horizontal traverse la ligne du centre', () => {
    const above = centerScaleFactor({ x: 85, y: 49.999 }, origin, refDist);
    const below = centerScaleFactor({ x: 85, y: 50.001 }, origin, refDist);
    expect(Math.abs(above - below)).toBeLessThan(1e-3);
  });

  it('est monotone décroissant quand le pointeur descend', () => {
    const ys = [0, 25, 50, 75, 100, 200];
    const sfs = ys.map(y => centerScaleFactor({ x: 50, y }, origin, refDist));
    for (let i = 1; i < sfs.length; i++) expect(sfs[i]).toBeLessThanOrEqual(sfs[i - 1]);
  });

  it('plancher : un drag très bas ne passe pas sous MIN_SCALE_FACTOR', () => {
    expect(centerScaleFactor({ x: 50, y: 100000 }, origin, refDist)).toBe(MIN_SCALE_FACTOR);
  });

  it('neutralise le facteur sur une bbox dégénérée', () => {
    expect(centerScaleFactor({ x: 50, y: -500 }, origin, 0)).toBe(1);
  });
});

// ─── Intégration : le point fixe reste bien fixe une fois le scale appliqué ────

function stroke(points: number[]): Stroke {
  return { id: 's', tool: 'pen', points, color: '#000', width: 2 } as Stroke;
}

describe('point fixe du scale', () => {
  it('coin : le coin opposé ne bouge pas', () => {
    // Trait tracé le long de la diagonale de la bbox
    const s = stroke([0, 0, 100, 100]);
    const origin = oppositeCorner(B, 0); // (100,100)
    const refDist = Math.hypot(100, 100);
    // Le pointeur va à (-100,-100) → sf = 2
    const sf = cornerScaleFactor({ x: -100, y: -100 }, origin, refDist);
    const out = applyScale(s, sf, sf, origin.x, origin.y) as Stroke;
    // (100,100) invariant, (0,0) projeté à (-100,-100)
    expect(out.points[2]).toBeCloseTo(100);
    expect(out.points[3]).toBeCloseTo(100);
    expect(out.points[0]).toBeCloseTo(-100);
    expect(out.points[1]).toBeCloseTo(-100);
  });

  it('centre : le centre ne bouge pas et la bbox grandit symétriquement', () => {
    const s = stroke([0, 0, 100, 100]);
    const c = boundsCenter(B);
    const refDist = halfDiagonal(B);
    const sf = centerScaleFactor({ x: 50, y: 50 - refDist }, c, refDist); // = 2
    const out = applyScale(s, sf, sf, c.x, c.y) as Stroke;
    expect(out.points).toEqual([-50, -50, 150, 150]);
    // milieu du trait = centre, invariant
    expect((out.points[0] + out.points[2]) / 2).toBeCloseTo(c.x);
    expect((out.points[1] + out.points[3]) / 2).toBeCloseTo(c.y);
  });
});
