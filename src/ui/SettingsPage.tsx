import { useState } from 'react';
import type { HintMode } from '../engine';
import { CONFIG, newProfile } from '../engine';
import type { ScreenProps } from './App';
import { COPY } from './copy';
import { onControl, useKeydown } from './keys';

export function SettingsPage({ profile, go, changed, update }: ScreenProps) {
  const [armed, setArmed] = useState(false);
  const [cleared, setCleared] = useState(false);
  useKeydown((e) => {
    if (onControl(e)) return;
    if (e.key === 'Escape') go({ name: 'home' });
  });
  const s = profile.settings;

  const reset = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    update((p) => Object.assign(p, { ...newProfile(), settings: p.settings }));
    setArmed(false);
    setCleared(true);
    changed({ now: true });
  };

  return (
    <section className="panel set" data-testid="settings">
      <h1>{COPY.settings.title}</h1>
      <label htmlFor="len">
        {COPY.settings.roundLength}
        <select id="len" value={s.roundMinutes} onChange={(e) => update((p) => (p.settings.roundMinutes = Number(e.target.value)))}>
          {CONFIG.roundMinutesOptions.map((m) => <option key={m} value={m}>{COPY.minutes(m)}</option>)}
        </select>
      </label>
      <label htmlFor="hints">
        {COPY.settings.keyHints}
        <select id="hints" value={s.hints} onChange={(e) => update((p) => (p.settings.hints = e.target.value as HintMode))}>
          {(['auto', 'always', 'off'] as const).map((m) => <option key={m} value={m}>{COPY.settings.hintModes[m]}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn ghost" onClick={reset}>{armed ? COPY.settings.resetConfirm : COPY.settings.reset}</button>
        {cleared && <span className="note">{COPY.settings.resetDone}</span>}
      </div>
      <p className="note">{COPY.settings.storageNote}</p>
      <div>
        <div className="label">{COPY.settings.aboutTitle}</div>
        <ul className="about">{COPY.settings.about.map((a) => <li key={a}>{a}</li>)}</ul>
      </div>
    </section>
  );
}
