import React, { useRef, useState, useCallback, useEffect } from 'react';
import Konva from 'konva';
import { TextBox, TextLayer } from '../types';

interface EditingTextareaProps {
  textBox: TextLayer;
  stageRef: React.RefObject<Konva.Stage>;
  topOffset: number; // TOPBAR_H + DRAWINGBAR_H
  onUpdate: (patch: Partial<TextBox>) => void;
  onExit: () => void;
}

export const EditingTextarea = React.memo(function EditingTextarea(
  { textBox, stageRef, topOffset, onUpdate, onExit }: EditingTextareaProps
): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // sp reflète la position du stage Konva — mis à jour quand le clavier virtuel s'ouvre
  const [sp, setSp] = useState(() => {
    const s = stageRef.current;
    return { x: s?.x() ?? 0, y: s?.y() ?? 0 };
  });

  // Repositionne le stage pour centrer la textbox dans la zone exploitable (entre barres et clavier)
  const adjustForKeyboard = useCallback(() => {
    const stage = stageRef.current;
    const vv = window.visualViewport;
    if (!stage || !vv) return;
    // Seulement quand le clavier est ouvert (vv.height < 70% de la hauteur totale)
    if (vv.height > window.innerHeight * 0.7) return;
    const sc = stage.scaleX();
    // Hauteur réelle des barres mesurée dans le DOM (topbar + drawingbar + ContextToolbar ouverte)
    const barsEl = document.querySelector('[data-bars]');
    const barsBottom = barsEl ? barsEl.getBoundingClientRect().bottom : topOffset;
    const availableH = vv.height - barsBottom;
    if (availableH <= 0) return;
    // Centrer la textbox dans la zone exploitable
    const targetScreenTop = barsBottom + availableH / 2;
    const newY = targetScreenTop - topOffset - textBox.y * sc;
    stage.y(newY);
    stage.batchDraw();
    setSp({ x: stage.x(), y: newY });
  }, [stageRef, textBox.y, topOffset]);

  // Vérifier au montage si le clavier est déjà ouvert (passage editing → editing d'une autre box)
  useEffect(() => {
    adjustForKeyboard();
  }, [adjustForKeyboard]);

  // Écouter l'ouverture du clavier virtuel
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener('resize', adjustForKeyboard);
    return () => vv.removeEventListener('resize', adjustForKeyboard);
  }, [adjustForKeyboard]);

  const stage = stageRef.current;
  const sc = stage?.scaleX() ?? 1;

  // Coordonnées écran : décalage du canvas div (topOffset) + position Konva (via sp state)
  const screenLeft = textBox.x * sc + sp.x;
  const screenTop = topOffset + textBox.y * sc + sp.y;

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
        onExit();
      }}
      style={{
        position: 'fixed',
        left: screenLeft,
        top: screenTop,
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
