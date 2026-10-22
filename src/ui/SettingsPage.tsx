import { useState } from 'react';
import type { HintMode } from '../engine';
import { CONFIG, newProfile } from '../engine';
import type { LookId } from '../game';
import { GAME_CONFIG, levelOf, lookUnlocked, newGameState } from '../game';
import type { ScreenProps } from './App';
import { COPY } from './copy';
import { onControl, useKeydown } from './keys';

export function SettingsPage({ profile, go, changed, update, game, updateGame }: ScreenProps) {
  const [armed, setArmed] = useState(false);
  const [cleared, setCleared] = useState(false);
  useKeydown((e) => {
    if (onControl(e)) return;
    if (e.key === 'Escape') go({ name: 'home' });
  });
  const s = profile.settings;
  const gs = game.settings;
  const level = levelOf(game.xp);

  const reset = () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    update((p) => Object.assign(p, { ...newProfile(), settings: p.settings }));
    // The game starts over too, without a head start: there are no rounds left to count.
    updateGame((g) => Object.assign(g, { ...newGameState(), headStart: { rounds: 0, xp: 0, at: new Date().toISOString() }, settings: g.settings }));
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
      <label htmlFor="look">
        {COPY.settings.look}
        <select id="look" value={lookUnlocked(level, gs.look) ? gs.look : 'classic'} onChange={(e) => updateGame((g) => (g.settings.look = e.target.value as LookId))}>
          {GAME_CONFIG.looks.map((l) => (
            <option key={l.id} value={l.id} disabled={level < l.level}>
              {level < l.level ? COPY.settings.lookLocked(COPY.game.looks[l.id], l.level) : COPY.game.looks[l.id]}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="sounds">
        {COPY.settings.sounds}
        <input id="sounds" type="checkbox" checked={gs.sounds} onChange={(e) => updateGame((g) => (g.settings.sounds = e.target.checked))} />
      </label>
      <label htmlFor="anim">
        {COPY.settings.animations}
        <input id="anim" type="checkbox" checked={gs.animations} onChange={(e) => updateGame((g) => (g.settings.animations = e.target.checked))} />
      </label>
      <label htmlFor="pace">
        {COPY.settings.paceLine}
        <input id="pace" type="checkbox" checked={gs.paceLine} onChange={(e) => updateGame((g) => (g.settings.paceLine = e.target.checked))} />
      </label>
      <label htmlFor="week">
        {COPY.settings.weekGoal}
        <select id="week" value={gs.weekGoalDays} onChange={(e) => updateGame((g) => (g.settings.weekGoalDays = Number(e.target.value)))}>
          {GAME_CONFIG.weekGoalDaysOptions.map((n) => <option key={n} value={n}>{COPY.settings.weekGoalDays(n)}</option>)}
        </select>
      </label>
      <p className="note" style={{ margin: 0 }}>{COPY.settings.motionNote}</p>
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
