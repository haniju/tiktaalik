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
- `useAutosave` — debounced autosave timer, saveNow/scheduleSave, visibilitychange/beforeunload listeners
- `useUndoRedo` — undoStack, pushUndo, undo/redo, Cmd+Z keyboard shortcut
- `useStageViewport` — stageRef, stageSize, zoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn

### Canvas

The canvas is a fixed A4 size (794×1123px) rendered via `react-konva`. Drawing data is a unified layer stack: `DrawLayer = Stroke | AirbrushStroke | TextLayer`. Each `Drawing` has a `layers` array (chronological order = z-index) and a `background` color.

`AirbrushLayer.tsx` handles airbrush rendering separately from regular strokes due to the radial gradient compositing it requires.

### Autosave

Managed by `useAutosave` hook. Debounced 4s timer after each mutation (`scheduleSave`). Immediate save (`saveNow`) on: visibility change (app backgrounded), `beforeunload`, and return to gallery. Manual save button remains as fallback. Console logs `[autosave]` on each automatic save.

**Key pattern — `saveNowRef`**: `useDrawingStorage` returns a new object on every render (not memoized), which would cause `saveNow` to be recreated every render, which would cancel the autosave timer on every render. Fix: `saveNowRef` is a stable ref always pointing to the current `saveNow`. The timer and event listeners read through this ref.

### Viewport

Managed by `useStageViewport` hook. Returns `stageRef` (Konva.Stage), `stageSize` (window resize listener), `zoomPct`/`setZoomPct`, `canvasH` (stageSize.height - TOPBAR_H - DRAWINGBAR_H), and `centerViewOn(cx, cy)` which translates the stage to center a canvas point in the visible area.

`TOPBAR_H = 48`, `DRAWINGBAR_H = 48` are exported constants from `useStageViewport.ts`.

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

**Key pitfalls:**
- Konva fires `onTap` then `onClick` for the same touch on mobile. Guard: `if (elapsed < 80ms) return` in `handleTap` to ignore the duplicate event.
- `tbState` captured in JSX closures can be stale. Always use `tbStateRef.current` (not `tbState`) in `handleTap` when calling `nextSelectionState`.
- Konva fires a synthetic `tap` after `touchend` even when a drag occurred. Guard: `dragJustEndedRef`.

### EditingTextarea

`EditingTextarea` component renders a fixed-position `<textarea>` overlaid on the canvas for text editing. Position is computed with `topOffset = TOPBAR_H + DRAWINGBAR_H` (passed as prop from SketchScreen) + Konva stage pan/scale — **do not** replace with `getBoundingClientRect()`, which is measured during React render and can capture a transitional layout value (keyboard animation, browser chrome change), causing visible offset drift.

Known limitation: pinch zoom while the textarea is focused triggers `exitEditing` because the first touch finger hitting the canvas fires `handleMouseDown` → `exitEditing` before the second finger confirms the pinch.

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
- Playwright demo test stubs (`e2e/example.spec.ts`, `tests/example.spec.ts`) fail in Vitest — pre-existing, not real tests
- Pinch zoom while textarea is focused exits editing (first touch fires handleMouseDown before second touch confirms pinch) — known limitation, deferred

## Refactoring in Progress — branch `refactor/sketchscreen-decomp`

Phase 1: decompose `SketchScreen.tsx` (was ~1274 lines). Protocol: one step at a time, one commit per step, PO validation between steps.

**Completed:**
- Step 0: `DEBUG` overlay, `setTbStateWithLog` wrapper
- Step 1: fix recursive `scheduleSave`
- Step 2: extract `ResizeHandle` → `src/components/ResizeHandle.tsx`
- Step 3: extract `useAutosave` → `src/hooks/useAutosave.ts`
- Step 4: extract `useUndoRedo` → `src/hooks/useUndoRedo.ts`
- Step 5: extract `useStageViewport` → `src/hooks/useStageViewport.ts`
- Step 6: extract `EditingTextarea` → `src/components/EditingTextarea.tsx`

**Bug fixes landed on this branch (not yet on main):**
- `autosave`: saveNowRef pattern — timer no longer cancelled on every render
- `ResizeHandle`: X clamping in dragBoundFunc (minimum width 150px enforced visually)
- `ResizeHandle` left side: effectiveDx keeps right edge fixed at minimum
- `handleMouseUp` → `handleTap`: dragJustEndedRef guards synthetic tap after drag
- `handleTap`: onTap+onClick double-fire guard (elapsed < 80ms → early return)
- `handleTap`: tbStateRef.current instead of stale tbState closure
- `EditingTextarea`: getBoundingClientRect() for correct position at all zoom levels

**Pending (steps 7–9):**
- Step 7: extract `TextBoxKonva` component
- Step 8: extract `DrawingLayer` component
- Step 9 (highest risk): extract `useCanvasGestures` hook

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

### Text Tool (under investigation on refactor/sketchscreen-decomp)
- [ ] Toolbar text panel blur guard (data-text-panel) ineffective on mobile — keyboard pushes toolbar off-screen when editing starts
- [ ] double-tap reliability to be validated after fixes in steps 6 debug session
