# Politikum Solo — Execution Plan

## Goal

Create a standalone, Vercel-deployable single-player Politikum build that plays locally in a desktop or mobile browser, reuses the existing card/UI assets, and has no multiplayer server, admin panel, tournament state, database, or external runtime dependency.

## Approach

1. Audit the multiplayer client and shared engine to identify the smallest self-contained rules surface needed for human-versus-bot play.
2. Create a fresh Vite React app under `politikum-solo`, copy only card/UI/SFX assets, and make its package dependencies browser-only.
3. Port the deterministic game state and core turn/response/bot loop into local client modules; retain interaction patterns required by implemented abilities.
4. Build a responsive tabletop UI with a mobile single-column layout, touch-size controls, and no server/API calls.
5. Verify production build, smoke-test in a browser, measure source LOC against the existing Politikum app variants, and report the comparison.

## Acceptance checks

- `npm run build` works from a clean install.
- `dist/` contains a static app with no Node server, database, admin, tournament, or multiplayer imports.
- A human can start a local match, draw/play cards, resolve required choices, take turns with bots, and reach game-over.
- The layout remains usable at roughly 390px wide and desktop widths.
