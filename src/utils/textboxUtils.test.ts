import { describe, it, expect, beforeEach } from 'vitest';
import {
  estimateTextHeight,
  resolveTextBoxHeight,
  getTextBoxHitRect,
  isPointInTextBox,
  findTextBoxAtPoint,
  nextSelectionState,
  exitState,
  TextBoxSelectionState,
} from '../utils/textboxUtils';
import { TextBox } from '../types';

// ─── Fixtures ──────────────────────────────────────────────────────────────

function makeTb(overrides: Partial<TextBox> = {}): TextBox {
  return {
    id: 'tb1',
    x: 100, y: 100,
    width: 200,
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
    padding: 8,
    ...overrides,
  };
}

const DEFAULT_HEIGHT = 200; // hauteur arbitraire pour les tests

function makeHeights(tb: TextBox, h = DEFAULT_HEIGHT): Map<string, number> {
  return new Map([[tb.id, h]]);
}

// ─── estimateTextHeight ────────────────────────────────────────────────────

describe('estimateTextHeight', () => {
  it('retourne au moins 20px', () => {
    const tb = makeTb({ text: '', fontSize: 1, padding: 0 });
    expect(estimateTextHeight(tb)).toBeGreaterThanOrEqual(20);
  });

  it('augmente avec le nombre de lignes', () => {
    const one  = estimateTextHeight(makeTb({ text: 'a' }));
    const two  = estimateTextHeight(makeTb({ text: 'a\nb' }));
    const four = estimateTextHeight(makeTb({ text: 'a\nb\nc\nd' }));
    expect(two).toBeGreaterThan(one);
    expect(four).toBeGreaterThan(two);
  });

  it('augmente avec fontSize', () => {
    const small = estimateTextHeight(makeTb({ fontSize: 12 }));
    const large = estimateTextHeight(makeTb({ fontSize: 48 }));
    expect(large).toBeGreaterThan(small);
  });

  it('inclut le padding (×2)', () => {
    const noPad  = estimateTextHeight(makeTb({ padding: 0 }));
    const withPad = estimateTextHeight(makeTb({ padding: 20 }));
    expect(withPad - noPad).toBe(40);
  });
});

// ─── resolveTextBoxHeight ──────────────────────────────────────────────────

describe('resolveTextBoxHeight', () => {
  it('utilise manualHeight en priorité absolue', () => {
    const tb = makeTb({ manualHeight: 300 });
    expect(resolveTextBoxHeight(tb, 99)).toBe(300);
    expect(resolveTextBoxHeight(tb)).toBe(300);
  });

  it('utilise konvaHeight si disponible et pas de manualHeight', () => {
    const tb = makeTb();
    expect(resolveTextBoxHeight(tb, 150)).toBe(150);
  });

  it('enforce un minimum de 20px sur konvaHeight', () => {
    const tb = makeTb();
    expect(resolveTextBoxHeight(tb, 5)).toBe(20);
  });

  it('fallback sur estimation si ni manualHeight ni konvaHeight', () => {
    const tb = makeTb();
    const estimated = estimateTextHeight(tb);
    expect(resolveTextBoxHeight(tb)).toBe(estimated);
  });
});

// ─── getTextBoxHitRect ─────────────────────────────────────────────────────

describe('getTextBoxHitRect', () => {
  it('ajoute PAD sur les 4 côtés', () => {
    const tb = makeTb({ x: 100, y: 200, width: 150 });
    const r = getTextBoxHitRect(tb, 50, 4);
    expect(r.x).toBe(96);
    expect(r.y).toBe(196);
    expect(r.w).toBe(158);
    expect(r.h).toBe(58);
  });

  it('avec PAD=0 correspond exactement à la boîte', () => {
    const tb = makeTb({ x: 10, y: 20, width: 100 });
    const r = getTextBoxHitRect(tb, 40, 0);
    expect(r).toEqual({ x: 10, y: 20, w: 100, h: 40 });
  });
});

// ─── isPointInTextBox ──────────────────────────────────────────────────────

describe('isPointInTextBox', () => {
  const tb = makeTb({ x: 100, y: 100, width: 200 });
  const h = 50;
  const pad = 4;

  it('détecte un clic au centre', () => {
    expect(isPointInTextBox(200, 125, tb, h, pad)).toBe(true);
  });

  it('détecte un clic dans le coin haut-gauche (avec PAD)', () => {
    expect(isPointInTextBox(97, 97, tb, h, pad)).toBe(true);
  });

  it('rejette un clic juste hors de la zone (sans PAD)', () => {
    expect(isPointInTextBox(99, 125, tb, h, 0)).toBe(false);  // gauche
    expect(isPointInTextBox(301, 125, tb, h, 0)).toBe(false); // droite
    expect(isPointInTextBox(200, 99, tb, h, 0)).toBe(false);  // haut
    expect(isPointInTextBox(200, 151, tb, h, 0)).toBe(false); // bas
  });

  it('accepte les bords exacts', () => {
    expect(isPointInTextBox(100, 100, tb, h, 0)).toBe(true);
    expect(isPointInTextBox(300, 150, tb, h, 0)).toBe(true);
  });

  it('rejette un clic à côté (10px hors zone sans PAD)', () => {
    expect(isPointInTextBox(50, 125, tb, h, 0)).toBe(false);
    expect(isPointInTextBox(200, 200, tb, h, 0)).toBe(false);
  });

  it('accepte un clic à côté si dans le PAD', () => {
    expect(isPointInTextBox(98, 125, tb, h, 4)).toBe(true); // 2px hors, dans PAD=4
  });
});

// ─── findTextBoxAtPoint ────────────────────────────────────────────────────

describe('findTextBoxAtPoint', () => {
  const tb1 = makeTb({ id: 'tb1', x: 100, y: 100, width: 200 });
  const tb2 = makeTb({ id: 'tb2', x: 250, y: 100, width: 200 });
  const heights: Map<string, number> = new Map([['tb1', 50], ['tb2', 50]]);

  it('retourne null si aucune box touchée', () => {
    expect(findTextBoxAtPoint(0, 0, [tb1, tb2], heights, 0)).toBeNull();
  });

  it('retourne la box touchée', () => {
    const result = findTextBoxAtPoint(150, 120, [tb1, tb2], heights, 0);
    expect(result?.id).toBe('tb1');
  });

  it('en cas de chevauchement, retourne la dernière (z-index max)', () => {
    // tb1 et tb2 se chevauchent entre x=250 et x=300
    const result = findTextBoxAtPoint(270, 120, [tb1, tb2], heights, 0);
    expect(result?.id).toBe('tb2');
  });

  it('utilise le fallback estimateTextHeight si la hauteur est absente', () => {
    const emptyHeights = new Map<string, number>();
    const result = findTextBoxAtPoint(150, 120, [tb1], emptyHeights, 0);
    expect(result?.id).toBe('tb1');
  });

  it('retourne null sur liste vide', () => {
    expect(findTextBoxAtPoint(150, 120, [], heights, 0)).toBeNull();
  });
});

// ─── nextSelectionState ────────────────────────────────────────────────────

describe('nextSelectionState', () => {
  const tb = makeTb({ id: 'tb1', x: 100, y: 100, width: 200 });
  const heights = makeHeights(tb, 50);
  const INSIDE = [200, 125] as const;   // point dans la box
  const OUTSIDE = [0, 0] as const;      // point hors de toute box

  describe('depuis idle', () => {
    const state: TextBoxSelectionState = { kind: 'idle' };

    it('1er tap dans une box → selected (pas encore editing)', () => {
      const next = nextSelectionState(state, ...INSIDE, [tb], heights);
      expect(next).toEqual({ kind: 'selected', id: 'tb1' });
    });

    it('tap dans le vide → reste idle', () => {
      const next = nextSelectionState(state, ...OUTSIDE, [tb], heights);
      expect(next).toEqual({ kind: 'idle' });
    });
  });

  describe('depuis selected', () => {
    const state: TextBoxSelectionState = { kind: 'selected', id: 'tb1' };

    it('2ème tap sur la même box → editing', () => {
      const next = nextSelectionState(state, ...INSIDE, [tb], heights);
      expect(next).toEqual({ kind: 'editing', id: 'tb1' });
    });

    it('tap dans le vide → idle', () => {
      const next = nextSelectionState(state, ...OUTSIDE, [tb], heights);
      expect(next).toEqual({ kind: 'idle' });
    });

    it('tap sur une autre box → selected sur la nouvelle (reset double-tap)', () => {
      const tb2 = makeTb({ id: 'tb2', x: 400, y: 100, width: 200 });
      const h2 = new Map([['tb1', 50], ['tb2', 50]]);
      const next = nextSelectionState(state, 500, 125, [tb, tb2], h2);
      expect(next).toEqual({ kind: 'selected', id: 'tb2' });
    });
  });

  describe('depuis editing', () => {
    const state: TextBoxSelectionState = { kind: 'editing', id: 'tb1' };

    it('tap dans la même box → reste editing', () => {
      const next = nextSelectionState(state, ...INSIDE, [tb], heights);
      expect(next).toEqual({ kind: 'editing', id: 'tb1' });
    });

    it('tap dans le vide → idle', () => {
      const next = nextSelectionState(state, ...OUTSIDE, [tb], heights);
      expect(next).toEqual({ kind: 'idle' });
    });

    it('tap sur une autre box → selected sur la nouvelle (sort d\'édition, reset double-tap)', () => {
      const tb2 = makeTb({ id: 'tb2', x: 400, y: 100, width: 200 });
      const h2 = new Map([['tb1', 50], ['tb2', 50]]);
      const next = nextSelectionState(state, 500, 125, [tb, tb2], h2);
      expect(next).toEqual({ kind: 'selected', id: 'tb2' });
    });
  });
});

// ─── exitState ─────────────────────────────────────────────────────────────

describe('exitState', () => {
  it('idle → idle (no-op)', () => {
    expect(exitState({ kind: 'idle' })).toEqual({ kind: 'idle' });
  });

  it('selected → idle', () => {
    expect(exitState({ kind: 'selected', id: 'tb1' })).toEqual({ kind: 'idle' });
  });

  it('editing → idle', () => {
    expect(exitState({ kind: 'editing', id: 'tb1' })).toEqual({ kind: 'idle' });
  });
});
