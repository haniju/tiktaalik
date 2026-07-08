import { useState, useRef, useEffect } from 'react';
import { HslColorPicker } from './HslColorPicker';
import { ColorPickerMode, DEFAULT_PALETTES, loadPalette, savePalette } from '../utils/palettes';
import { usePalettes } from './PaletteContext';

export type { ColorPickerMode };

const DOUBLE_TAP_MS = 300;
const LONG_PRESS_MS = 500;

interface Props {
  color: string;
  onChange: (color: string) => void;
  mode: ColorPickerMode;
}

export function UnifiedColorPicker({ color, onChange, mode }: Props) {
  const ctx = usePalettes();
  // La palette reste en state local : le picker HSL émet en continu pendant le drag,
  // on ne veut pas re-rendre SketchScreen à chaque pointermove.
  const [palette, setPalette] = useState(() => (ctx ? ctx.palettes[mode] : loadPalette(mode)));
  // null = replié ; -1 = éditeur libre (chevron) ; >= 0 = édition de la pastille i
  const [editing, setEditing] = useState<number | null>(null);

  const lastTap = useRef<{ index: number; time: number } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClick = useRef(false);
  const persistTimer = useRef<number | null>(null);

  // Persistance débouncée — `flush` évite de perdre les 200 dernières ms au démontage
  const pendingRef = useRef<string[] | null>(null);
  const persistRef = useRef<(colors: string[]) => void>(() => {});
  persistRef.current = (colors: string[]) => {
    if (ctx) ctx.setPalette(mode, colors);
    else savePalette(mode, colors);
  };

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      if (pendingRef.current) persistRef.current(pendingRef.current);
    }
  }, []);

  const writeSlot = (index: number, c: string) => {
    const next = palette.slice();
    next[index] = c;
    setPalette(next);
    pendingRef.current = next;
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(() => {
      persistTimer.current = null;
      pendingRef.current = null;
      persistRef.current(next);
    }, 200);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // Appui long → restaure la couleur d'origine de la pastille
  const handlePointerDown = (index: number) => {
    cancelLongPress();
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null;
      suppressClick.current = true;
      lastTap.current = null;
      const def = DEFAULT_PALETTES[mode][index];
      writeSlot(index, def);
      onChange(def);
    }, LONG_PRESS_MS);
  };

  const handleSwatchClick = (index: number) => {
    cancelLongPress();
    if (suppressClick.current) { suppressClick.current = false; return; }

    const now = Date.now();
    const prev = lastTap.current;
    if (prev && prev.index === index && now - prev.time < DOUBLE_TAP_MS) {
      // Double tap → déplie l'éditeur sur cette pastille
      lastTap.current = null;
      setEditing(cur => (cur === index ? null : index));
      onChange(palette[index]);
      return;
    }
    lastTap.current = { index, time: now };
    onChange(palette[index]);
  };

  // Édition d'une pastille : la nouvelle couleur remplace la couleur de base
  const handlePickerChange = (c: string) => {
    if (editing !== null && editing >= 0) writeSlot(editing, c);
    onChange(c);
  };

  return (
    <div style={styles.root}>
      <div style={styles.row}>
        {palette.map((c, i) => (
          <button
            key={i}
            style={styles.colorBtn}
            onClick={() => handleSwatchClick(i)}
            onPointerDown={() => handlePointerDown(i)}
            onPointerUp={cancelLongPress}
            onPointerLeave={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onContextMenu={e => e.preventDefault()}
          >
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: c,
              border: color === c ? '2.5px solid #222' : c.toLowerCase() === '#ffffff' ? '2px solid #ddd' : '2px solid transparent',
              boxSizing: 'border-box',
              outline: editing === i ? '2px dashed #888' : 'none',
              outlineOffset: 3,
            }} />
          </button>
        ))}
        <button style={styles.chevronBtn} onClick={() => setEditing(cur => (cur === null ? -1 : null))}>
          <img src={editing !== null ? '/icons/more.svg' : '/icons/less.svg'} width={20} height={20} alt="" />
        </button>
      </div>

      {editing !== null && (
        <HslColorPicker color={color} onChange={handlePickerChange} />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px' },
  colorBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, flex: 1, display: 'flex', justifyContent: 'center', touchAction: 'manipulation' },
  chevronBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px', display: 'flex', alignItems: 'center' },
};
