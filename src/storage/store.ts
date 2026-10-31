import { createStore, get, set } from 'idb-keyval';
import type { Profile } from '../engine';
import { newProfile } from '../engine';
import type { GameState } from '../game';
import { migrateGame } from '../game';

// The whole profile is one small document. IndexedDB first; localStorage if IndexedDB fails
// (for example some private windows).

const KEY = 'profile-v1';
const LS_KEY = 'level-up-typer:profile-v1';
let idb: ReturnType<typeof createStore> | null = null;

function store() {
  if (!idb) idb = createStore('level-up-typer', 'kv');
  return idb;
}

function migrate(raw: unknown): Profile {
  const fresh = newProfile();
  if (!raw || typeof raw !== 'object' || (raw as Profile).version !== 1) return fresh;
  const p = raw as Profile;
  return {
    ...fresh,
    ...p,
    settings: { ...fresh.settings, ...p.settings },
    unlocked: { ...fresh.unlocked, ...p.unlocked },
    baseline: { ...fresh.baseline, ...p.baseline },
    testPerKey: p.testPerKey ?? [],
    handoff: { ...fresh.handoff, ...p.handoff },
  };
}

export async function loadProfile(): Promise<Profile> {
  try {
    const v = await get(KEY, store());
    if (v) return migrate(v);
  } catch {
    // fall through to localStorage
  }
  try {
    const s = localStorage.getItem(LS_KEY);
    if (s) return migrate(JSON.parse(s));
  } catch {
    // ignore
  }
  return newProfile();
}

export async function saveProfile(p: Profile): Promise<void> {
  const copy = JSON.parse(JSON.stringify(p)) as Profile;
  try {
    await set(KEY, copy, store());
    return;
  } catch {
    // fall back
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(copy));
  } catch {
    // nothing else we can do
  }
}

// The game layer keeps its own document next to the profile, so the engine's data never holds game data.
const GAME_KEY = 'game-v1';
const GAME_LS_KEY = 'level-up-typer:game-v1';

const GAME_BROKEN_KEY = 'game-v1-unreadable';

/**
 * Null when there is no game document yet (a new player, or a profile from before M2). A
 * document that exists but cannot be read (damaged, or from a version this code does not know)
 * is copied aside first, so starting over never overwrites the only copy.
 */
export async function loadGame(): Promise<GameState | null> {
  let raw: unknown = null;
  try {
    raw = (await get(GAME_KEY, store())) ?? null;
  } catch {
    // fall through to localStorage
  }
  if (raw === null) {
    try {
      const s = localStorage.getItem(GAME_LS_KEY);
      if (s) raw = JSON.parse(s);
    } catch {
      // ignore
    }
  }
  if (raw === null) return null;
  const g = migrateGame(raw);
  if (g) return g;
  try {
    await set(GAME_BROKEN_KEY, raw, store());
  } catch {
    try {
      localStorage.setItem(GAME_BROKEN_KEY, JSON.stringify(raw));
    } catch {
      // nothing else we can do
    }
  }
  return null;
}

export async function saveGame(g: GameState): Promise<void> {
  const copy = JSON.parse(JSON.stringify(g)) as GameState;
  try {
    await set(GAME_KEY, copy, store());
    return;
  } catch {
    // fall back
  }
  try {
    localStorage.setItem(GAME_LS_KEY, JSON.stringify(copy));
  } catch {
    // nothing else we can do
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: Profile | null = null;

/** Debounced save, used after each chunk. */
export function saveSoon(p: Profile, ms = 400) {
  pending = p;
  if (timer) clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

export function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (pending) {
    const p = pending;
    pending = null;
    void saveProfile(p);
  }
}

/** Ask the browser not to evict our data (Safari can clear script storage after inactivity). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
