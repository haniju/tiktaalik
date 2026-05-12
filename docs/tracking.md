# Tiktaalik — Suivi projet

---

## État des branches

| Branche | Base | Statut |
|---|---|---|
| `main` | — | Branche principale |
| `dev` | main | Branche de développement active |
| `refactor/sketchscreen-decomp` | main | COMPLETE — mergé dans main |
| `feat/unified-color-picker` | refactor/sketchscreen-decomp | COMPLETE — mergé dans main via dev |

## Phases complétées

### Phase 1 — Décomposition SketchScreen (branche `refactor/sketchscreen-decomp`)

Décomposition de `SketchScreen.tsx` (~1274 → ~430 lignes). Steps 0-9 complétées — voir git history.

Features ajoutées (v1.5.0 → v1.8.3) :
- HslColorPicker (remplace DrawingSecondaryToolbar supprimé)
- Opacité par outil (marqueur, aérographe centre/bord)
- Debug overlay toggle
- Zoom 100% par défaut, min 10%, monde 3x3 A4
- Pinch-to-zoom (toggle, off par défaut)
- Icônes toolbar spraypaint/highlight
- Slider modernisé (CSS global `app-slider`)
- Bouton install PWA (HomeScreen)
- Zoom slider dans ActionFABs (+/- et label flottant)
- Inline rename dans la Topbar
- Gestes swipe sur Drawingbar (↓ ouvre panel, ↑ ferme)
- ContextToolbar slide animation
- HomeScreen galerie flex-wrap 2-col, vignettes 400px
- TextPanel stepper +/- pour taille police

Bug fixes : saveNowRef autosave, ResizeHandle clamping, dragJustEndedRef, double-fire guards, EditingTextarea web/PWA, TB double-fire, text-tool tap transitions, ResizeHandle knob anchoring.

### Unified Color Picker (branche `feat/unified-color-picker`)

Branche créée depuis refactor/sketchscreen-decomp (v2.0.0).

- `UnifiedColorPicker` unifie dessin/fond/texte (3 modes)
- `ColorPickerPanel.tsx` supprimé (remplacé)
- HomeScreen : drag-to-reorder, sélection multi, badge bar, ordre persisté (Option A)
- Dialogues renommage/suppression
- Miniatures doublées (200→400px)
- Hit area 60px sous ContextToolbar
- Vignettes anti-popup natif
- Build timestamp affiché
- Bouton duplicate TextPanel
- `activeTextBox` dérivé de `editingTextId ?? selectedTextId`

### Pan Mode Memory + Button Mapping (branche `feat/unified-color-picker`)

- Mémoire du mode pan (previousMode persisté)
- Hold-to-pan FAB + boutons physiques (250ms)
- Fix multi-touch Konva (holdPanTouchId)
- Système de mapping boutons physiques (useButtonMapping, ButtonMappingModal)

### Rotate & Scale — Phases 1, 3, 4 (branche `feat/unified-color-picker`)

- Phase 1 (fondation) : `TextBox.rotation`, utilitaires bounds, ResizeHandle refonte UI, SelectionPanel refonte layout
- Phase 3 (scale) : BoundingBoxHandles 4 coins, applyScale, scaleTextBox, 3 handlers scale
- Phase 4 (rotate) : handle circulaire, applyRotation, rotatePoint, hit-test TB rotées, rendu Konva rotation

### v2.1.0 — Groupes, About, qualité (branche `dev`)

- Groupement d'objets avec hiérarchie imbriquée (groupUtils.ts)
- Select all/unselect all toggle dans SelectionPanel
- Panneau À propos (AboutModal) — accessible Home + Topbar dropdown
- Performance : rendu impératif pen/marker (bypass React state, coalesced events)
- Nettoyage ESLint complet (19 erreurs → 0)
- Suppression stubs Playwright
- Tests unitaires : bounds.ts (34) + groupUtils.ts (33)
- Fix pen/marker mobile (TouchEvent clientX)
- Fix button mapping vs clavier virtuel
- Fix lasso + rotation handle jumps

### Session nettoyage dette technique (2026-05-12)

Diagnostic et nettoyage de la dette technique documentée :

1. **Stubs Playwright supprimés** — `e2e/example.spec.ts` et `tests/example.spec.ts` étaient des fichiers générés par `npm init playwright` (exemples playwright.dev). Vitest les ramassait via son pattern par défaut `**/*.spec.ts`, provoquant 2 erreurs systématiques à chaque `npm run test`. Supprimés car sans valeur (aucun test réel de l'app).

2. **Tests unitaires étendus** — Extraction de `isStrokeInRect`/`isAirbrushInRect` depuis le code inline de `useCanvasGestures.ts` vers `bounds.ts` (fonctions pures testables). Ajout de `bounds.test.ts` (34 tests) et `groupUtils.test.ts` (33 tests). Mock canvas 2D dans `setup.ts` pour supporter `wrapText` en jsdom. Exclusion des fichiers test du build `tsc` via `tsconfig.json`.

3. **Plugin `eslint-plugin-react-hooks` installé** — Activation de `rules-of-hooks` (error) et `exhaustive-deps` (warn). Installation via `--legacy-peer-deps` (conflit peer avec eslint v10 + eslint-plugin-react).

4. **Fix `rules-of-hooks` dans `SelectionPanel.tsx`** — Les hooks (`useRef`, `useState`, `useDragToReorder`) étaient appelés après un early return (`if (selection.length === 0) return null`). Déplacé le `return null` après les appels de hooks.

5. **Types `any` vérifiés** — Aucun `any` restant dans le code source (le seul est dans `setup.ts` pour le mock canvas, avec `eslint-disable` justifié).

## Issues connues

- Pinch zoom pendant édition texte sort du mode editing — limitation connue, différée
- ESLint 14 erreurs restantes (`no-unused-vars`, `no-empty`, `no-explicit-any` dans useToolState) — pre-existantes, à traiter progressivement

## Cibles d'architecture (décisions en attente)

### Phase 2 — Jotai + atomWithReducer (ne pas implémenter avant décision explicite)

Librairie : `jotai` (`npm install jotai`)

Deux machines d'état explicites à implémenter :

**textToolState** : `'inactive' | 'initial' | 'active'`
- Actuellement écrasé dans `idle` de tbState
- Chaque état du gesture map doit correspondre à un cas de cette machine

**tbState** : `'idle' | 'not-selected' | 'selected' | 'editing'`
- Actuellement `idle` couvre deux cas distincts
- La distinction inactive/initial sera corrigée ici

Hooks cibles : `useTextToolState` avec `atomWithReducer`, `useDrawingLayers` avec `atom` Jotai.

Référence : chaque ligne du gesture map spec correspond à une action nommée du reducer.

## Dette technique

- ESLint 14 erreurs restantes (vars inutilisées, `any` dans useToolState, catch vide)
- Aucun test e2e réel (config Playwright présente mais 0 test — stubs supprimés)
