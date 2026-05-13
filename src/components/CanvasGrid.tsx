import React from 'react';
import { Shape } from 'react-konva';
import { GridSettings, DEFAULT_GRID_SETTINGS } from '../types';

interface CanvasGridProps {
  width: number;
  height: number;
  gridSettings?: GridSettings;
}

/** Convertit hex en rgba avec l'opacité donnée */
function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export const CanvasGrid = React.memo(function CanvasGrid({ width, height, gridSettings }: CanvasGridProps) {
  const s = gridSettings ?? DEFAULT_GRID_SETTINGS;
  const { style, spacing, opacity, color } = s;
  const mainColor = hexToRgba(color, opacity);
  // Couleur secondaire pour le damier (version claire)
  const altColor = hexToRgba(color, opacity * 0.35);

  return (
    <Shape
      listening={false}
      sceneFunc={(ctx) => {
        if (style === 'dots') {
          // Points aux intersections — points majeurs tous les 5 pas
          const majorStep = spacing * 5;
          ctx.fillStyle = mainColor;
          for (let x = spacing; x < width; x += spacing) {
            for (let y = spacing; y < height; y += spacing) {
              const isMajor = x % majorStep === 0 && y % majorStep === 0;
              const r = isMajor ? 1.5 : 0.8;
              ctx.fillRect(x - r, y - r, r * 2, r * 2);
            }
          }
        } else if (style === 'lines') {
          // Lignes verticales et horizontales
          ctx.strokeStyle = mainColor;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let x = spacing; x < width; x += spacing) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
          }
          for (let y = spacing; y < height; y += spacing) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
          }
          ctx.stroke();
        } else if (style === 'checkerboard') {
          // Carrés bicolores en damier
          for (let col = 0; col * spacing < width; col++) {
            for (let row = 0; row * spacing < height; row++) {
              const isDark = (col + row) % 2 === 1;
              if (isDark) {
                ctx.fillStyle = mainColor;
              } else {
                ctx.fillStyle = altColor;
              }
              ctx.fillRect(col * spacing, row * spacing, spacing, spacing);
            }
          }
        }
      }}
    />
  );
});
