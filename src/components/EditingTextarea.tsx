import React, { useRef } from 'react';
import Konva from 'konva';
import { TextBox, TextLayer } from '../types';

interface EditingTextareaProps {
  textBox: TextLayer;
  stageRef: React.RefObject<Konva.Stage>;
  topOffset: number; // TOPBAR_H + DRAWINGBAR_H
  onUpdate: (patch: Partial<TextBox>) => void;
  onExit: () => void;
  onBlurExit: () => void;
}

export const EditingTextarea = React.memo(function EditingTextarea(
  { textBox, stageRef, topOffset, onUpdate, onExit, onBlurExit }: EditingTextareaProps
): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Position stable : le stage a été repositionné avant le montage pour que
  // le coin haut-gauche de la TB soit à (20px, 20px) dans le canvas div.
  // → left = 20, top = topOffset + 20.
  // Pas de state, pas de re-render de position → évite le blur Android (point 1)
  // et le feedback loop vv.resize → setSp → re-render → vv.resize (point 2).
  // Au exit editing le stage reste à cette position → TB reste en haut (point 4).
  const sc = stageRef.current?.scaleX() ?? 1;

  const autoResizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <textarea
      ref={el => {
        textareaRef.current = el;
        if (el) autoResizeTextarea(el);
      }}
      autoFocus
      value={textBox.text}
      onChange={e => {
        onUpdate({ text: e.target.value });
        autoResizeTextarea(e.target);
      }}
      onKeyDown={e => { if (e.key === 'Escape') onExit(); }}
      onBlur={e => {
        const related = e.relatedTarget as HTMLElement | null;
        // Ne pas sortir si le focus part vers les barres (topbar, drawingbar, contextToolbar, textPanel)
        // ou vers les FABs
        if (related && (
          related.closest('[data-text-panel]') ||
          related.closest('[data-bars]') ||
          related.closest('[data-fabs]')
        )) return;
        onBlurExit();
      }}
      style={{
        position: 'fixed',
        left: 20,
        top: topOffset + 20,
        width: textBox.width * sc,
        minWidth: 80 * sc,
        minHeight: 40,
        height: 'auto',
        fontSize: textBox.fontSize * sc,
        fontFamily: textBox.fontFamily,
        fontWeight: textBox.fontStyle.includes('bold') ? 'bold' : 'normal',
        fontStyle: textBox.fontStyle.includes('italic') ? 'italic' : 'normal',
        textDecoration: textBox.textDecoration,
        textAlign: textBox.align,
        color: textBox.color,
        background: 'transparent',
        opacity: textBox.opacity,
        padding: textBox.padding,
        border: '2px solid #e63946',
        borderRadius: 4, resize: 'none', outline: 'none',
        zIndex: 200, lineHeight: 1.4, boxSizing: 'border-box',
        caretColor: textBox.color,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflowY: 'hidden',
      }}
    />
  );
});
