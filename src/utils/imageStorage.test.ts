import { describe, it, expect, beforeEach, vi } from 'vitest';
import { saveImage, loadImage, removeImage, removeImagesForLayers, canStoreMore } from './imageStorage';
import { DrawLayer, ImageLayer } from '../types';

// Mock localStorage
const store: Record<string, string> = {};
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => { store[key] = value; });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => store[key] ?? null);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => { delete store[key]; });
});

function makeImageLayer(id: string): ImageLayer {
  return { id, tool: 'image', imageStorageKey: id, x: 0, y: 0, width: 100, height: 100, opacity: 1 };
}

describe('imageStorage', () => {
  it('saveImage stocke et loadImage retrouve', () => {
    const ok = saveImage('abc', 'data:image/jpeg;base64,/9j/...');
    expect(ok).toBe(true);
    expect(loadImage('abc')).toBe('data:image/jpeg;base64,/9j/...');
  });

  it('removeImage supprime la clé', () => {
    saveImage('abc', 'data:...');
    removeImage('abc');
    expect(loadImage('abc')).toBeNull();
  });

  it('removeImagesForLayers nettoie toutes les images', () => {
    saveImage('img1', 'data:1');
    saveImage('img2', 'data:2');
    const layers: DrawLayer[] = [
      makeImageLayer('img1'),
      makeImageLayer('img2'),
      { id: 's1', tool: 'pen', color: '#000', width: 2, points: [0, 0], opacity: 1 },
    ];
    removeImagesForLayers(layers);
    expect(loadImage('img1')).toBeNull();
    expect(loadImage('img2')).toBeNull();
  });

  it('canStoreMore retourne false quand limite atteinte (10 images)', () => {
    const layers: DrawLayer[] = Array.from({ length: 10 }, (_, i) => makeImageLayer(`img${i}`));
    const check = canStoreMore(layers);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Maximum');
  });

  it('canStoreMore retourne true quand quota OK', () => {
    const layers: DrawLayer[] = [makeImageLayer('img1')];
    const check = canStoreMore(layers);
    expect(check.allowed).toBe(true);
  });

  it('saveImage retourne false quand localStorage lance une erreur quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const ok = saveImage('fail', 'data:...');
    expect(ok).toBe(false);
  });
});
