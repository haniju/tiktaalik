import { useRef } from 'react';
import { Tool, DrawingTool, CanvasMode, ToolState } from '../types';
import { ContextPanel } from '../hooks/useToolState';
import { Icon } from './Icon';

const SWIPE_THRESHOLD = 30;

interface Props {
  state: ToolState;
  canvasBackground: string;
  contextPanel: ContextPanel;
  onSelectDrawingTool: (tool: DrawingTool) => void;
  onSelectText: () => void;
  onSelectEraser: () => void;
  onSelectBackground: () => void;
  onSwipeOpen: () => void;
  onSwipeClose: () => void;
}

const DRAWING_TOOLS: { id: DrawingTool; icon: string }[] = [
  { id: 'airbrush', icon: 'spraypaint' },
  { id: 'pen',      icon: 'pen'       },
  { id: 'marker',   icon: 'highlight' },
];

export function Drawingbar({ state, canvasBackground, contextPanel, onSelectDrawingTool, onSelectText, onSelectEraser, onSelectBackground, onSwipeOpen, onSwipeClose }: Props) {
  const { activeTool, canvasMode } = state;
  const isDrawMode = canvasMode === 'draw';
  const touchStartY = useRef<number | null>(null);

  const isActive = (tool: Tool) => isDrawMode && activeTool === tool;
  const isBgActive = isDrawMode && contextPanel === 'background';

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (dy > SWIPE_THRESHOLD) onSwipeOpen();
    else if (dy < -SWIPE_THRESHOLD) onSwipeClose();
  };

  return (
    <div style={styles.root} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Outils dessin */}
      {DRAWING_TOOLS.map(({ id, icon }) => {
        const active = isActive(id);
        const toolColor = state.toolColors[id];
        return (
          <button key={id} style={{ ...styles.btn, ...(active ? styles.btnActive : {}) }}
            onClick={() => onSelectDrawingTool(id)}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon name={icon} size={22} />
              <div style={{
                position: 'absolute', bottom: -1, right: -3,
                width: 8, height: 8, borderRadius: '50%',
                background: toolColor, border: '1.5px solid #fff',
              }} />
            </div>
            {active && <div style={styles.underline} />}
          </button>
        );
      })}

      {/* Gomme */}
      <button style={{ ...styles.btn, ...(isActive('eraser') ? styles.btnActive : {}) }} onClick={onSelectEraser}>
        <Icon name="eraser" size={22} />
        {isActive('eraser') && <div style={styles.underline} />}
      </button>

      {/* Texte */}
      <button style={{ ...styles.btn, ...(isActive('text') ? styles.btnActive : {}) }} onClick={onSelectText}>
        <Icon name="text" size={22} />
        {isActive('text') && <div style={styles.underline} />}
      </button>

      {/* Fond canvas */}
      <button style={{ ...styles.btn, ...(isBgActive ? styles.btnActive : {}) }} onClick={onSelectBackground}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          border: '2px solid #ccc',
          background: canvasBackground,
        }} />
        {isBgActive && <div style={styles.underline} />}
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, background: '#fff', borderBottom: '1px solid #e8e8e8', padding: '0 8px', flexShrink: 0 },
  btn: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, gap: 2, minWidth: 44 },
  btnActive: { background: '#f5f5f5' },
  underline: { position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 18, height: 2.5, borderRadius: 2, background: '#222' },
};
