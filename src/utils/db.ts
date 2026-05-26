import { Drawing, DrawLayer, ImageLayer } from '../types';

const DB_NAME = 'tiktaalik_db';
const DB_VERSION = 1;
const STORE_DRAWINGS = 'drawings';
const STORE_IMAGES = 'images';

// Clés localStorage utilisées par l'ancienne implémentation
const LS_DRAWINGS_KEY = 'sketchpad_drawings';
const LS_IMAGE_PREFIX = 'img_';
const LS_MIGRATED_FLAG = 'idb_migrated';

// Singleton — une seule connexion ouverte
let dbInstance: IDBDatabase | null = null;

// ────────────────────────────────────────────
// Ouverture / création de la base
// ────────────────────────────────────────────

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_DRAWINGS)) {
        db.createObjectStore(STORE_DRAWINGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => {
      dbInstance = req.result;
      // Réinitialiser le singleton si la connexion se ferme
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────
// Helpers internes
// ────────────────────────────────────────────

function tx(store: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ────────────────────────────────────────────
// CRUD Drawings
// ────────────────────────────────────────────

export async function dbGetAllDrawings(): Promise<Drawing[]> {
  const store = await tx(STORE_DRAWINGS, 'readonly');
  return reqToPromise(store.getAll());
}

export async function dbGetDrawing(id: string): Promise<Drawing | undefined> {
  const store = await tx(STORE_DRAWINGS, 'readonly');
  return reqToPromise(store.get(id));
}

export async function dbPutDrawing(drawing: Drawing): Promise<void> {
  const store = await tx(STORE_DRAWINGS, 'readwrite');
  await reqToPromise(store.put(drawing));
}

export async function dbDeleteDrawing(id: string): Promise<void> {
  const store = await tx(STORE_DRAWINGS, 'readwrite');
  await reqToPromise(store.delete(id));
}

// ────────────────────────────────────────────
// CRUD Images (stockées en Blob)
// ────────────────────────────────────────────

export async function dbPutImage(key: string, blob: Blob): Promise<void> {
  const store = await tx(STORE_IMAGES, 'readwrite');
  await reqToPromise(store.put({ key, blob }));
}

export async function dbGetImage(key: string): Promise<Blob | null> {
  const store = await tx(STORE_IMAGES, 'readonly');
  const record: { key: string; blob: Blob } | undefined = await reqToPromise(store.get(key));
  return record?.blob ?? null;
}

export async function dbDeleteImage(key: string): Promise<void> {
  const store = await tx(STORE_IMAGES, 'readwrite');
  await reqToPromise(store.delete(key));
}

export async function dbDeleteImages(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const db = await openDB();
  const transaction = db.transaction(STORE_IMAGES, 'readwrite');
  const store = transaction.objectStore(STORE_IMAGES);
  for (const key of keys) {
    store.delete(key);
  }
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ────────────────────────────────────────────
// Estimation de quota
// ────────────────────────────────────────────

const MIN_AVAILABLE_BYTES = 5 * 1024 * 1024; // 5 Mo de marge

export async function estimateStorageAvailable(): Promise<{ allowed: boolean; reason?: string }> {
  if (navigator.storage?.estimate) {
    try {
      const { quota, usage } = await navigator.storage.estimate();
      if (quota && usage && (quota - usage) < MIN_AVAILABLE_BYTES) {
        return { allowed: false, reason: 'Stockage plein — supprime des dessins ou images pour libérer de l\'espace.' };
      }
    } catch {
      // API indisponible — on laisse passer
    }
  }
  return { allowed: true };
}

// ────────────────────────────────────────────
// Conversion dataUrl ↔ Blob
// ────────────────────────────────────────────

export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ────────────────────────────────────────────
// Migration localStorage → IndexedDB (one-shot)
// ────────────────────────────────────────────

export function isMigrationDone(): boolean {
  try {
    return localStorage.getItem(LS_MIGRATED_FLAG) === '1';
  } catch {
    return false;
  }
}

export async function migrateFromLocalStorage(): Promise<void> {
  if (isMigrationDone()) return;

  // Vérifier s'il y a des données à migrer
  let hasData = false;

  try {
    // Migrer les dessins
    const raw = localStorage.getItem(LS_DRAWINGS_KEY);
    if (raw) {
      hasData = true;
      const drawings: Drawing[] = JSON.parse(raw);
      for (const drawing of drawings) {
        await dbPutDrawing(drawing);
      }
    }

    // Migrer les images (clés img_*)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LS_IMAGE_PREFIX)) continue;

      hasData = true;
      const dataUrl = localStorage.getItem(key);
      if (!dataUrl) continue;

      // Retirer le préfixe img_ pour obtenir la clé IndexedDB
      const imageKey = key.slice(LS_IMAGE_PREFIX.length);
      const blob = dataUrlToBlob(dataUrl);
      await dbPutImage(imageKey, blob);
    }

    // Marquer la migration comme terminée
    localStorage.setItem(LS_MIGRATED_FLAG, '1');

    // Nettoyer localStorage pour libérer l'espace
    if (hasData) {
      localStorage.removeItem(LS_DRAWINGS_KEY);
      // Supprimer les clés img_* (itérer à l'envers car removeItem modifie l'index)
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(LS_IMAGE_PREFIX)) keysToRemove.push(key);
      }
      for (const key of keysToRemove) {
        localStorage.removeItem(key);
      }
      console.log('[db] migration localStorage → IndexedDB terminée, espace libéré');
    }
  } catch (e) {
    console.error('[db] migration échouée — sera retentée au prochain lancement', e);
    // Ne pas poser le flag : la migration sera retentée
  }
}

// ────────────────────────────────────────────
// Helper : extraire les clés image d'une liste de layers
// ────────────────────────────────────────────

export function getImageKeysFromLayers(layers: DrawLayer[]): string[] {
  return layers
    .filter((l): l is ImageLayer => l.tool === 'image')
    .map(l => l.imageStorageKey);
}
