import { useState, useCallback } from 'react';

export type FabKey = 'pan' | 'select';

export interface FabPosition {
  x: number; // fraction 0..1 du viewport (centre du bouton)
  y: number; // fraction 0..1 du viewport (centre du bouton)
}

type FabPositions = Partial<Record<FabKey, FabPosition>>;

const STORAGE_KEY = 'sketchpad_fab_positions';

function loadPositions(): FabPositions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function persistPositions(positions: FabPositions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch { /* localStorage indisponible */ }
}

export function useFabPositions() {
  const [fabPositions, setFabPositions] = useState<FabPositions>(loadPositions);

  const setFabPosition = useCallback((key: FabKey, pos: FabPosition) => {
    setFabPositions(prev => {
      const next = { ...prev, [key]: pos };
      persistPositions(next);
      return next;
    });
  }, []);

  const resetFabPositions = useCallback(() => {
    setFabPositions({});
    persistPositions({});
  }, []);

  return { fabPositions, setFabPosition, resetFabPositions };
}
