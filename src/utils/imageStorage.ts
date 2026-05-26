import { DrawLayer, ImageLayer } from '../types';
import { dbPutImage, dbGetImage, dbDeleteImage, dbDeleteImages, dataUrlToBlob, blobToDataUrl, estimateStorageAvailable } from './db';

const MAX_IMAGES_PER_DRAWING = 10;

/** Sauvegarde un dataURL en Blob dans IndexedDB */
export async function saveImage(id: string, dataUrl: string): Promise<boolean> {
  try {
    const blob = dataUrlToBlob(dataUrl);
    await dbPutImage(id, blob);
    return true;
  } catch (e) {
    console.error('[imageStorage] saveImage failed', e);
    return false;
  }
}

/** Charge une image depuis IndexedDB et retourne un dataURL */
export async function loadImage(key: string): Promise<string | null> {
  try {
    const blob = await dbGetImage(key);
    if (!blob) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

/** Charge une image depuis IndexedDB et retourne le Blob brut */
export async function loadImageBlob(key: string): Promise<Blob | null> {
  try {
    return await dbGetImage(key);
  } catch {
    return null;
  }
}

/** Supprime une image d'IndexedDB */
export async function removeImage(id: string): Promise<void> {
  await dbDeleteImage(id);
}

/** Supprime toutes les images associées aux layers d'un dessin */
export async function removeImagesForLayers(layers: DrawLayer[]): Promise<void> {
  const keys = layers
    .filter((l): l is ImageLayer => l.tool === 'image')
    .map(l => l.imageStorageKey);
  if (keys.length > 0) await dbDeleteImages(keys);
}

/** Compte le nombre d'images dans les layers d'un dessin */
export function getImageCount(layers: DrawLayer[]): number {
  return layers.filter(l => l.tool === 'image').length;
}

/** Vérifie si on peut encore stocker une image (limite par dessin + quota) */
export async function canStoreMore(layers: DrawLayer[]): Promise<{ allowed: boolean; reason?: string }> {
  const count = getImageCount(layers);
  if (count >= MAX_IMAGES_PER_DRAWING) {
    return { allowed: false, reason: `Maximum ${MAX_IMAGES_PER_DRAWING} images par dessin atteint.` };
  }
  return estimateStorageAvailable();
}
