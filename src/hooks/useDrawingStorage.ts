import { Drawing, DrawLayer, Stroke, AirbrushStroke, TextBox, ImageLayer } from '../types';

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

  const save = (drawing: Drawing): boolean => {
    const all = getAll();
    const idx = all.findIndex(d => d.id === drawing.id);
    if (idx >= 0) all[idx] = drawing;
    else all.unshift(drawing);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      return true;
    } catch (e) {
      console.error('[storage] save failed — localStorage full?', e);
      return false;
    }
  };

  const remove = (id: string): void => {
    // Nettoyer les clés localStorage des images associées
    const all = getAll();
    const drawing = all.find(d => d.id === id);
    if (drawing) {
      for (const layer of drawing.layers) {
        if (layer.tool === 'image') {
          localStorage.removeItem('img_' + (layer as ImageLayer).imageStorageKey);
        }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all.filter(d => d.id !== id)));
  };

  const rename = (id: string, name: string): void => {
    const all = getAll();
    const idx = all.findIndex(d => d.id === id);
    if (idx >= 0) { all[idx].name = name; all[idx].updatedAt = Date.now(); }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  };

  return { getAll, save, remove, rename };
}
