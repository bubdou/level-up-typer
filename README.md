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
npm test           # engine unit tests (Vitest)
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
- `src/data/wordlists.ts` practice content and its sources.
- `src/ui/` React screens. All English text is in `src/ui/copy.ts`.
- `src/storage/` saves the profile in IndexedDB (localStorage fallback).
