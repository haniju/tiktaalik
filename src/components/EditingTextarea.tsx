import React, { useRef } from 'react';
import Konva from 'konva';
import { TextBox, TextLayer } from '../types';

const isPWA = window.matchMedia('(display-mode: standalone)').matches
  || (navigator as unknown as { standalone?: boolean }).standalone === true;

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

  const stage = stageRef.current;
  const sc = stage?.scaleX() ?? 1;

  // En PWA standalone, le viewport n'a pas de barre d'adresse : getBoundingClientRect()
  // donne la position réelle du container. En web mobile, on garde la position fixe (20, topOffset+20)
  // car le stage a été repositionné avant le montage, et getBoundingClientRect() peut capturer
  // des valeurs transitionnelles (keyboard animation, chrome mobile).
  let posLeft = 20;
  let posTop = topOffset + 20;

  if (isPWA && stage) {
    const rect = stage.container().getBoundingClientRect();
    const sp = stage.position();
    posLeft = rect.left + sp.x + textBox.x * sc;
    posTop = rect.top + sp.y + textBox.y * sc;
  }

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
        left: posLeft,
        top: posTop,
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
