import { DrawLayer, ImageLayer } from '../types';

const IMAGE_KEY_PREFIX = 'img_';
const MAX_IMAGES_PER_DRAWING = 10;

// Taille max estimée par image en localStorage (base64 JPEG ~100-300 KB)
// localStorage total ~5-10 MB selon navigateur

export function useImageStorage() {
  /** Sauvegarde un dataURL dans une clé localStorage séparée */
  const saveImage = (id: string, dataUrl: string): boolean => {
    const key = IMAGE_KEY_PREFIX + id;
    try {
      localStorage.setItem(key, dataUrl);
      return true;
    } catch (e) {
      console.error('[imageStorage] saveImage failed — quota exceeded?', e);
      return false;
    }
  };

  /** Charge un dataURL depuis localStorage */
  const loadImage = (key: string): string | null => {
    try {
      return localStorage.getItem(IMAGE_KEY_PREFIX + key);
    } catch {
      return null;
    }
  };

  /** Supprime une image du localStorage */
  const removeImage = (id: string): void => {
    localStorage.removeItem(IMAGE_KEY_PREFIX + id);
  };

  /** Supprime toutes les images associées aux layers d'un dessin */
  const removeImagesForLayers = (layers: DrawLayer[]): void => {
    for (const layer of layers) {
      if (layer.tool === 'image') {
        removeImage((layer as ImageLayer).imageStorageKey);
      }
    }
  };

  /** Compte le nombre d'images dans les layers d'un dessin */
  const getImageCount = (layers: DrawLayer[]): number => {
    return layers.filter(l => l.tool === 'image').length;
  };

  /** Vérifie si on peut encore stocker une image (limite par dessin) */
  const canStoreMore = (layers: DrawLayer[]): { allowed: boolean; reason?: string } => {
    const count = getImageCount(layers);
    if (count >= MAX_IMAGES_PER_DRAWING) {
      return { allowed: false, reason: `Maximum ${MAX_IMAGES_PER_DRAWING} images par dessin atteint.` };
    }
    // Test d'écriture rapide pour vérifier le quota
    try {
      const testKey = '__storage_test__';
      const testData = 'x'.repeat(50_000); // ~50 KB test
      localStorage.setItem(testKey, testData);
      localStorage.removeItem(testKey);
      return { allowed: true };
    } catch {
      return { allowed: false, reason: 'Stockage plein — supprime des dessins ou images pour libérer de l\'espace.' };
    }
  };

  return { saveImage, loadImage, removeImage, removeImagesForLayers, getImageCount, canStoreMore };
}
