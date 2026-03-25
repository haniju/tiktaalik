# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands
```bash
npm run dev          # Start dev server (Vite)
npm run build        # TypeScript check + production build (tsc && vite build)
npm run preview      # Preview production build locally
npm run test         # Run unit tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npx eslint src/      # Lint all source files
npx playwright test  # Run e2e tests
```

To run a single test file: `npx vitest run src/utils/textboxUtils.test.ts`

## Architecture

**Tiktaalik** is a mobile-first web-based sketchpad app (React + TypeScript + Konva) with two screens:

- **GalleryScreen** — browse, create, rename, delete drawings stored in `localStorage`
- **SketchScreen** — canvas drawing interface (Konva.Stage) with tools and panels

### State & Persistence

All data lives in `localStorage`:
- `sketchpad_drawings` — serialized `Drawing[]` (layers, background, metadata)
- `sketchpad_tool_state` — active tool settings (colors, widths) across sessions

Custom hooks handle state:
- `useDrawingStorage` — CRUD for drawings in localStorage, with automatic migration of legacy formats
- `useToolState` — active tool, canvas mode, colors, widths per tool (canvas background is per-Drawing, not here)
- `useDragToReorder` — drag-to-reorder in SelectionPanel (long-press 350ms to drag, swipe to scroll)

### Canvas

The canvas is a fixed A4 size (794×1123px) rendered via `react-konva`. Drawing data is a unified layer stack: `DrawLayer = Stroke | AirbrushStroke | TextLayer`. Each `Drawing` has a `layers` array (chronological order = z-index) and a `background` color.

`AirbrushLayer.tsx` handles airbrush rendering separately from regular strokes due to the radial gradient compositing it requires.

### Autosave

SketchScreen uses a debounced autosave (4s after last mutation). Immediate save on: visibility change (app backgrounded), `beforeunload`, and return to gallery. Uses refs for the timer to avoid re-renders. Manual save button remains as fallback. Console logs `[autosave]` on each automatic save.

### Tools & Modes

- **CanvasMode**: `draw | select | move` — selected in `Topbar.tsx`
- **Tool**: `pen | marker | airbrush | eraser | text` — selected in `Drawingbar.tsx`
- Tool-specific options (color, width, opacity) rendered in `DrawingPanel.tsx` or `TextPanel.tsx`
- `ContextToolbar.tsx` surfaces context-aware options depending on active tool/mode

### TextBox State Machine

TextBoxes follow four canonical states managed by a unified `TextBoxSelectionState`:
1. **idle** — no textbox selected
2. **selected** — textbox selected, showing handles
3. **editing** — inline text editing active
4. **dragging** — textbox being moved

This replaces the previous architecture that used three desynchronized state variables. Any textbox-related work should respect this state machine.

### Export

`src/utils/export.ts` handles:
- SVG export with stroke styles, airbrush radial gradients, text with word wrap, and canvas background color
- Thumbnail generation for gallery previews (canvas 2D)
- Both outputs are clipped to A4 bounds (clipPath in SVG, `ctx.clip()` in thumbnail) — no overflow
- `wrapText()` utility in `textboxUtils.ts` is shared between canvas rendering, SVG export, and thumbnails

### App Version

The app version from `package.json` is injected at build time as the global `__APP_VERSION__` via `vite.config.ts`.

### Tests

- **Unit/integration**: Vitest with jsdom. Setup: `src/test/setup.ts`
- **E2E**: Playwright (config at `playwright.config.ts`)
- Currently only `src/utils/textboxUtils.test.ts` exists

## Conventions

- **Language**: Code in English, comments in French are OK
- **Components**: Functional components only, no class components
- **Exports**: Named exports preferred
- **State**: React hooks (`useState`, `useRef`, `useCallback`), no external state library
- **Styling**: CSS files co-located with components
- **No `any`**: Use proper types — existing `any` in the codebase is tech debt to fix
- **Unused code**: Remove dead imports and variables, don't comment them out
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`)

## Known Issues & In Progress

- ESLint shows ~16 errors: unused vars, `any` types, one empty catch block — cleanup in progress
- `react-hooks/exhaustive-deps` rule referenced in code but plugin not installed
- `DrawingSecondaryToolbar` component is defined but unused (dead code)
- Resize handle Y-axis drift during active drag — deferred, handles reset correctly on pointer up
- Playwright demo test stubs (`e2e/example.spec.ts`, `tests/example.spec.ts`) fail in Vitest — pre-existing, not real tests

## Do Not

- Do not add `node_modules/`, `dist/`, or `.zip` files to git
- Do not use `sudo` with npm
- Do not introduce new `any` types
- Do not break the TextBoxSelectionState state machine by adding separate boolean flags
- Do not put `canvasBackground` back into `useToolState` — it is per-Drawing state

## Active Bugs (v1.3.0)

### Critical
- [ ] Draw mode: secondary toolbar (DrawingSecondaryToolbar) does not open when selecting pen/marker/airbrush

### Select Mode
- [ ] Individual deselect/delete in level-2 selection not working
- [ ] Cannot drag-move a selected object on canvas
