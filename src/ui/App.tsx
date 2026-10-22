import { useCallback, useEffect, useState } from 'react';
import type { Profile, RoundSummary, TestComparison, TestRecord } from '../engine';
import type { ChallengeResult, GameState, RoundPoints } from '../game';
import { applyHeadStart, lookUnlocked, levelOf, newGameState, syncEverMastered } from '../game';
import { flush, loadGame, loadProfile, requestPersistence, saveGame, saveProfile, saveSoon } from '../storage/store';
import { ChallengeResultPage } from './ChallengeResult';
import { CollectionPage } from './CollectionPage';
import { COPY } from './copy';
import { Home } from './Home';
import { PowerUpsPage } from './PowerUpsPage';
import { Practice } from './Practice';
import { ProgressPage } from './ProgressPage';
import { SettingsPage } from './SettingsPage';
import { Summary } from './Summary';
import { TestResult } from './TestResult';
import { TestScreen, TestStopped } from './TestScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'practice' }
  | { name: 'summary'; summary: RoundSummary; points: RoundPoints | null }
  | { name: 'test'; minutes: number }
  | { name: 'testStopped'; minutes: number }
  | { name: 'testResult'; record: TestRecord; comparison: TestComparison; missed: string[]; pace: number | null }
  | { name: 'progress'; minutes?: number }
  | { name: 'settings' }
  | { name: 'collection' }
  | { name: 'powerUps' }
  | { name: 'challenge'; challenge: ChallengeSpec }
  | { name: 'challengeResult'; challenge: ChallengeSpec; summary: RoundSummary; result: ChallengeResult };

/** One Collection set to challenge. */
export interface ChallengeSpec {
  set: string;
  items: string[];
  label: string;
}

export interface ScreenProps {
  profile: Profile;
  go: (s: Screen) => void;
  /** Call after an engine changed the profile: re-renders and saves soon. */
  changed: (opts?: { now?: boolean }) => void;
  /** Change the profile from UI code (settings and the like). */
  update: (fn: (p: Profile) => void) => void;
  /** The game layer's own state. The engine never reads it. */
  game: GameState;
  /** Change the game state: re-renders and saves. */
  updateGame: (fn: (g: GameState) => void) => void;
}

async function loadAll(): Promise<{ profile: Profile; game: GameState }> {
  const [profile, saved] = await Promise.all([loadProfile(), loadGame()]);
  const game = saved ?? newGameState();
  const headStart = applyHeadStart(game, profile, Date.now());
  const seeded = syncEverMastered(game, profile);
  if (headStart > 0 || seeded > 0 || !saved) void saveGame(game);
  return { profile, game };
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [, setVersion] = useState(0);

  useEffect(() => {
    void loadAll().then((all) => {
      setGame(all.game);
      setProfile(all.profile);
    });
    void requestPersistence();
    const hide = () => flush();
    window.addEventListener('pagehide', hide);
    return () => window.removeEventListener('pagehide', hide);
  }, []);

  const changed = useCallback(
    (opts?: { now?: boolean }) => {
      if (!profile) return;
      setVersion((v) => v + 1);
      if (opts?.now) void saveProfile(profile);
      else saveSoon(profile);
    },
    [profile],
  );

  const update = useCallback(
    (fn: (p: Profile) => void) => {
      if (!profile) return;
      fn(profile);
      changed();
    },
    [profile, changed],
  );

  const updateGame = useCallback(
    (fn: (g: GameState) => void) => {
      if (!game) return;
      fn(game);
      setVersion((v) => v + 1);
      void saveGame(game);
    },
    [game],
  );

  const animationsOff = game ? !game.settings.animations : false;
  useEffect(() => {
    document.documentElement.classList.toggle('no-anim', animationsOff);
  }, [animationsOff]);

  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  if (!profile || !game) return <div className="wrap"><p className="loading">{COPY.appName}</p></div>;

  const props: ScreenProps = { profile, go, changed, update, game, updateGame };
  const look = lookUnlocked(levelOf(game.xp), game.settings.look) ? game.settings.look : 'classic';
  const inRound = screen.name === 'practice' || screen.name === 'test' || screen.name === 'challenge';

  return (
    <div className="wrap">
      <header className="app">
        <div className="brand"><i />{COPY.appName}</div>
        {!inRound && (
          <nav className="links">
            {screen.name !== 'home' && <button onClick={() => go({ name: 'home' })}>{COPY.nav.home}</button>}
            <button onClick={() => go({ name: 'collection' })}>{COPY.nav.collection}</button>
            <button onClick={() => go({ name: 'powerUps' })}>{COPY.nav.powerUps}</button>
            <button onClick={() => go({ name: 'progress' })}>{COPY.nav.progress}</button>
            <button onClick={() => go({ name: 'settings' })}>{COPY.nav.settings}</button>
          </nav>
        )}
      </header>
      <main>
        {screen.name === 'home' && <Home {...props} />}
        {screen.name === 'practice' && <Practice {...props} look={look} />}
        {screen.name === 'summary' && <Summary {...props} summary={screen.summary} points={screen.points} />}
        {screen.name === 'test' && <TestScreen {...props} minutes={screen.minutes} />}
        {screen.name === 'testStopped' && <TestStopped {...props} minutes={screen.minutes} />}
        {screen.name === 'testResult' && <TestResult {...props} record={screen.record} comparison={screen.comparison} missed={screen.missed} pace={screen.pace} />}
        {screen.name === 'progress' && <ProgressPage {...props} initialMinutes={screen.minutes} />}
        {screen.name === 'settings' && <SettingsPage {...props} />}
        {screen.name === 'collection' && <CollectionPage {...props} />}
        {screen.name === 'powerUps' && <PowerUpsPage {...props} />}
        {screen.name === 'challenge' && <Practice {...props} look={look} challenge={screen.challenge} />}
        {screen.name === 'challengeResult' && (
          <ChallengeResultPage {...props} challenge={screen.challenge} summary={screen.summary} result={screen.result} />
        )}
      </main>
    </div>
  );
}
