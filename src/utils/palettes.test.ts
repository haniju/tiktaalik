import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_PALETTES, loadPalette, savePalette, resolvePalettes } from './palettes';

describe('palettes — résolution session / dessin', () => {
  beforeEach(() => localStorage.clear());

  it('retombe sur les défauts sans rien de persisté', () => {
    expect(resolvePalettes()).toEqual(DEFAULT_PALETTES);
  });

  it('un dessin sans palettes propres hérite des palettes globales', () => {
    savePalette('drawing', ['#111111', ...DEFAULT_PALETTES.drawing.slice(1)]);
    expect(resolvePalettes().drawing[0]).toBe('#111111');
    expect(resolvePalettes().text).toEqual(DEFAULT_PALETTES.text);
  });

  it('les palettes du dessin priment sur les palettes globales', () => {
    savePalette('drawing', ['#111111', ...DEFAULT_PALETTES.drawing.slice(1)]);
    const resolved = resolvePalettes({ drawing: ['#222222', ...DEFAULT_PALETTES.drawing.slice(1)] });
    expect(resolved.drawing[0]).toBe('#222222');
  });

  it('complète une palette de dessin tronquée avec les défauts du mode', () => {
    const resolved = resolvePalettes({ background: ['#333333'] });
    expect(resolved.background[0]).toBe('#333333');
    expect(resolved.background.slice(1)).toEqual(DEFAULT_PALETTES.background.slice(1));
  });

  it('ignore une palette corrompue', () => {
    localStorage.setItem('sketchpad_palettes', 'pas du json');
    expect(loadPalette('drawing')).toEqual(DEFAULT_PALETTES.drawing);
    // @ts-expect-error — on simule une donnée corrompue venant d'IndexedDB
    expect(resolvePalettes({ drawing: 'nope' })).toEqual(DEFAULT_PALETTES);
  });
});
