# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Vite)
npm run build        # TypeScript check + production build (tsc && vite build)
npm run preview      # Preview production build locally
npm run test         # Run unit tests once (Vitest)
npm run test:watch   # Run tests in watch mode
```

To run a single test file: `npx vitest run src/utils/textboxUtils.test.ts`

## Architecture

**Tiktaalik** is a web-based sketchpad app (React + Konva) with two screens:

- **GalleryScreen** — browse, create, rename, delete drawings stored in `localStorage`
- **SketchScreen** — canvas drawing interface (Konva.Stage) with tools and panels

### State & Persistence

All data lives in `localStorage`:
- `sketchpad_drawings` — serialized `Drawing[]` (layers, textBoxes, metadata)
- `sketchpad_tool_state` — active tool settings across sessions

Custom hooks handle state:
- `useDrawingStorage` — CRUD for drawings in localStorage
- `useToolState` — active tool, canvas mode, colors, widths per tool
- `useDragToReorder` — drag-to-reorder in gallery

### Canvas

The canvas is a fixed A4 size (794×1123px) rendered via `react-konva`. Drawing data is a union type `DrawLayer = Stroke | AirbrushStroke`. Each drawing has independent `layers` (strokes) and `textBoxes` arrays.

`AirbrushLayer.tsx` handles airbrush rendering separately from regular strokes due to the radial gradient compositing it requires.

### Tools & Modes

- **CanvasMode**: `draw | select | move` — selected in `Topbar.tsx`
- **Tool**: `pen | marker | airbrush | eraser | text` — selected in `Drawingbar.tsx`
- Tool-specific options (color, width, opacity) rendered in `DrawingPanel.tsx` or `TextPanel.tsx`
- `ContextToolbar.tsx` surfaces context-aware options depending on active tool/mode

### Export

`src/utils/export.ts` handles:
- SVG export with proper stroke styles, airbrush radial gradients, and text rendering
- Thumbnail generation for gallery previews

### App Version

The app version from `package.json` is injected at build time as the global `__APP_VERSION__` via `vite.config.ts`.

### Tests

Tests use Vitest with jsdom environment. Setup file: `src/test/setup.ts`. Currently only `src/utils/textboxUtils.test.ts` exists.
