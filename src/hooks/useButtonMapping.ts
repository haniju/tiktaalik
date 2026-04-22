import { useState, useEffect, useCallback, useRef } from 'react';

export type MappableAction = 'toggle_pan';

export interface ButtonMapping {
  key: string;       // event.key (ex: "AudioVolumeDown", "F3")
  code: string;      // event.code (ex: "VolumeDown", "F3")
  keyCode: number;   // event.keyCode (legacy, pour identification)
  label: string;     // nom affiché (ex: "Volume Down", "F3")
  action: MappableAction | null;
}

const STORAGE_KEY = 'sketchpad_button_mapping';

const ACTION_LABELS: Record<MappableAction, string> = {
  toggle_pan: 'Toggle Pan',
};

function loadMappings(): ButtonMapping[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistMappings(mappings: ButtonMapping[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch {}
}

// Label lisible pour un event.key
function keyLabel(e: KeyboardEvent): string {
  const labels: Record<string, string> = {
    AudioVolumeDown: 'Volume Down',
    AudioVolumeUp: 'Volume Up',
  };
  return labels[e.key] ?? e.key;
}

export function useButtonMapping(actions: Record<MappableAction, () => void>) {
  const [mappings, setMappings] = useState<ButtonMapping[]>(loadMappings);
  const [listening, setListening] = useState(false);
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  // --- Mode listen : capture les boutons pressés ---
  useEffect(() => {
    if (!listening) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const id = `${e.key}:${e.code}:${e.keyCode}`;
      setMappings(prev => {
        const exists = prev.some(m => `${m.key}:${m.code}:${m.keyCode}` === id);
        if (exists) return prev;
        const next = [...prev, { key: e.key, code: e.code, keyCode: e.keyCode, label: keyLabel(e), action: null }];
        persistMappings(next);
        return next;
      });
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [listening]);

  // --- Listener global : déclenche les actions mappées (hors mode listen) ---
  useEffect(() => {
    if (listening) return;
    const handler = (e: KeyboardEvent) => {
      const match = mappingsRef.current.find(
        m => m.key === e.key && m.code === e.code && m.action !== null
      );
      if (match) {
        e.preventDefault();
        e.stopPropagation();
        actionsRef.current[match.action!]();
      }
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [listening]);

  const startListening = useCallback(() => setListening(true), []);
  const stopListening = useCallback(() => setListening(false), []);

  const setAction = useCallback((index: number, action: MappableAction | null) => {
    setMappings(prev => {
      const next = prev.map((m, i) => i === index ? { ...m, action } : m);
      persistMappings(next);
      return next;
    });
  }, []);

  const removeMapping = useCallback((index: number) => {
    setMappings(prev => {
      const next = prev.filter((_, i) => i !== index);
      persistMappings(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setMappings([]);
    persistMappings([]);
  }, []);

  return {
    mappings,
    listening,
    startListening,
    stopListening,
    setAction,
    removeMapping,
    clearAll,
    ACTION_LABELS,
  };
}
