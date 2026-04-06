import { ToolState, DrawingTool } from '../types';
import { ContextPanel } from '../hooks/useToolState';
import { DrawingPanel } from './DrawingPanel';
import { TextPanel } from './TextPanel';
import { ColorPickerPanel } from './ColorPickerPanel';
import { TextBox } from '../types';

interface Props {
  contextPanel: ContextPanel;
  state: ToolState;
  canvasBackground: string;
  textBox: TextBox | null;
  onSetToolColor: (tool: DrawingTool, color: string) => void;
  onSetToolWidth: (tool: DrawingTool, width: number) => void;
  onSetToolOpacity: (tool: DrawingTool, opacity: number) => void;
  onSetBackground: (color: string) => void;
  onUpdateTextBox: (patch: Partial<TextBox>) => void;
  onAddTextBox: () => void;
}

export function ContextToolbar({
  contextPanel, state, canvasBackground, textBox,
  onSetToolColor, onSetToolWidth, onSetToolOpacity, onSetBackground,
  onUpdateTextBox, onAddTextBox,
}: Props) {
  const visible = contextPanel !== null;

  return (
    <div data-bars style={{
      ...styles.root,
      maxHeight: visible ? 300 : 0,
      opacity: visible ? 1 : 0,
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      {contextPanel === 'drawing' && state.activeTool && ['airbrush', 'pen', 'marker'].includes(state.activeTool) && (
        <DrawingPanel
          tool={state.activeTool as DrawingTool}
          color={state.toolColors[state.activeTool as DrawingTool]}
          width={state.toolWidths[state.activeTool as DrawingTool]}
          opacity={state.toolOpacities[state.activeTool as DrawingTool]}
          onColorChange={c => onSetToolColor(state.activeTool as DrawingTool, c)}
          onWidthChange={w => onSetToolWidth(state.activeTool as DrawingTool, w)}
          onOpacityChange={o => onSetToolOpacity(state.activeTool as DrawingTool, o)}
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
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    overflow: 'hidden',
    transition: 'max-height 0.2s ease, opacity 0.15s ease',
    background: '#fff',
    borderBottom: '1px solid #e8e8e8',
    flexShrink: 0,
  },
};
