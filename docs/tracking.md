# Tiktaalik — Suivi projet

---

## État des branches

| Branche | Base | Statut |
|---|---|---|
| `main` | — | Branche principale |
| `dev` | main | Branche de développement active |
| `refactor/sketchscreen-decomp` | main | COMPLETE — en attente de validation PO pour merge |
| `feat/unified-color-picker` | refactor/sketchscreen-decomp | Branche feature active (v2.0.0+) |

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

## Issues connues

- ESLint ~16 erreurs : vars inutilisées, types `any`, un catch vide — cleanup en cours
- `react-hooks/exhaustive-deps` rule référencée mais plugin non installé
- Stubs de test Playwright (`e2e/example.spec.ts`, `tests/example.spec.ts`) échouent dans Vitest — pré-existants, pas de vrais tests
- Pinch zoom pendant édition texte sort du mode editing — limitation connue, différée

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

- Types `any` à éliminer progressivement
- Un seul fichier de test unitaire (`textboxUtils.test.ts`)
- ESLint non clean (~16 erreurs)
- Plugin `react-hooks/exhaustive-deps` non installé
