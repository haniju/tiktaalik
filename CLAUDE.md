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

- **HomeScreen** — Home screen (topbar + galerie). Galerie = flex-wrap grid of vignettes. Vignette = thumbnail image (300px) + footer (title | timing). Long-press: select (badge bar with delete/rename), long-press+drag: reorder. Multi-select supported.
- **SketchScreen** — canvas drawing interface (Konva.Stage) with tools and panels

### State & Persistence

All data lives in `localStorage`:
- `sketchpad_drawings` — serialized `Drawing[]` (layers, background, metadata)
- `sketchpad_drawing_order` — array of drawing IDs for custom gallery order (Option A: separate from Drawing objects, filtered on load)
- `sketchpad_tool_state` — active tool settings (colors, widths, active tool, canvas mode, previousMode) across sessions
- `sketchpad_button_mapping` — array of `{ key, code, keyCode, label, action }` for physical button → action mapping

Custom hooks handle state:
- `useDrawingStorage` — CRUD for drawings in localStorage, with automatic migration of legacy formats
- `useToolState` — active tool, canvas mode, colors, widths, opacities per tool (canvas background is per-Drawing, not here)
- `useButtonMapping` — physical button → action mapping. Two-phase: listen mode (captures `keydown` events, `preventDefault` on all, adds to detected list) and active mode (global `keydown` listener triggers mapped actions). Persisted in `sketchpad_button_mapping`. Modal UI via `ButtonMappingModal` (opened from Topbar dropdown).
- `useDragToReorder` — drag-to-reorder, supports `layout: 'horizontal'` (SelectionPanel) and `layout: 'grid'` (HomeScreen galerie). Two-phase long-press: `onLongPressRelease` for select, move after long-press for drag. Vibrate on long-press ready. On long-press, `blockNativeScroll()` intercepts `touchmove` (non-passive) on the scroll container to prevent the browser from claiming the gesture for scrolling (which would fire `pointercancel` and kill the drag).
- `useDrawingOrder` — persistence of custom gallery order in `sketchpad_drawing_order` (array of IDs). `applyOrder()` sorts drawings, filters stale IDs, puts new drawings first.
- `useAutosave` — debounced autosave timer, saveNow/scheduleSave, visibilitychange/beforeunload listeners
- `useUndoRedo` — undoStack, pushUndo, undo/redo, Cmd+Z keyboard shortcut
- `useStageViewport` — stageRef, stageSize, zoomPct, canvasH, TOPBAR_H, DRAWINGBAR_H, centerViewOn

### Canvas

The canvas is a fixed A4 size (794×1123px) rendered via `react-konva`. The navigable world is 3×3 A4 (one page of margin on each side). Drawing data is a unified layer stack: `DrawLayer = Stroke | AirbrushStroke | TextLayer`. Each `Drawing` has a `layers` array (chronological order = z-index) and a `background` color.

`AirbrushLayer.tsx` handles airbrush rendering separately from regular strokes due to the radial gradient compositing it requires.

### Autosave

Managed by `useAutosave` hook. Debounced 4s timer after each mutation (`scheduleSave`). Immediate save (`saveNow`) on: visibility change (app backgrounded), `beforeunload`, and return to gallery. Manual save button remains as fallback. Console logs `[autosave]` on each automatic save.

**Key pattern — `saveNowRef`**: `useDrawingStorage` returns a new object on every render (not memoized), which would cause `saveNow` to be recreated every render, which would cancel the autosave timer on every render. Fix: `saveNowRef` is a stable ref always pointing to the current `saveNow`. The timer and event listeners read through this ref.

### Viewport

Managed by `useStageViewport` hook. Returns `stageRef` (Konva.Stage), `stageSize` (window resize listener), `zoomPct`/`setZoomPct`, `canvasH` (stageSize.height - TOPBAR_H - DRAWINGBAR_H), `centerViewOn(cx, cy)`, and `zoomTo(pct)`.

Default zoom is 100%. Min zoom 10% (ActionFABs slider), max 400%. Pan/zoom is clamped to a 3×3 A4 world area via `clampStagePos()` (exported from `useStageViewport.ts`).

Pinch-to-zoom (two-finger gesture) is available but disabled by default — toggle in the Topbar dropdown. Controlled via `pinchZoomEnabledRef` passed to `useCanvasGestures`.

`TOPBAR_H = 48`, `DRAWINGBAR_H = 48` are exported constants from `useStageViewport.ts`.

### Tools & Modes

- **CanvasMode**: `draw | select | move` — selected in `ActionFABs.tsx` (bottom bar)
- **Pan mode memory**: entering `move` (pan) saves the current `{ canvasMode, activeTool }` into `ToolState.previousMode`. Toggle off via the FAB pan button restores the saved context (`togglePan`). Choosing any other mode/tool (Drawingbar, select, eraser) clears `previousMode` — the explicit choice takes priority. Persisted in localStorage alongside `activeTool` and `canvasMode`.
- **Hold-to-pan (pan momentané)**: both the FAB pan button and mapped physical buttons support hold-to-pan. Tap short (<250ms) toggles pan on/off (existing behavior). Hold (≥250ms) activates pan immediately; releasing the button/key restores the previous mode. Uses `enterPan()`/`exitPan()` from `useToolState`. FAB uses `pointerDown`/`pointerUp`; physical buttons use `keydown`/`keyup` with hold state tracking per key. Multi-touch fix: Konva `getPointerPosition()` reads `touches[0]` which is finger A (on FAB, not canvas) — bypassed via `holdPanTouchId` ref that tracks the canvas touch identifier and reads position directly from native `evt.touches`.
- **Tool**: `pen | marker | airbrush | eraser | text` — selected in `Drawingbar.tsx`
- **Tool persistence on drawing open**: all tool settings (colors, widths, opacities, smoothing, canvas mode, active tool) are persisted in localStorage and restored when the app loads — including the text tool. A **mount guard** (`mountReadyRef` in `useCanvasGestures`, 300ms) blocks all canvas events after SketchScreen mount to prevent phantom interactions from the vignette tap (mobile browsers dispatch synthetic mouse events at the same screen coordinates after a touch, which would otherwise create an unwanted stroke or TB on the newly mounted canvas).
- Tool-specific options (color, width, opacity) rendered in `DrawingPanel.tsx` or `TextPanel.tsx`
- `TextPanel` actions: font, size, bold/italic/underline, alignment, color picker (toggle via `text_color` button, hidden by default), **duplicate** (copies selected TB 20px above, same X, new TB becomes selected)
- Per-tool opacity in `toolOpacities` (marker, airbrush center); airbrush edge opacity separate (`airbrushEdgeOpacity`)
- Per-tool smoothing in `toolSmoothings` (0–1). Pen/marker: minimum-distance filter on captured points (0–12px threshold, eliminates touch jitter). Airbrush: denser point interpolation step (factor 0.6→0.15, eliminates circle bead artifacts). Slider "Lissage" in `DrawingPanel` for all 3 drawing tools. Defaults: pen/marker 30%, airbrush 50%.
- Color selection: `UnifiedColorPicker` component shared across all contexts (drawing, background, text) — preset swatches + expandable `HslColorPicker` (HSL sliders). Mode prop selects preset palette (vivid for drawing/text, neutral for background).
- `ContextToolbar.tsx` surfaces context-aware options depending on active tool/mode. Swipe up to close. Hit area (60px invisible zone below toolbar) captures touch to prevent accidental strokes on canvas.

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

### Focus viewport (stage repositioning on TB tap)

When a TB is tapped (selected/editing), the stage is repositioned so the TB appears at screen coords (20, barsH+20). For rotated TBs, the **AABB** (Axis-Aligned Bounding Box) is used instead of raw `tb.x`/`tb.y` — the AABB is computed by `getLayerBounds()` (from `bounds.ts`) which rotates the 4 corners and takes min/max. This ensures the entire visible text is within the focus zone, not just the Konva rotation anchor point.

**TB-to-TB focus transfer**: when the user taps TBb while TBa is already selected (or editing), the viewport must reposition to TBb — not stay on TBa. Every code path that transitions tbState from one TB to another must include the viewport repositioning logic (`stage.position` via AABB). There are multiple entry points for this transition (mouseDown early-exit for text tool, mouseUp pendingTextbox hit, Konva onTap handler) — all must reposition. If a guard blocks a downstream handler (e.g. `mouseUpHandledTapRef` prevents `handleTapById` from firing), the upstream handler that set the guard is responsible for doing the repositioning itself.

### EditingTextarea

`EditingTextarea` component renders a fixed-position `<textarea>` overlaid on the canvas for text editing. Positioning depends on context:
- **Web mobile**: fixed position (left:20, top:topOffset+20). The stage is repositioned before mount so the TB lands at this position. Avoids `getBoundingClientRect()` which captures transitional values during keyboard animation.
- **PWA standalone**: uses `getBoundingClientRect()` on the stage container for true screen position, because the standalone viewport has no browser chrome changes.

Detection via `window.matchMedia('(display-mode: standalone)')` at module load.

Known limitation: pinch zoom while the textarea is focused triggers `exitEditing` because the first touch finger hitting the canvas fires `handleMouseDown` → `exitEditing` before the second finger confirms the pinch.

### Export

`src/utils/export.ts` handles:
- SVG export with stroke styles, airbrush radial gradients, text with word wrap, and canvas background color
- Thumbnail generation for gallery previews (canvas 2D)
- Both outputs are clipped to A4 bounds (clipPath in SVG, `ctx.clip()` in thumbnail) — no overflow
- `wrapText()` utility in `textboxUtils.ts` is shared between canvas rendering, SVG export, and thumbnails

### App Version

The app version from `package.json` is injected at build time as the global `__APP_VERSION__` via `vite.config.ts`. The build timestamp is injected as `__BUILD_TIME__` (fr-FR locale, short date+time). Both are displayed in the HomeScreen version badge (`v2.0.0 — MAJ 24/04/2026 ...`).

### Build & Chunking

Production build uses `manualChunks` in `vite.config.ts` to split the bundle into 3 chunks:
- **index** (~103 kB) — application code
- **vendor-react** (~130 kB) — `react` + `react-dom`
- **vendor-konva** (~304 kB) — `konva` + `react-konva`

This keeps each chunk under Vite's 500 kB warning threshold and improves browser caching (vendor chunks rarely change).

### Tests

- **Unit/integration**: Vitest with jsdom. Setup: `src/test/setup.ts`
- **E2E**: Playwright (config at `playwright.config.ts`)
- Currently only `src/utils/textboxUtils.test.ts` exists

## Conventions

- **Language**: Code in English, comments in French are OK
- **Components**: Functional components only, no class components
- **Exports**: Named exports preferred
- **State**: React hooks (`useState`, `useRef`, `useCallback`), no external state library
- **Styling**: Inline styles (no CSS files); global slider CSS injected via `<style>` in `App.tsx`
- **No `any`**: Use proper types — existing `any` in the codebase is tech debt to fix
- **Unused code**: Remove dead imports and variables, don't comment them out
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`)

## Known Issues & In Progress

- ESLint shows ~16 errors: unused vars, `any` types, one empty catch block — cleanup in progress
- `react-hooks/exhaustive-deps` rule referenced in code but plugin not installed
- `DrawingSecondaryToolbar` supprimé → remplacé par `HslColorPicker` → unifié dans `UnifiedColorPicker`
- `ColorPickerPanel` supprimé, remplacé par `UnifiedColorPicker mode="background"`
- Playwright demo test stubs (`e2e/example.spec.ts`, `tests/example.spec.ts`) fail in Vitest — pre-existing, not real tests
- Pinch zoom while textarea is focused exits editing (first touch fires handleMouseDown before second touch confirms pinch) — known limitation, deferred
- **Hold-to-pan via FAB**: FIXED — see "Pan Mode Memory + Button Mapping" section

## Refactoring Phase 1 — COMPLETE — branch `refactor/sketchscreen-decomp`

Phase 1: decompose `SketchScreen.tsx` (was ~1274 lines → ~430 lines). Awaiting PO validation before merge to main.

**All steps completed:**
- Step 0–9: see git history for details

**Features added on this branch (v1.5.0 → v1.8.3):**
- `HslColorPicker` replaces deleted `DrawingSecondaryToolbar`
- Per-tool opacity sliders (marker, airbrush center/edge) with `toolOpacities` + `airbrushEdgeOpacity`
- Debug overlay toggle in dropdown (off by default)
- Zoom: initial 100%, min 10%, world clamped to 3×3 A4 (`clampStagePos`)
- Pinch-to-zoom two-finger gesture (toggle in dropdown, off by default)
- Toolbar icons: spraypaint (airbrush), highlight (marker)
- Modernized slider design (global CSS `app-slider` in App.tsx)
- PWA install button (HomeScreen)
- Zoom slider integrated into ActionFABs bottom bar with +/− buttons and floating percentage label (5s timeout)
- Inline rename: tap drawing title in Topbar to edit (replaces `prompt()`)
- Swipe gestures on Drawingbar: swipe ↓ on any icon opens its panel + switches tool, swipe ↑ closes panel (also works on ContextToolbar surface). `data-tool` attributes on buttons, `guardClick` prevents click after swipe.
- ContextToolbar slide animation (translateY) for open/close
- HomeScreen: galerie flex-wrap 2-col, vignettes (thumbnail 400px + titre | timing footer), overflowY:scroll
- ActionFABs: gradient background on active mode (blue→green)
- TextPanel: font size stepper (+/−) buttons alongside input; "Nouveau texte" button removed
- ColorPickerPanel: label removed, colors in flex grid matching DrawingPanel layout

**Bug fixes landed on this branch (not yet on main):**
- `autosave`: saveNowRef pattern — timer no longer cancelled on every render
- `ResizeHandle`: X clamping in dragBoundFunc (minimum width 150px enforced visually)
- `ResizeHandle` left side: effectiveDx keeps right edge fixed at minimum
- `handleMouseUp` → `handleTap`: dragJustEndedRef guards synthetic tap after drag
- `handleTap`: onTap+onClick double-fire guard (elapsed < 80ms → early return)
- `handleTap`: tbStateRef.current instead of stale tbState closure
- `EditingTextarea`: position fixe web (left:20, top:topOffset+20) + getBoundingClientRect en PWA standalone
- HslColorPicker: thumb centrage fix (margin-top: -9px → 1px), restored white 22px thumb with border
- TB double-fire idle→selected→editing: `mouseUpHandledTapRef` guard prevents `handleMouseUp` + `handleTapById` both firing on same touch
- Text-tool tap on selected TB → editing: `dragArmedHitId` was not set in text-mode mouseDown, causing mouseUp to skip the `selected→editing` transition
- Text-tool tap on other TB while selected: `mouseUpHandledTapRef` guard added in mouseDown to prevent `handleTapById` from escalating `selected→editing`
- `ResizeHandle` knob stays visually anchored to TB border during drag (knobRef offset compensation in onDragMove)

## Unified Color Picker — branch `feat/unified-color-picker`

Branch created from `refactor/sketchscreen-decomp` (v2.0.0). Unifies all color selection into a single `UnifiedColorPicker` component.

**Changes:**
- `UnifiedColorPicker.tsx` — single component with `mode` prop (`drawing` | `background` | `text`), preset swatches + expandable `HslColorPicker`
- `DrawingPanel` — replaced inline presets + chevron + `HslColorPicker` with `UnifiedColorPicker mode="drawing"`
- `ContextToolbar` — replaced `ColorPickerPanel` with `UnifiedColorPicker mode="background"`
- `TextPanel` — replaced native `<input type="color">` with `UnifiedColorPicker mode="text"` (toggled via `text_color` icon button, hidden by default)
- `ColorPickerPanel.tsx` — deleted (superseded)
- `HslColorPicker.tsx` — kept as internal sub-component of `UnifiedColorPicker`
- HomeScreen: drag-to-reorder vignettes (long-press+drag), vignette selection with badge bar (delete + rename), multi-select, ghost flottant, order persistence via `useDrawingOrder`
- `useDragToReorder` — adapted for 2D grid layout, two-phase long-press (`onLongPressRelease`), vertical auto-scroll
- `useDrawingOrder` — new hook, `sketchpad_drawing_order` localStorage key (Option A: separate array of IDs)
- Rename dialog (popup) and delete confirmation dialog on HomeScreen
- Thumbnail resolution doubled (200px → 400px wide) for sharper vignettes
- `ContextToolbar` — hit area 60px sous la toolbar (zone invisible, `position: absolute`, `zIndex: 10`) pour attraper le swipe up sans déclencher de trait sur le canvas
- Vignettes: `onContextMenu` preventDefault + `WebkitTouchCallout: none` + `userSelect: none` to block native long-press popup
- Vignette thumbnail height changed from fixed 300px to `28vh` for consistent mobile sizing
- Build timestamp (`__BUILD_TIME__`) displayed next to version badge on HomeScreen
- `useDragToReorder`: `blockNativeScroll` / `unblockNativeScroll` — prevents scroll/drag conflict on mobile
- `TextPanel`: duplicate button — copies selected textbox 20px above, same X, new TB in `selected` state
- `SketchScreen`: `activeTextBox` derived from `editingTextId ?? selectedTextId` — TextPanel controls work in both selected and editing states

## Pan Mode Memory + Button Mapping — branch `feat/unified-color-picker`

**Pan mode memory:** entering pan (move) saves `{ canvasMode, activeTool }` in `ToolState.previousMode`. FAB toggle off restores the saved context. Any other explicit mode/tool choice clears the memory. Persisted in localStorage.

**Hold-to-pan (pan momentané):**
Both FAB and physical buttons support hold-to-pan with 250ms threshold. Tap short → toggle (existing behavior). Hold ≥250ms → `enterPan()` activates pan immediately, release → `exitPan()` restores previous mode. `useToolState` exports `enterPan`/`exitPan`/`togglePan`. FAB uses `pointerDown`/`pointerUp`; `useButtonMapping` tracks hold state per key via `keydown`/`keyup` with `HoldAwareActions` interface (`toggle`/`enter`/`exit` callbacks per action).

**Konva multi-touch fix (hold-to-pan via FAB):**
- **Cause racine** : Konva `getPointerPosition()` lit `evt.touches[0]` (premier touch actif sur la page). Quand doigt A est sur le FAB (hors canvas), `touches[0]` = doigt A (immobile) → delta toujours ~0 → viewport ne bouge pas. De plus, `touches.length >= 2` déclenchait le pinch zoom à tort.
- **Fix** : `holdPanTouchId` ref stocke le `touch.identifier` du doigt B au `touchstart`. `handleMouseMove` itère `evt.touches` pour trouver le touch par identifier via `getTouchScreenPos()`, bypassing Konva. Guard anti-pinch ajouté (`!holdPanActiveRef.current`). Si le touch disparaît (doigt levé), le move est ignoré silencieusement.
- **Fichiers clés** : `useCanvasGestures.ts` (getTouchScreenPos helper, handleMouseDown/Move pan blocks), `ActionFABs.tsx` (FAB pointerDown/Up)

**Button mapping (physical buttons → actions):**
- `useButtonMapping` hook — two-phase system: listen mode (detect buttons via `keydown`, `preventDefault` on all captured keys) and active mode (hold-aware `keydown`/`keyup` listeners with 250ms threshold)
- `HoldAwareActions` interface: `{ toggle, enter, exit }` each containing a `Record<MappableAction, () => void>`
- `ButtonMappingModal` component — opened from Topbar dropdown "Mapping boutons". UI: detect button → list appears → `<select>` to assign action per button
- Actions: `toggle_pan` (extensible later)
- Persisted in `sketchpad_button_mapping` localStorage key
- Designed for Android rugged phones (Blackview etc.) with custom/programmable buttons. Volume keys and custom keys (F1/F3) work in Chrome Android when system-level mapping is set to "None"
- `preventDefault()` blocks native behavior (volume change, etc.) for mapped buttons

## Rotate & Scale — Phase 1 (fondation) — branch `feat/unified-color-picker`

Prépare le terrain pour rotate/scale des objets sélectionnés.

**Types:**
- `TextBox.rotation?: number` — angle de rotation en degrés (optionnel, défaut 0). Les strokes/airbrush auront leurs coords bakées au pointer-up, pas besoin de champ persistant.

**Utilitaire bounds (`src/utils/bounds.ts`):**
- `getLayerBounds(layer): Rect` — bounding box d'un layer (stroke: min/max points ± width/2, airbrush: min/max points ± radius, text: x/y/width + hauteur via `wrapText`)
- `getGroupBounds(layers, ids): Rect` — bounding box englobante d'un groupe de layers par IDs

**ResizeHandle refonte UI:**
- Poignée visible : petit carré plein ~10px (couleur `#333`), centré au milieu du bord gauche/droite du TB
- Zone d'accroche invisible : rectangle transparent ~30px autour du carré (vraie zone de hit-test/drag)
- Utilise `<Group>` Konva contenant deux `<Rect>` (hit zone + knob visible) au lieu d'un seul Rect teal 30×36px
- Pendant le drag, le knob visible reste accroché au bord de la TB (`knobRef` + compensation d'offset dans `onDragMove`), seule la hit zone suit le doigt
- S'applique en mode texte ET en mode select (#2) — même composant

**SelectionPanel refonte layout:**
- Toolbar (compteur + rotate/scale + delete + close) passe **en haut** du panel (au-dessus de la liste)
- Label descriptif (Stylo, Marqueur, Aerogr., Texte) passe **en haut** de chaque vignette
- Badge bar (delete + close par item) passe **en bas** de chaque vignette
- SVG inline remplacés par `<img src="/icons/delete.svg">` et `<img src="/icons/close.svg">`

## Rotate & Scale — Phase 3 (mode scale) — branch `feat/unified-color-picker`

Bounding box + 4 handles de scale + interaction canvas pour redimensionner les objets focusés (niveau 2).

**`BoundingBoxHandles.tsx` (nouveau composant Konva):**
- `Rect` pointillé orange (bounding box des focusedIds via `getGroupBounds`)
- 4 handles aux coins : carré visible 10px + zone d'accroche invisible 30px (taille fixe écran, divisée par stageScale)
- Ligne diagonale indicatrice centre→coin actif pendant le drag
- Scale factor = distance(coin courant, centre) / distance(coin original, centre)

**`bounds.ts` — `applyScale(layer, sx, sy, cx, cy)`:**
- Strokes : points transformés `(v - c) * s + c`, width scalée
- Airbrush : points transformés, radius scalé
- TextBox : délègue à `scaleTextBox` (moyenne sx/sy comme facteur uniforme)

**`textboxUtils.ts` — `scaleTextBox(tb, scaleFactor, cx?, cy?)`:**
- `newFontSize = fontSize * scaleFactor` (min 8, max 200, arrondi entier au relâchement via `roundTextBoxFontSize`)
- `newWidth = width * scaleFactor` (min 50)
- Position ajustée proportionnellement au centre de groupe si fourni

**`useCanvasGestures.ts` — 3 scale handlers:**
- `handleScaleStart` — snapshot layers + capture centre bounds
- `handleScaleMove(sf)` — applique applyScale au snapshot pour focusedIds
- `handleScaleEnd` — arrondit fontSize TB + pushUndo + scheduleSave

**`DrawingLayer.tsx`:**
- Nouvelles props : `selectSubMode`, `stageScale`, `onScaleStart/Move/End`
- Rend `<BoundingBoxHandles>` quand `selectSubMode === 'scale' && focusedIds.length > 0`

## Rotate & Scale — Phase 4 (mode rotate) — branch `feat/unified-color-picker`

Rotation libre des objets focusés (niveau 2) via un handle circulaire.

**`bounds.ts` — `rotatePoint(x, y, cx, cy, angleDeg)` + `applyRotation(layer, angleDeg, cx, cy)`:**
- Strokes : points bakés via rotation cos/sin autour du centre
- Airbrush : points bakés idem
- TextBox : position tournée autour du centre du groupe + `rotation` cumulée sur le layer (Konva rend via `<Group rotation>`)

**`BoundingBoxHandles.tsx` — refactoré avec `mode` prop (`'scale' | 'rotate'`):**
- Mode scale : inchangé (4 handles aux coins)
- Mode rotate : 1 handle circulaire au-dessus du coin top-right, ligne pointillée de liaison, icône rotate (arc + flèche), ligne indicatrice centre→handle pendant le drag
- Calcul d'angle via `atan2(dy, dx)` entre position courante et centre du bounds vs angle initial

**`useCanvasGestures.ts` — 3 rotate handlers:**
- `handleRotateStart` — snapshot layers + capture centre bounds
- `handleRotateMove(angleDeg)` — applique applyRotation au snapshot pour focusedIds
- `handleRotateEnd` — pushUndo + scheduleSave

**`DrawingLayer.tsx`:**
- `showHandles` inclut `selectSubMode === 'rotate'`
- Nouvelles props `onRotateStart/Move/End`
- Rendu conditionnel : `BoundingBoxHandles mode="scale"` ou `mode="rotate"`

**`TextBoxKonva.tsx`:**
- `<Group rotation={tb.rotation ?? 0}>` pour le rendu Konva des TB rotées

**`textboxUtils.ts` — fix hit-test TB rotées:**
- `isPointInTextBox` : dé-rotation du point de tap dans le repère local du TB avant test rectangulaire

## Do Not

- Do not add `node_modules/`, `dist/`, or `.zip` files to git
- Do not use `sudo` with npm
- Do not introduce new `any` types
- Do not break the TextBoxSelectionState state machine by adding separate boolean flags
- Do not put `canvasBackground` back into `useToolState` — it is per-Drawing state

## Architecture cible — Phase 2 (ne pas implémenter avant décision explicite)

### Librairie : Jotai + atomWithReducer
`npm install jotai`

### Deux machines d'état explicites à implémenter

**textToolState** : `'inactive' | 'initial' | 'active'`
- Actuellement écrasé dans `idle` de tbState
- Chaque état du gesture map doit correspondre à un cas de cette machine

**tbState** : `'idle' | 'not-selected' | 'selected' | 'editing'`
- Actuellement `idle` couvre deux cas distincts
- La distinction inactive/initial sera corrigée ici

### Hooks cibles
- `useTextToolState` avec `atomWithReducer`
- `useDrawingLayers` avec `atom` Jotai

### Référence
Chaque ligne du gesture map spec correspond à une action nommée du reducer.
