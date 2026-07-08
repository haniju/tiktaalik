import { describe, it, expect } from 'vitest';
import {
  clampEraserSize,
  eraserCursorProps,
  ERASER_MIN_SIZE,
  ERASER_MAX_SIZE,
  ERASER_DEFAULT_SIZE,
} from './eraserConfig';

describe('clampEraserSize', () => {
  it('laisse passer une valeur dans la plage', () => {
    expect(clampEraserSize(30)).toBe(30);
  });

  it('borne en dessous du minimum', () => {
    expect(clampEraserSize(0)).toBe(ERASER_MIN_SIZE);
    expect(clampEraserSize(-50)).toBe(ERASER_MIN_SIZE);
  });

  it('borne au-dessus du maximum', () => {
    expect(clampEraserSize(999)).toBe(ERASER_MAX_SIZE);
  });

  it('retourne le défaut pour NaN', () => {
    expect(clampEraserSize(NaN)).toBe(ERASER_DEFAULT_SIZE);
  });
});

describe('eraserCursorProps — feedback visuel = zone effacée', () => {
  it('le rayon du cercle est EXACTEMENT la taille de la gomme', () => {
    // Garantit que le slider (qui pilote eraserSize) change la taille du cercle
    // de feedback autour du curseur.
    expect(eraserCursorProps(20, 1).radius).toBe(20);
    expect(eraserCursorProps(45, 1).radius).toBe(45);
    expect(eraserCursorProps(8, 2.5).radius).toBe(8);
  });

  it('une variation de taille se répercute directement sur le rayon', () => {
    const small = eraserCursorProps(10, 1);
    const large = eraserCursorProps(60, 1);
    expect(large.radius).toBeGreaterThan(small.radius);
    expect(large.radius - small.radius).toBe(50);
  });

  it('compense le zoom pour garder un trait constant à l\'écran', () => {
    expect(eraserCursorProps(20, 1).strokeWidth).toBeCloseTo(1.5, 5);
    expect(eraserCursorProps(20, 2).strokeWidth).toBeCloseTo(0.75, 5);
    expect(eraserCursorProps(20, 2).dash).toEqual([2, 1.5]);
  });
});
