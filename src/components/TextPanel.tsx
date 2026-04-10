import { TextBox } from '../types';
import { Icon } from './Icon';

const FONTS = ['Arial', 'Georgia', 'Courier New', 'Verdana', 'Times New Roman', 'Trebuchet MS'];

interface Props {
  textBox: TextBox | null;
  onChange: (patch: Partial<TextBox>) => void;
}

export function TextPanel({ textBox, onChange }: Props) {
  const isBold   = textBox?.fontStyle.includes('bold') ?? false;
  const isItalic = textBox?.fontStyle.includes('italic') ?? false;

  const toggleBold = () => {
    if (!textBox) return;
    const i = textBox.fontStyle.includes('italic');
    onChange({ fontStyle: isBold ? (i ? 'italic' : 'normal') : (i ? 'bold italic' : 'bold') });
  };
  const toggleItalic = () => {
    if (!textBox) return;
    const b = textBox.fontStyle.includes('bold');
    onChange({ fontStyle: isItalic ? (b ? 'bold' : 'normal') : (b ? 'bold italic' : 'italic') });
  };

  const disabled = !textBox;

  return (
    <div style={{ ...styles.root, opacity: disabled ? 1 : 1 }} data-text-panel="true">
      <div style={styles.row}>
        <select value={textBox?.fontFamily ?? 'Arial'} disabled={disabled}
          onChange={e => onChange({ fontFamily: e.target.value })}
          style={{ ...styles.select, ...(disabled ? styles.disabled : {}) }}>
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>

        <button disabled={disabled} style={{ ...styles.stepperBtn, ...(disabled ? styles.disabled : {}) }}
          onClick={() => { const s = (textBox?.fontSize ?? 24); if (s > 8) onChange({ fontSize: s - 1 }); }}>−</button>
        <input type="number" inputMode="numeric" value={textBox?.fontSize ?? 24} min={8} max={200} disabled={disabled}
          onChange={e => { const v = Number(e.target.value); if (v >= 8 && v <= 200) onChange({ fontSize: v }); }}
          style={{ ...styles.sizeInput, ...(disabled ? styles.disabled : {}) }} />
        <button disabled={disabled} style={{ ...styles.stepperBtn, ...(disabled ? styles.disabled : {}) }}
          onClick={() => { const s = (textBox?.fontSize ?? 24); if (s < 200) onChange({ fontSize: s + 1 }); }}>+</button>

      </div>

      <div style={{ ...styles.row, ...(disabled ? styles.rowDisabled : {}) }}>
        <label style={{ ...styles.colorLabel, pointerEvents: disabled ? 'none' : 'auto' }} title="Couleur du texte">
          <Icon name="text_color" size={22} />
          <div style={{ width: 18, height: 3, background: textBox?.color ?? '#ccc', borderRadius: 2 }} />
          <input type="color" value={textBox?.color ?? '#000000'} disabled={disabled}
            onChange={e => onChange({ color: e.target.value })} style={styles.hiddenPicker} />
        </label>

        <button disabled={disabled} style={{ ...styles.btn, ...(isBold ? styles.btnActive : {}), ...(disabled ? styles.disabled : {}) }} onClick={toggleBold}>
          <Icon name="text_bold" size={20} />
        </button>
        <button disabled={disabled} style={{ ...styles.btn, ...(isItalic ? styles.btnActive : {}), ...(disabled ? styles.disabled : {}) }} onClick={toggleItalic}>
          <Icon name="text_italic" size={20} />
        </button>
        <button disabled={disabled} style={{ ...styles.btn, ...((textBox?.textDecoration === 'underline') ? styles.btnActive : {}), ...(disabled ? styles.disabled : {}) }}
          onClick={() => onChange({ textDecoration: textBox?.textDecoration === 'underline' ? '' : 'underline' })}>
          <Icon name="text_underline" size={20} />
        </button>

        <div style={styles.divider} />

        {(['left', 'center', 'right', 'justify'] as const).map(a => (
          <button key={a} disabled={disabled}
            style={{ ...styles.btn, ...(textBox?.align === a ? styles.btnActive : {}), ...(disabled ? styles.disabled : {}) }}
            onClick={() => onChange({ align: a === 'justify' ? 'left' : a })}>
            <Icon name={`text_${a}`} size={20} />
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { background: '#fff', borderBottom: '1px solid #e8e8e8', flexShrink: 0 },
  row: { display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 2, overflowX: 'auto' },
  divider: { width: 1, height: 24, background: '#e8e8e8', margin: '0 6px', flexShrink: 0 },
  btn: { background: 'none', border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  btnActive: { background: '#f0f0f0' },
  select: { border: '1px solid #e8e8e8', borderRadius: 6, padding: '4px 6px', fontSize: 12, background: '#f8f8f8', color: '#333', cursor: 'pointer' },
  sizeInput: { width: 40, border: '1px solid #e8e8e8', borderRadius: 0, padding: '4px 2px', fontSize: 12, textAlign: 'center', color: '#333', background: '#f8f8f8', MozAppearance: 'textfield' },
  stepperBtn: { width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e8e8e8', background: '#f8f8f8', cursor: 'pointer', fontSize: 16, fontWeight: 600, color: '#333', flexShrink: 0 },
  colorLabel: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: 'pointer', padding: '4px 6px', position: 'relative' },
  hiddenPicker: { position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer', top: 0, left: 0 },
  disabled: { opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none' as const },
  rowDisabled: { opacity: 0.35, pointerEvents: 'none' as const },
};
