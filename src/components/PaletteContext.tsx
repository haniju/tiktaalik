import { createContext, useContext } from 'react';
import { ColorPickerMode } from '../types';

export interface PaletteContextValue {
  palettes: Record<ColorPickerMode, string[]>;
  setPalette: (mode: ColorPickerMode, colors: string[]) => void;
}

/**
 * Fourni par SketchScreen : les palettes sont propres au dessin ouvert.
 * `null` hors provider → UnifiedColorPicker retombe sur les palettes globales (localStorage).
 */
export const PaletteContext = createContext<PaletteContextValue | null>(null);

export function usePalettes(): PaletteContextValue | null {
  return useContext(PaletteContext);
}
