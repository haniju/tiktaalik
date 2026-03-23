import { Tool, DrawingTool, ToolState } from '../types';
import { Icon } from './Icon';

interface Props {
  state: ToolState;
  activeTool: Tool;
  openPanel: 'drawing' | 'text' | 'colorpicker' | null;
  onSelectDrawingTool: (tool: DrawingTool) => void;
  onSelectEraser: () => void;
  onSelectText: () => void;
  onToggleColorpicker: () => void;
}

const DRAWING_TOOLS: { id: DrawingTool; icon: string; label: string }[] = [
  { id: 'airbrush', icon: 'highlight', label: 'Aérographe' },
  { id: 'pen',      icon: 'pen',       label: 'Stylo' },
  { id: 'marker',   icon: 'brush',     label: 'Marker' },
];

export function DrawingSecondaryToolbar({ state, activeTool, openPanel, onSelectDrawingTool, onSelectEraser, onSelectText, onToggleColorpicker }: Props) {
  return (
    <div style={styles.root}>
      {/* Texte */}
      <button style={styles.btn} onClick={onSelectText} title="Texte">
        <Icon name="text" size={22} />
        {activeTool === 'text' && <div style={styles.dot} />}
      </button>

      {/* Gomme */}
      <button style={styles.btn} onClick={onSelectEraser} title="Gomme">
        <Icon name="eraser" size={22} />
        {activeTool === 'eraser' && <div style={styles.dot} />}
      </button>

      {/* Outils dessin avec badge couleur */}
      {DRAWING_TOOLS.map(({ id, icon, label }) => {
        const isActive = activeTool === id;
        const toolColor = state.toolColors[id];
        return (
          <button key={id} style={styles.btn} onClick={() => onSelectDrawingTool(id)} title={label}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon name={icon} size={22} />
              <div style={{
                position: 'absolute', bottom: -1, right: -3,
                width: 8, height: 8, borderRadius: '50%',
                background: toolColor, border: '1.5px solid #fff',
              }} />
            </div>
            {isActive && <div style={styles.dot} />}
          </button>
        );
      })}

      {/* Fond canvas */}
      <button style={styles.btn} onClick={onToggleColorpicker} title="Couleur de fond">
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '2px solid #ccc',
          background: state.canvasBackground === '#ffffff' ? '#fff' : state.canvasBackground,
        }} />
        {openPanel === 'colorpicker' && <div style={styles.dot} />}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', alignItems: 'center', height: 52, background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 4px', flexShrink: 0 },
  btn: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 8, gap: 2 },
  dot: { position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 18, height: 3, borderRadius: 2, background: '#222' },
};
