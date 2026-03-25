import { DrawLayer, Stroke, TextLayer } from '../types';
import { wrapText } from './textboxUtils';

export function exportSvg(layers: DrawLayer[], width: number, height: number, filename: string, background = '#ffffff') {
  const defs: string[] = [];
  const elements: string[] = [];

  layers.forEach((layer, li) => {
    if (layer.tool === 'airbrush') {
      layer.points.forEach((pt, pi) => {
        const gradId = `ab_${li}_${pi}`;
        defs.push(`<radialGradient id="${gradId}" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${layer.color}" stop-opacity="${layer.centerOpacity}"/>
      <stop offset="100%" stop-color="${layer.color}" stop-opacity="0"/>
    </radialGradient>`);
        elements.push(`<circle cx="${pt.x}" cy="${pt.y}" r="${layer.radius}" fill="url(#${gradId})"/>`);
      });
    } else if (layer.tool === 'text') {
      const tb = layer as TextLayer;
      if (!tb.text.trim()) return;
      const weight = tb.fontStyle.includes('bold') ? 'bold' : 'normal';
      const style = tb.fontStyle.includes('italic') ? 'italic' : 'normal';
      const decoration = tb.textDecoration || 'none';
      const lines = wrapText(tb.text, tb.width, tb.fontSize, tb.fontFamily, tb.fontStyle, tb.padding);
      const lineH = tb.fontSize * 1.4;

      if (tb.background) {
        const h = lines.length * lineH + tb.padding * 2;
        elements.push(`<rect x="${tb.x}" y="${tb.y}" width="${tb.width}" height="${h}" fill="${tb.background}" opacity="${tb.opacity}"/>`);
      }

      lines.forEach((line, i) => {
        let textAnchor = 'start';
        let tx = tb.x + tb.padding;
        if (tb.align === 'center') { textAnchor = 'middle'; tx = tb.x + tb.width / 2; }
        if (tb.align === 'right') { textAnchor = 'end'; tx = tb.x + tb.width - tb.padding; }
        const ty = tb.y + tb.padding + tb.fontSize + i * lineH;
        elements.push(`<text x="${tx}" y="${ty}" font-family="${tb.fontFamily}" font-size="${tb.fontSize}" font-weight="${weight}" font-style="${style}" text-decoration="${decoration}" text-anchor="${textAnchor}" fill="${tb.color}" opacity="${tb.opacity}">${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`);
      });
    } else {
      const s = layer as Stroke;
      if (s.points.length < 2) return;
      let d = `M ${s.points[0]} ${s.points[1]}`;
      for (let i = 2; i < s.points.length; i += 2) {
        d += ` L ${s.points[i]} ${s.points[i + 1]}`;
      }
      elements.push(`<path d="${d}" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    ${defs.join('\n    ')}
  </defs>
  <rect width="${width}" height="${height}" fill="${background}"/>
  ${elements.join('\n  ')}
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function generateThumbnail(layers: DrawLayer[], width: number, height: number, background = '#ffffff'): string {
  const scale = 200 / width;
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  layers.forEach(layer => {
    ctx.globalAlpha = 1;

    if (layer.tool === 'airbrush') {
      const r = parseInt(layer.color.slice(1, 3), 16);
      const g = parseInt(layer.color.slice(3, 5), 16);
      const b = parseInt(layer.color.slice(5, 7), 16);
      for (const pt of layer.points) {
        const radius = layer.radius * scale;
        const gradient = ctx.createRadialGradient(pt.x * scale, pt.y * scale, 0, pt.x * scale, pt.y * scale, radius);
        gradient.addColorStop(0, `rgba(${r},${g},${b},${layer.centerOpacity})`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pt.x * scale, pt.y * scale, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (layer.tool === 'text') {
      const tb = layer as TextLayer;
      if (!tb.text.trim()) return;
      const weight = tb.fontStyle.includes('bold') ? 'bold' : 'normal';
      const style = tb.fontStyle.includes('italic') ? 'italic' : 'normal';
      const fontSize = tb.fontSize * scale;
      const lineH = fontSize * 1.4;
      const lines = wrapText(tb.text, tb.width, tb.fontSize, tb.fontFamily, tb.fontStyle, tb.padding);

      ctx.globalAlpha = tb.opacity;

      if (tb.background) {
        const h = lines.length * lineH + tb.padding * 2 * scale;
        ctx.fillStyle = tb.background;
        ctx.fillRect(tb.x * scale, tb.y * scale, tb.width * scale, h);
      }

      ctx.fillStyle = tb.color;
      ctx.font = `${style} ${weight} ${fontSize}px ${tb.fontFamily}`;
      ctx.textBaseline = 'top';

      lines.forEach((line, i) => {
        const ty = tb.y * scale + tb.padding * scale + i * lineH;
        let tx = tb.x * scale + tb.padding * scale;
        if (tb.align === 'center') { ctx.textAlign = 'center'; tx = (tb.x + tb.width / 2) * scale; }
        else if (tb.align === 'right') { ctx.textAlign = 'right'; tx = (tb.x + tb.width - tb.padding) * scale; }
        else { ctx.textAlign = 'left'; }
        ctx.fillText(line, tx, ty);
      });
    } else {
      const s = layer as Stroke;
      if (s.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * scale;
      ctx.globalAlpha = s.opacity;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(s.points[0] * scale, s.points[1] * scale);
      for (let i = 2; i < s.points.length; i += 2) {
        ctx.lineTo(s.points[i] * scale, s.points[i + 1] * scale);
      }
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/jpeg', 0.7);
}
