import { useCallback, useEffect, useState } from 'react';
import type { Profile, RoundSummary, TestComparison, TestRecord } from '../engine';
import { flush, loadProfile, requestPersistence, saveProfile, saveSoon } from '../storage/store';
import { COPY } from './copy';
import { Home } from './Home';
import { Practice } from './Practice';
import { ProgressPage } from './ProgressPage';
import { SettingsPage } from './SettingsPage';
import { Summary } from './Summary';
import { TestResult } from './TestResult';
import { TestScreen, TestStopped } from './TestScreen';

export type Screen =
  | { name: 'home' }
  | { name: 'practice' }
  | { name: 'summary'; summary: RoundSummary }
  | { name: 'test'; minutes: number }
  | { name: 'testStopped'; minutes: number }
  | { name: 'testResult'; record: TestRecord; comparison: TestComparison; missed: string[] }
  | { name: 'progress'; minutes?: number }
  | { name: 'settings' };

export interface ScreenProps {
  profile: Profile;
  go: (s: Screen) => void;
  /** Call after an engine changed the profile: re-renders and saves soon. */
  changed: (opts?: { now?: boolean }) => void;
  /** Change the profile from UI code (settings and the like). */
  update: (fn: (p: Profile) => void) => void;
}

export function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [, setVersion] = useState(0);

  useEffect(() => {
    void loadProfile().then(setProfile);
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

  const go = useCallback((s: Screen) => {
    setScreen(s);
    window.scrollTo(0, 0);
  }, []);

  if (!profile) return <div className="wrap"><p className="loading">{COPY.appName}</p></div>;

  const props: ScreenProps = { profile, go, changed, update };
  const inRound = screen.name === 'practice' || screen.name === 'test';

  return (
    <div className="wrap">
      <header className="app">
        <div className="brand"><i />{COPY.appName}</div>
        {!inRound && (
          <nav className="links">
            {screen.name !== 'home' && <button onClick={() => go({ name: 'home' })}>{COPY.nav.home}</button>}
            <button onClick={() => go({ name: 'progress' })}>{COPY.nav.progress}</button>
            <button onClick={() => go({ name: 'settings' })}>{COPY.nav.settings}</button>
          </nav>
        )}
      </header>
      <main>
        {screen.name === 'home' && <Home {...props} />}
        {screen.name === 'practice' && <Practice {...props} />}
        {screen.name === 'summary' && <Summary {...props} summary={screen.summary} />}
        {screen.name === 'test' && <TestScreen {...props} minutes={screen.minutes} />}
        {screen.name === 'testStopped' && <TestStopped {...props} minutes={screen.minutes} />}
        {screen.name === 'testResult' && <TestResult {...props} record={screen.record} comparison={screen.comparison} missed={screen.missed} />}
        {screen.name === 'progress' && <ProgressPage {...props} initialMinutes={screen.minutes} />}
        {screen.name === 'settings' && <SettingsPage {...props} />}
      </main>
    </div>
  );
}
