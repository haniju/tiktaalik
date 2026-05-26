import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DrawLayer, ImageLayer } from '../types';

// Mock db.ts — in-memory store simulant IndexedDB
const imageStore = new Map<string, Blob>();

vi.mock('./db', () => ({
  dbPutImage: vi.fn(async (key: string, blob: Blob) => { imageStore.set(key, blob); }),
  dbGetImage: vi.fn(async (key: string) => imageStore.get(key) ?? null),
  dbDeleteImage: vi.fn(async (key: string) => { imageStore.delete(key); }),
  dbDeleteImages: vi.fn(async (keys: string[]) => { keys.forEach(k => imageStore.delete(k)); }),
  dataUrlToBlob: vi.fn((dataUrl: string) => new Blob([dataUrl], { type: 'image/jpeg' })),
  blobToDataUrl: vi.fn(async (blob: Blob) => {
    const text = await blob.text();
    return text;
  }),
  estimateStorageAvailable: vi.fn(async () => ({ allowed: true })),
}));

// Import APRÈS le mock
import { saveImage, loadImage, removeImage, removeImagesForLayers, canStoreMore } from './imageStorage';

function makeImageLayer(id: string): ImageLayer {
  return { id, tool: 'image', imageStorageKey: id, x: 0, y: 0, width: 100, height: 100, opacity: 1 };
}

beforeEach(() => {
  imageStore.clear();
  vi.clearAllMocks();
});

describe('imageStorage', () => {
  it('saveImage stocke et loadImage retrouve', async () => {
    const ok = await saveImage('abc', 'data:image/jpeg;base64,/9j/...');
    expect(ok).toBe(true);
    expect(await loadImage('abc')).toBe('data:image/jpeg;base64,/9j/...');
  });

  it('removeImage supprime la clé', async () => {
    await saveImage('abc', 'data:...');
    await removeImage('abc');
    expect(await loadImage('abc')).toBeNull();
  });

  it('removeImagesForLayers nettoie toutes les images', async () => {
    await saveImage('img1', 'data:1');
    await saveImage('img2', 'data:2');
    const layers: DrawLayer[] = [
      makeImageLayer('img1'),
      makeImageLayer('img2'),
      { id: 's1', tool: 'pen', color: '#000', width: 2, points: [0, 0], opacity: 1 },
    ];
    await removeImagesForLayers(layers);
    expect(await loadImage('img1')).toBeNull();
    expect(await loadImage('img2')).toBeNull();
  });

  it('canStoreMore retourne false quand limite atteinte (10 images)', async () => {
    const layers: DrawLayer[] = Array.from({ length: 10 }, (_, i) => makeImageLayer(`img${i}`));
    const check = await canStoreMore(layers);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Maximum');
  });

  it('canStoreMore retourne true quand quota OK', async () => {
    const layers: DrawLayer[] = [makeImageLayer('img1')];
    const check = await canStoreMore(layers);
    expect(check.allowed).toBe(true);
  });

  it('saveImage retourne false quand dbPutImage échoue', async () => {
    const { dbPutImage } = await import('./db');
    vi.mocked(dbPutImage).mockRejectedValueOnce(new Error('quota exceeded'));
    const ok = await saveImage('fail', 'data:...');
    expect(ok).toBe(false);
  });
});
