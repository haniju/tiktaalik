import { Drawing, DrawLayer, Stroke, AirbrushStroke, TextBox } from '../types';

const STORAGE_KEY = 'sketchpad_drawings';

// Migration d'un dessin sauvegardé dans l'ancien format vers la pile unifiée
function migrateDrawing(d: Drawing): Drawing {
  let layers: DrawLayer[] = d.layers ?? [];

  // Legacy : strokes + airbrushStrokes séparés (avant v1.1)
  if (!d.layers) {
    layers = [
      ...((d.strokes ?? []) as Stroke[]),
      ...((d.airbrushStrokes ?? []) as AirbrushStroke[]),
    ];
  }

  // Legacy : textBoxes séparées (avant v1.3) — intégrer dans layers
  if (d.textBoxes && d.textBoxes.length > 0) {
    const alreadyMigrated = layers.some(l => l.tool === 'text');
    if (!alreadyMigrated) {
      const textLayers = (d.textBoxes as TextBox[]).map(tb => ({ ...tb, tool: 'text' as const }));
      layers = [...layers, ...textLayers];
    }
  }

  return { ...d, layers, background: d.background ?? '#ffffff', textBoxes: undefined };
}

export function useDrawingStorage() {
  const getAll = (): Drawing[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const drawings: Drawing[] = data ? JSON.parse(data) : [];
      return drawings.map(migrateDrawing);
    } catch { return []; }
  };

  const save = (drawing: Drawing): void => {
    const all = getAll();
    const idx = all.findIndex(d => d.id === drawing.id);
    if (idx >= 0) all[idx] = drawing;
    else all.unshift(drawing);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  const remove = (id: string): void => {
    const all = getAll().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  const rename = (id: string, name: string): void => {
    const all = getAll();
    const idx = all.findIndex(d => d.id === id);
    if (idx >= 0) { all[idx].name = name; all[idx].updatedAt = Date.now(); }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  return { getAll, save, remove, rename };
}
