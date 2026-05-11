import '@testing-library/jest-dom'

// Mock canvas 2D context pour jsdom (utilisé par wrapText / bounds)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(HTMLCanvasElement.prototype as any).getContext = function () {
  return { font: '', measureText: (text: string) => ({ width: text.length * 8 }) };
};
