import { createStore, get, set } from 'idb-keyval';
import type { Profile } from '../engine';
import { newProfile } from '../engine';

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
