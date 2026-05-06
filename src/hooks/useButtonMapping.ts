import { useState, useEffect, useCallback, useRef } from 'react';

export type MappableAction = 'toggle_pan';

// Seuil (ms) pour distinguer tap (toggle) du hold (momentané)
const HOLD_THRESHOLD = 250;

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

/** Actions pour chaque MappableAction : toggle (tap court), enter (hold start), exit (hold release) */
export interface HoldAwareActions {
  toggle: Record<MappableAction, () => void>;
  enter: Record<MappableAction, () => void>;
  exit: Record<MappableAction, () => void>;
}

export function useButtonMapping(actions: HoldAwareActions) {
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

  // --- Listener global : hold-aware (keydown/keyup avec seuil) ---
  useEffect(() => {
    if (listening) return;
    // Track par clé : timer du hold + flag isHolding
    const holdState = new Map<string, { timer: ReturnType<typeof setTimeout>; holding: boolean }>();

    const keyId = (e: KeyboardEvent) => `${e.key}:${e.code}`;

    const downHandler = (e: KeyboardEvent) => {
      // Ignorer les keydown qui viennent d'un champ de saisie (clavier virtuel)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      const match = mappingsRef.current.find(
        m => m.key === e.key && m.code === e.code && m.action !== null
      );
      if (!match) return;
      console.log('[buttonMapping] keydown intercepté:', e.key, e.code, '→', match.action);
      e.preventDefault();
      e.stopPropagation();

      const id = keyId(e);
      // Ignore key repeat (autorepeat pendant hold)
      if (holdState.has(id)) return;

      const timer = setTimeout(() => {
        // Seuil dépassé → mode hold, entrer en pan
        const entry = holdState.get(id);
        if (entry) {
          entry.holding = true;
          actionsRef.current.enter[match.action!]();
        }
      }, HOLD_THRESHOLD);

      holdState.set(id, { timer, holding: false });
    };

    const upHandler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      const match = mappingsRef.current.find(
        m => m.key === e.key && m.code === e.code && m.action !== null
      );
      if (!match) return;
      e.preventDefault();
      e.stopPropagation();

      const id = keyId(e);
      const entry = holdState.get(id);
      if (!entry) return;

      clearTimeout(entry.timer);
      holdState.delete(id);

      if (entry.holding) {
        // Relâchement après hold → sortir du pan
        actionsRef.current.exit[match.action!]();
      } else {
        // Relâchement avant seuil → toggle
        actionsRef.current.toggle[match.action!]();
      }
    };

    document.addEventListener('keydown', downHandler, { capture: true });
    document.addEventListener('keyup', upHandler, { capture: true });
    return () => {
      document.removeEventListener('keydown', downHandler, { capture: true });
      document.removeEventListener('keyup', upHandler, { capture: true });
      // Cleanup timers
      holdState.forEach(entry => clearTimeout(entry.timer));
      holdState.clear();
    };
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
