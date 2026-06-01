import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types publics ───────────────────────────────────────────────────────────

export type MappableMode = 'select' | 'pan';
export type GestureType = 'click' | 'hold' | 'double_click';
export type ActionType = 'toggle' | 'toggle_and_release';

export interface MappingBinding {
  gesture: GestureType;
  actionType: ActionType;
  mode: MappableMode;
}

export interface ButtonMapping {
  key: string;       // event.key (ex: "AudioVolumeDown", "F3")
  code: string;      // event.code (ex: "VolumeDown", "F3")
  keyCode: number;   // event.keyCode (legacy, pour identification)
  label: string;     // nom affiché (ex: "Volume Down", "F3")
  bindings: MappingBinding[];
}

// ─── Labels pour l'UI ────────────────────────────────────────────────────────

export const GESTURE_LABELS: Record<GestureType, string> = {
  click: 'Click simple',
  hold: 'Maintien',
  double_click: 'Double click',
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  toggle: 'Toggle',
  toggle_and_release: 'Maintenu',
};

export const MODE_LABELS: Record<MappableMode, string> = {
  select: 'Sélection',
  pan: 'Pan',
};

// ─── Constantes ──��───────────────────────────────────────────────────────────

const DEFAULT_HOLD_THRESHOLD = 250;
const DEFAULT_DOUBLE_CLICK_WINDOW = 300;
const STORAGE_KEY = 'sketchpad_button_mapping';
const THRESHOLDS_KEY = 'sketchpad_button_thresholds';

export interface ButtonThresholds {
  holdThreshold: number;
  doubleClickWindow: number;
}

function loadThresholds(): ButtonThresholds {
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { holdThreshold: DEFAULT_HOLD_THRESHOLD, doubleClickWindow: DEFAULT_DOUBLE_CLICK_WINDOW };
}

function persistThresholds(t: ButtonThresholds) {
  try { localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

// ─── Persistence & migration ─────────────────────────────────────────────────

interface LegacyMapping {
  key: string;
  code: string;
  keyCode: number;
  label: string;
  action: string | null;
}

function migrateLegacy(raw: LegacyMapping[]): ButtonMapping[] {
  return raw.map(m => {
    if ('action' in m && !('bindings' in m)) {
      const bindings: MappingBinding[] = [];
      if (m.action === 'toggle_pan') {
        bindings.push({ gesture: 'click', actionType: 'toggle', mode: 'pan' });
        bindings.push({ gesture: 'hold', actionType: 'toggle_and_release', mode: 'pan' });
      }
      return { key: m.key, code: m.code, keyCode: m.keyCode, label: m.label, bindings };
    }
    return m as unknown as ButtonMapping;
  });
}

function loadMappings(): ButtonMapping[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Détecte ancien format (a "action" au lieu de "bindings")
    if (parsed.length > 0 && 'action' in parsed[0] && !('bindings' in parsed[0])) {
      const migrated = migrateLegacy(parsed);
      persistMappings(migrated);
      return migrated;
    }
    return parsed;
  } catch { return []; }
}

function persistMappings(mappings: ButtonMapping[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch { /* localStorage indisponible */ }
}

// Label lisible pour un event clavier
function keyLabel(e: KeyboardEvent): string {
  const labels: Record<string, string> = {
    AudioVolumeDown: 'Volume Down',
    AudioVolumeUp: 'Volume Up',
  };
  if (labels[e.key]) return labels[e.key];
  if (e.key === 'Unidentified') return `Bouton #${e.keyCode}`;
  return e.key;
}

// ─── Interface actions ───────��───────────────────────────────────────────────

/** Actions pour chaque MappableMode : toggle (tap court), enter (hold start), exit (hold release) */
export interface HoldAwareActions {
  toggle: Record<MappableMode, () => void>;
  enter: Record<MappableMode, () => void>;
  exit: Record<MappableMode, () => void>;
}

// ─── Hook principal ──────────────────────────────────────────────────────────

export function useButtonMapping(actions: HoldAwareActions) {
  const [mappings, setMappings] = useState<ButtonMapping[]>(loadMappings);
  const [listening, setListening] = useState(false);
  const [thresholds, setThresholds] = useState<ButtonThresholds>(loadThresholds);
  const mappingsRef = useRef(mappings);
  mappingsRef.current = mappings;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

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
        const next = [...prev, { key: e.key, code: e.code, keyCode: e.keyCode, label: keyLabel(e), bindings: [] }];
        persistMappings(next);
        return next;
      });
    };
    document.addEventListener('keydown', handler, { capture: true });
    return () => document.removeEventListener('keydown', handler, { capture: true });
  }, [listening]);

  // --- Listener global : hold-aware + double-click ---
  useEffect(() => {
    if (listening) return;

    // État par touche : hold detection
    const holdState = new Map<string, { timer: ReturnType<typeof setTimeout>; holding: boolean }>();
    // État par touche : double-click detection
    const dblState = new Map<string, { timer: ReturnType<typeof setTimeout>; tapCount: number }>();

    const keyId = (e: KeyboardEvent) => `${e.key}:${e.code}:${e.keyCode}`;

    const findMapping = (e: KeyboardEvent) =>
      mappingsRef.current.find(
        m => m.key === e.key && m.code === e.code && m.keyCode === e.keyCode && m.bindings.length > 0
      );

    const getBinding = (mapping: ButtonMapping, gesture: GestureType) =>
      mapping.bindings.find(b => b.gesture === gesture);

    const executeBinding = (binding: MappingBinding, phase: 'toggle' | 'enter' | 'exit') => {
      actionsRef.current[phase][binding.mode]();
    };

    const downHandler = (e: KeyboardEvent) => {
      const mapping = findMapping(e);
      if (!mapping) return;

      // Ignorer clavier virtuel
      const tag = (e.target as HTMLElement)?.tagName;
      if ((tag === 'TEXTAREA' || tag === 'INPUT') && !e.code) return;

      e.preventDefault();
      e.stopPropagation();

      const id = keyId(e);

      // Ignore key repeat
      if (holdState.has(id)) return;

      // Double-click : si 2e keydown dans la fenêtre
      const dbl = dblState.get(id);
      if (dbl) {
        dbl.tapCount++;
        if (dbl.tapCount >= 2) {
          clearTimeout(dbl.timer);
          dblState.delete(id);
          const binding = getBinding(mapping, 'double_click');
          if (binding) {
            executeBinding(binding, 'toggle');
          }
          // Ne PAS mettre dans holdState : le keyup correspondant sera ignoré
          // (upHandler fait early return si !entry)
          return;
        }
      }

      // Démarrer hold detection
      const holdBinding = getBinding(mapping, 'hold');
      const timer = setTimeout(() => {
        const entry = holdState.get(id);
        if (entry && holdBinding) {
          entry.holding = true;
          if (holdBinding.actionType === 'toggle_and_release') {
            executeBinding(holdBinding, 'enter');
          } else {
            executeBinding(holdBinding, 'toggle');
          }
        }
      }, thresholdsRef.current.holdThreshold);

      holdState.set(id, { timer, holding: false });
    };

    const upHandler = (e: KeyboardEvent) => {
      const mapping = findMapping(e);
      if (!mapping) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if ((tag === 'TEXTAREA' || tag === 'INPUT') && !e.code) return;

      e.preventDefault();
      e.stopPropagation();

      const id = keyId(e);
      const entry = holdState.get(id);
      if (!entry) return;

      clearTimeout(entry.timer);
      holdState.delete(id);

      if (entry.holding) {
        // Relâchement après hold
        const holdBinding = getBinding(mapping, 'hold');
        if (holdBinding && holdBinding.actionType === 'toggle_and_release') {
          executeBinding(holdBinding, 'exit');
        }
      } else {
        // Tap rapide — vérifier si double-click est configuré
        const hasDoubleClick = !!getBinding(mapping, 'double_click');
        const clickBinding = getBinding(mapping, 'click');

        if (hasDoubleClick) {
          // Fenêtre double-click : on attend
          const existing = dblState.get(id);
          if (existing) {
            // Déjà dans une fenêtre — ne devrait pas arriver ici normalement
            return;
          }
          const tapCount = 1;
          const timer = setTimeout(() => {
            // Timer expiré → c'est un click simple
            dblState.delete(id);
            if (clickBinding) {
              executeBinding(clickBinding, 'toggle');
            }
          }, thresholdsRef.current.doubleClickWindow);
          dblState.set(id, { timer, tapCount });
        } else {
          // Pas de double-click configuré → click immédiat
          if (clickBinding) {
            executeBinding(clickBinding, 'toggle');
          }
        }
      }
    };

    document.addEventListener('keydown', downHandler, { capture: true });
    document.addEventListener('keyup', upHandler, { capture: true });
    return () => {
      document.removeEventListener('keydown', downHandler, { capture: true });
      document.removeEventListener('keyup', upHandler, { capture: true });
      holdState.forEach(entry => clearTimeout(entry.timer));
      holdState.clear();
      dblState.forEach(entry => clearTimeout(entry.timer));
      dblState.clear();
    };
  }, [listening]);

  const startListening = useCallback(() => setListening(true), []);
  const stopListening = useCallback(() => setListening(false), []);

  const addBinding = useCallback((buttonIndex: number, binding: MappingBinding) => {
    setMappings(prev => {
      const next = prev.map((m, i) => {
        if (i !== buttonIndex) return m;
        // Pas de doublon sur le même geste
        const filtered = m.bindings.filter(b => b.gesture !== binding.gesture);
        return { ...m, bindings: [...filtered, binding] };
      });
      persistMappings(next);
      return next;
    });
  }, []);

  const removeBinding = useCallback((buttonIndex: number, gesture: GestureType) => {
    setMappings(prev => {
      const next = prev.map((m, i) => {
        if (i !== buttonIndex) return m;
        return { ...m, bindings: m.bindings.filter(b => b.gesture !== gesture) };
      });
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

  const updateThresholds = useCallback((partial: Partial<ButtonThresholds>) => {
    setThresholds(prev => {
      const next = { ...prev, ...partial };
      persistThresholds(next);
      return next;
    });
  }, []);

  return {
    mappings,
    listening,
    thresholds,
    startListening,
    stopListening,
    addBinding,
    removeBinding,
    removeMapping,
    clearAll,
    updateThresholds,
  };
}
