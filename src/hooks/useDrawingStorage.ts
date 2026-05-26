import { Drawing, DrawLayer, ImageLayer, Stroke, AirbrushStroke, TextBox } from '../types';
import { removeImagesForLayers, removeImage } from '../utils/imageStorage';
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
    if (drawing) {
      // Supprimer les images des layers actuels
      await removeImagesForLayers(drawing.layers ?? []);
      // Supprimer aussi les orphelins (images importées puis supprimées du canvas)
      const layerKeys = new Set(
        (drawing.layers ?? []).filter((l): l is ImageLayer => l.tool === 'image').map(l => l.imageStorageKey)
      );
      for (const key of drawing.imageKeys ?? []) {
        if (!layerKeys.has(key)) await removeImage(key);
      }
    }
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
