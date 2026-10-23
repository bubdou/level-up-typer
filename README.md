# Level Up Typer

A typing trainer that builds speed in chunks ("th", "ing", "the") instead of one letter at a time.
Front end only: progress is stored in the browser.

## Run it

```sh
npm install
npm run dev        # http://localhost:5173
```

Add `?minutes=1` to the URL for a short round when trying things out.

## Checks

```sh
npm run lint
npm run typecheck
npm test           # engine and game unit tests (Vitest)
npm run e2e        # end-to-end tests (Playwright, Chromium locally; CI also runs WebKit)
PW_WEBKIT=1 npm run e2e   # include WebKit (Safari's engine) locally
```

## Layout

- `src/engine/` the training engine, plain TypeScript with no UI code.
  - `config.ts` every threshold (slow factor, repair rules, hint delays, round split...).
  - `round.ts` one practice round: chunk timing, repair bay, revisits, mastery, segments.
  - `testRun.ts` the 1 or 3 minute test and its scoring.
  - `profile.ts` stored data, letter hint states, hunting letters.
  - `plan.ts` today's round (Keys, Chunks, Flow).
- `src/game/` the game layer (M2), plain TypeScript. It listens to the engine's chunk events and
  reads its round summaries; it never writes engine data or changes what is practiced.
  - `config.ts` every number (XP per event, level curve, power-ups, week goal).
  - `scorer.ts` XP during a round: Combo, Spark, Flow Chain, Shield, level-up bubbles.
  - `finish.ts` end-of-round bonuses (Key Finder, week goal) and the one-time head start.
  - `collection.ts` the Collection, read from the engine's mastered items and batches.
  - `week.ts` practice days and the Monday-to-Sunday week.
  - `challenge.ts` (M2b) set-challenge medals and the usual-pace line for tests.
- `src/data/wordlists.ts` practice content and its sources.
- `src/ui/` React screens. All English text is in `src/ui/copy.ts`.
- `src/storage/` saves the profile and, as a separate document, the game state in IndexedDB (localStorage fallback).
