import { ColorPickerMode, PaletteMap } from '../types';

export type { ColorPickerMode };

const STORAGE_KEY = 'sketchpad_palettes';

export const DEFAULT_PALETTES: Record<ColorPickerMode, string[]> = {
  drawing:    ['#e63946', '#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#000000', '#ffffff'],
  background: ['#ffffff', '#f5f0e8', '#fef9ef', '#e8f4f8', '#f0ede6', '#1a1a2e', '#2d3748', '#000000'],
  text:       ['#e63946', '#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#000000', '#ffffff'],
};

const MODES = Object.keys(DEFAULT_PALETTES) as ColorPickerMode[];

function loadAll(): PaletteMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

/** Complète une palette potentiellement incomplète/corrompue avec les défauts du mode. */
function coerce(mode: ColorPickerMode, saved: unknown): string[] {
  const defaults = DEFAULT_PALETTES[mode];
  if (!Array.isArray(saved)) return [...defaults];
  return defaults.map((d, i) => (typeof saved[i] === 'string' ? saved[i] : d));
}

/** Palette persistée globalement (niveau session) pour un mode. */
export function loadPalette(mode: ColorPickerMode): string[] {
  return coerce(mode, loadAll()[mode]);
}

export function savePalette(mode: ColorPickerMode, colors: string[]) {
  try {
    const all = loadAll();
    all[mode] = colors;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* localStorage indisponible */ }
}

/**
 * Palettes effectives d'un dessin : défauts < palettes globales (session) < palettes du dessin.
 * Un dessin sans palettes propres hérite donc des dernières couleurs utilisées.
 */
export function resolvePalettes(drawingPalettes?: PaletteMap): Record<ColorPickerMode, string[]> {
  const global = loadAll();
  const out = {} as Record<ColorPickerMode, string[]>;
  for (const mode of MODES) {
    out[mode] = coerce(mode, drawingPalettes?.[mode] ?? global[mode]);
  }
  return out;
}
