import { useRef, useCallback } from 'react';
import { ImageLayer, DrawLayer } from '../types';
import { useImageStorage } from './useImageStorage';

// 1/2 A4 à 150 DPI — côté long max
const MAX_DIMENSION = 877;

export type ImportResult =
  | { success: true; layer: ImageLayer }
  | { success: false; reason: string };

export function useImageImport() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { saveImage, canStoreMore } = useImageStorage();

  /** Crée l'élément input file (lazy, réutilisé) */
  const getInput = useCallback((): HTMLInputElement => {
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.style.display = 'none';
      document.body.appendChild(input);
      inputRef.current = input;
    }
    return inputRef.current;
  }, []);

  /** Redimensionne une ImageBitmap si nécessaire, retourne un dataURL JPEG */
  const processImage = useCallback(async (file: File): Promise<{ dataUrl: string; width: number; height: number }> => {
    // createImageBitmap gère HEIC + corrige orientation EXIF automatiquement
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    // Redimensionner si dépasse le max
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // Canvas offscreen pour compression JPEG
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    return { dataUrl, width, height };
  }, []);

  /** Ouvre le file picker et retourne une promesse avec le résultat */
  const importImage = useCallback((
    layers: DrawLayer[],
    viewportCenter: { x: number; y: number },
    viewportSize: { width: number; height: number },
  ): Promise<ImportResult> => {
    // Vérification quota AVANT d'ouvrir le picker
    const check = canStoreMore(layers);
    if (!check.allowed) {
      return Promise.resolve({ success: false, reason: check.reason! });
    }

    return new Promise((resolve) => {
      const input = getInput();

      const handleChange = async () => {
        input.removeEventListener('change', handleChange);
        const file = input.files?.[0];
        input.value = ''; // reset pour pouvoir ré-importer le même fichier

        if (!file) {
          resolve({ success: false, reason: '' }); // annulation silencieuse
          return;
        }

        try {
          const { dataUrl, width, height } = await processImage(file);

          // Générer un ID unique
          const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          const storageKey = id;

          // Sauvegarder dans localStorage séparé
          const saved = saveImage(storageKey, dataUrl);
          if (!saved) {
            resolve({ success: false, reason: 'Stockage plein — supprime des dessins ou images pour libérer de l\'espace.' });
            return;
          }

          // Calculer la taille d'affichage (max 80% du viewport visible)
          let displayW = width;
          let displayH = height;
          const maxW = viewportSize.width * 0.8;
          const maxH = viewportSize.height * 0.8;
          if (displayW > maxW || displayH > maxH) {
            const ratio = Math.min(maxW / displayW, maxH / displayH);
            displayW = Math.round(displayW * ratio);
            displayH = Math.round(displayH * ratio);
          }

          const layer: ImageLayer = {
            id,
            tool: 'image',
            imageStorageKey: storageKey,
            x: viewportCenter.x - displayW / 2,
            y: viewportCenter.y - displayH / 2,
            width: displayW,
            height: displayH,
            opacity: 1,
          };

          resolve({ success: true, layer });
        } catch (e) {
          console.error('[imageImport] processing failed', e);
          resolve({ success: false, reason: 'Impossible de lire cette image. Format non supporté ou fichier corrompu.' });
        }
      };

      input.addEventListener('change', handleChange);
      input.click();
    });
  }, [canStoreMore, getInput, processImage, saveImage]);

  return { importImage };
}
