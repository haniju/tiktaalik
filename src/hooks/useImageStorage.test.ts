import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useImageStorage } from './useImageStorage';
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

// Le hook ne contient pas de state React, on peut l'appeler directement
function getStorage() {
  return useImageStorage();
}

describe('useImageStorage', () => {
  it('saveImage stocke et loadImage retrouve', () => {
    const s = getStorage();
    const ok = s.saveImage('abc', 'data:image/jpeg;base64,/9j/...');
    expect(ok).toBe(true);
    expect(s.loadImage('abc')).toBe('data:image/jpeg;base64,/9j/...');
  });

  it('removeImage supprime la clé', () => {
    const s = getStorage();
    s.saveImage('abc', 'data:...');
    s.removeImage('abc');
    expect(s.loadImage('abc')).toBeNull();
  });

  it('removeImagesForLayers nettoie toutes les images', () => {
    const s = getStorage();
    s.saveImage('img1', 'data:1');
    s.saveImage('img2', 'data:2');
    const layers: DrawLayer[] = [
      makeImageLayer('img1'),
      makeImageLayer('img2'),
      { id: 's1', tool: 'pen', color: '#000', width: 2, points: [0, 0], opacity: 1 },
    ];
    s.removeImagesForLayers(layers);
    expect(s.loadImage('img1')).toBeNull();
    expect(s.loadImage('img2')).toBeNull();
  });

  it('canStoreMore retourne false quand limite atteinte (10 images)', () => {
    const s = getStorage();
    const layers: DrawLayer[] = Array.from({ length: 10 }, (_, i) => makeImageLayer(`img${i}`));
    const check = s.canStoreMore(layers);
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Maximum');
  });

  it('canStoreMore retourne true quand quota OK', () => {
    const s = getStorage();
    const layers: DrawLayer[] = [makeImageLayer('img1')];
    const check = s.canStoreMore(layers);
    expect(check.allowed).toBe(true);
  });

  it('saveImage retourne false quand localStorage lance une erreur quota', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const s = getStorage();
    const ok = s.saveImage('fail', 'data:...');
    expect(ok).toBe(false);
  });
});
