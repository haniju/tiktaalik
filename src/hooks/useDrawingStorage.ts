import { Drawing, DrawLayer, Stroke, AirbrushStroke, TextBox } from '../types';
import { removeImagesForLayers } from '../utils/imageStorage';
import { dbGetAllDrawings, dbGetDrawing, dbPutDrawing, dbDeleteDrawing } from '../utils/db';

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
  const getAll = async (): Promise<Drawing[]> => {
    try {
      const drawings = await dbGetAllDrawings();
      return drawings.map(migrateDrawing);
    } catch { return []; }
  };

  const save = async (drawing: Drawing): Promise<boolean> => {
    try {
      await dbPutDrawing(drawing);
      return true;
    } catch (e) {
      console.error('[storage] save failed', e);
      return false;
    }
  };

  const remove = async (id: string): Promise<void> => {
    const drawing = await dbGetDrawing(id);
    if (drawing) await removeImagesForLayers(drawing.layers ?? []);
    await dbDeleteDrawing(id);
  };

  const rename = async (id: string, name: string): Promise<void> => {
    const drawing = await dbGetDrawing(id);
    if (drawing) {
      drawing.name = name;
      drawing.updatedAt = Date.now();
      await dbPutDrawing(drawing);
    }
  };

  return { getAll, save, remove, rename };
}
