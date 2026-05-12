import React from 'react';
import { Shape } from 'react-konva';

const MINOR_STEP = 20;  // espacement grille mineure (= seuil eraser)
const MAJOR_STEP = 100; // espacement grille majeure

interface CanvasGridProps {
  width: number;
  height: number;
  canvasBackground: string;
}

// Détermine si le fond est sombre (pour adapter la couleur des points)
function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  // Luminance perçue (formule ITU-R BT.601)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128;
}

export const CanvasGrid = React.memo(function CanvasGrid({ width, height, canvasBackground }: CanvasGridProps) {
  const dark = isDark(canvasBackground);
  const minorColor = dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  const majorColor = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)';

  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        // Points mineurs (intersections de la grille 20px)
        for (let x = MINOR_STEP; x < width; x += MINOR_STEP) {
          for (let y = MINOR_STEP; y < height; y += MINOR_STEP) {
            const isMajor = x % MAJOR_STEP === 0 && y % MAJOR_STEP === 0;
            ctx.fillStyle = isMajor ? majorColor : minorColor;
            const r = isMajor ? 1.5 : 0.8;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
          }
        }
      }}
    />
  );
});
