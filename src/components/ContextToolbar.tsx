import { useRef } from 'react';
import { ToolState, DrawingTool } from '../types';
import { ContextPanel } from '../hooks/useToolState';
import { DrawingPanel } from './DrawingPanel';
import { TextPanel } from './TextPanel';
import { ColorPickerPanel } from './ColorPickerPanel';
import { TextBox } from '../types';

const SWIPE_THRESHOLD = 30;

interface Props {
  contextPanel: ContextPanel;
  state: ToolState;
  canvasBackground: string;
  textBox: TextBox | null;
  onSetToolColor: (tool: DrawingTool, color: string) => void;
  onSetToolWidth: (tool: DrawingTool, width: number) => void;
  onSetToolOpacity: (tool: DrawingTool, opacity: number) => void;
  onSetAirbrushEdgeOpacity: (opacity: number) => void;
  onSetBackground: (color: string) => void;
  onUpdateTextBox: (patch: Partial<TextBox>) => void;
  onAddTextBox: () => void;
  onSwipeClose: () => void;
}

export function ContextToolbar({
  contextPanel, state, canvasBackground, textBox,
  onSetToolColor, onSetToolWidth, onSetToolOpacity, onSetAirbrushEdgeOpacity, onSetBackground,
  onUpdateTextBox, onAddTextBox, onSwipeClose,
}: Props) {
  const visible = contextPanel !== null;
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (dy < -SWIPE_THRESHOLD) onSwipeClose();
  };

  return (
    <div data-bars style={{
      ...styles.outer,
      maxHeight: visible ? 300 : 0,
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} style={{
        ...styles.inner,
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        opacity: visible ? 1 : 0,
      }}>
        {contextPanel === 'drawing' && state.activeTool && ['airbrush', 'pen', 'marker'].includes(state.activeTool) && (
          <DrawingPanel
            tool={state.activeTool as DrawingTool}
            color={state.toolColors[state.activeTool as DrawingTool]}
            width={state.toolWidths[state.activeTool as DrawingTool]}
            opacity={state.toolOpacities[state.activeTool as DrawingTool]}
            airbrushEdgeOpacity={state.airbrushEdgeOpacity}
            onColorChange={c => onSetToolColor(state.activeTool as DrawingTool, c)}
            onWidthChange={w => onSetToolWidth(state.activeTool as DrawingTool, w)}
            onOpacityChange={o => onSetToolOpacity(state.activeTool as DrawingTool, o)}
            onAirbrushEdgeOpacityChange={onSetAirbrushEdgeOpacity}
          />
        )}

        {contextPanel === 'text' && (
          <TextPanel
            textBox={textBox}
            onChange={onUpdateTextBox}
            onAddTextBox={onAddTextBox}
          />
        )}

        {contextPanel === 'background' && (
          <ColorPickerPanel
            color={canvasBackground}
            onChange={onSetBackground}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  outer: {
    overflow: 'hidden',
    transition: 'max-height 0.25s ease',
    flexShrink: 0,
  },
  inner: {
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    transition: 'transform 0.25s ease, opacity 0.2s ease',
  },
};
