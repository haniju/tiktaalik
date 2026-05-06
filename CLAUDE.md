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

## Project Overview

**Tiktaalik** is a mobile-first web-based sketchpad app (React + TypeScript + Konva) with two screens: **HomeScreen** (gallery of drawings) and **SketchScreen** (canvas drawing interface). All data lives in `localStorage`. Tests: Vitest (unit) + Playwright (e2e). Setup: `src/test/setup.ts`.

## Documentation

| Document | Contenu | Public cible |
|---|---|---|
| `docs/behavior.md` | **Spec comportementale** — ce que fait l'app (tech-agnostique) | PO, designer, portage |
| `docs/implementation.md` | **Notes d'implémentation** — comment ça marche (React/Konva) | Développeur |
| `docs/stroke-quality.md` | **Qualité des tracés** — optimisations fluidité/précision stylet | Développeur |
| `docs/tracking.md` | **Suivi projet** — branches, phases, issues, cibles archi | Équipe |
| `CHANGELOG.md` | Historique des releases | Tous |

## Where to Document New Work

After implementing a feature or fix:
1. **Comportement utilisateur modifié ?** → Ajouter/mettre à jour la section correspondante dans `docs/behavior.md` (décrire CE QUI change du point de vue utilisateur, pas de code)
2. **Nouveau pattern, guard, pitfall ou workaround ?** → Ajouter dans `docs/implementation.md` (décrire COMMENT ça marche techniquement, inclure les chemins de fichiers)
3. **Branche mergée, issue résolue, nouvelle issue ?** → Mettre à jour `docs/tracking.md`
4. **Nouvelle release ?** → Mettre à jour `CHANGELOG.md`
5. **Nouvelle convention ou interdit ?** → Ajouter dans la section Conventions ci-dessous

## Conventions

- **Language**: Code in English, comments in French are OK
- **Components**: Functional components only, no class components
- **Exports**: Named exports preferred
- **State**: React hooks (`useState`, `useRef`, `useCallback`), no external state library
- **Styling**: Inline styles (no CSS files); global slider CSS injected via `<style>` in `App.tsx`
- **No `any`**: Use proper types — existing `any` in the codebase is tech debt to fix
- **Unused code**: Remove dead imports and variables, don't comment them out
- **Commits**: Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`)

## Do Not

- Do not add `node_modules/`, `dist/`, or `.zip` files to git
- Do not use `sudo` with npm
- Do not introduce new `any` types
- Do not break the TextBoxSelectionState state machine by adding separate boolean flags
- Do not put `canvasBackground` back into `useToolState` — it is per-Drawing state
