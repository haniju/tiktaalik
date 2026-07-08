import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToolState } from './useToolState';
import { ERASER_DEFAULT_SIZE, ERASER_MIN_SIZE, ERASER_MAX_SIZE } from '../utils/eraserConfig';

describe('useToolState — restauration depuis la session du dessin', () => {
  beforeEach(() => localStorage.clear());

  it('sans surcharge, restaure l\'outil persisté globalement', () => {
    const { result: a } = renderHook(() => useToolState());
    act(() => a.current.selectDrawingTool('marker'));
    const { result: b } = renderHook(() => useToolState());
    expect(b.current.state.activeTool).toBe('marker');
  });

  it('l\'outil du dessin prime sur l\'outil persisté globalement', () => {
    const { result: a } = renderHook(() => useToolState());
    act(() => a.current.selectDrawingTool('marker'));
    const { result: b } = renderHook(() => useToolState({ activeTool: 'airbrush', canvasMode: 'draw' }));
    expect(b.current.state.activeTool).toBe('airbrush');
  });

  it('restaure le mode move avec activeTool null et previousMode (sortie de pan possible)', () => {
    const { result } = renderHook(() => useToolState({
      activeTool: null,
      canvasMode: 'move',
      previousMode: { canvasMode: 'draw', activeTool: 'pen' },
    }));
    expect(result.current.state.canvasMode).toBe('move');
    expect(result.current.state.activeTool).toBeNull();
    act(() => result.current.exitPan());
    expect(result.current.state.canvasMode).toBe('draw');
    expect(result.current.state.activeTool).toBe('pen');
  });

  it('ignore previousMode global quand le dessin fournit un mode', () => {
    const { result: a } = renderHook(() => useToolState());
    act(() => a.current.enterPan()); // persiste canvasMode:'move' + previousMode
    const { result: b } = renderHook(() => useToolState({ activeTool: 'pen', canvasMode: 'draw' }));
    expect(b.current.state.canvasMode).toBe('draw');
    expect(b.current.state.previousMode).toBeNull();
  });
});

describe('useToolState — taille de la gomme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('expose une taille de gomme par défaut', () => {
    const { result } = renderHook(() => useToolState());
    expect(result.current.state.eraserSize).toBe(ERASER_DEFAULT_SIZE);
  });

  it('setEraserSize change la taille de la gomme (slider → état)', () => {
    const { result } = renderHook(() => useToolState());
    act(() => result.current.setEraserSize(42));
    expect(result.current.state.eraserSize).toBe(42);
  });

  it('borne la taille dans la plage autorisée', () => {
    const { result } = renderHook(() => useToolState());
    act(() => result.current.setEraserSize(9999));
    expect(result.current.state.eraserSize).toBe(ERASER_MAX_SIZE);
    act(() => result.current.setEraserSize(-10));
    expect(result.current.state.eraserSize).toBe(ERASER_MIN_SIZE);
  });

  it('persiste la taille dans localStorage', () => {
    const { result } = renderHook(() => useToolState());
    act(() => result.current.setEraserSize(36));
    const persisted = JSON.parse(localStorage.getItem('sketchpad_tool_state')!);
    expect(persisted.eraserSize).toBe(36);
  });

  it('recharge la taille persistée au montage', () => {
    const { result: first } = renderHook(() => useToolState());
    act(() => first.current.setEraserSize(50));
    const { result: second } = renderHook(() => useToolState());
    expect(second.current.state.eraserSize).toBe(50);
  });
});

describe('useToolState — panneau gomme (comportement comme les outils de dessin)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sélectionner la gomme depuis un autre outil n\'ouvre pas le panneau', () => {
    const { result } = renderHook(() => useToolState());
    // Par défaut activeTool = pen, aucun panneau ouvert
    act(() => result.current.selectEraser());
    expect(result.current.state.activeTool).toBe('eraser');
    expect(result.current.contextPanel).toBeNull();
  });

  it('re-sélectionner la gomme active → toggle le panneau eraser (ouvre puis ferme)', () => {
    const { result } = renderHook(() => useToolState());
    act(() => result.current.selectEraser()); // active la gomme
    act(() => result.current.selectEraser()); // re-tap → ouvre le panneau
    expect(result.current.contextPanel).toBe('eraser');
    act(() => result.current.selectEraser()); // re-tap → ferme
    expect(result.current.contextPanel).toBeNull();
  });

  it('changer d\'outil ferme le panneau gomme', () => {
    const { result } = renderHook(() => useToolState());
    act(() => result.current.selectEraser());
    act(() => result.current.selectEraser()); // panneau eraser ouvert
    expect(result.current.contextPanel).toBe('eraser');
    act(() => result.current.selectDrawingTool('pen'));
    expect(result.current.contextPanel).toBeNull();
  });
});
