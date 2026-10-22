import { GAME_CONFIG, POWER_UPS, levelOf } from '../game';
import type { ScreenProps } from './App';
import { COPY } from './copy';
import { GameIcon, LevelBlock } from './GameParts';
import { onControl, useKeydown } from './keys';

const SWATCH: Record<string, string[]> = {
  classic: ['#2f5bea', '#e4eafd', '#f4f6fb'],
  ocean: ['#0e7c86', '#cdeef0', '#eef8f9'],
  forest: ['#2e7d32', '#d6ecd2', '#f2f7f0'],
  night: ['#7d9bff', '#232c52', '#0f1324'],
};

export function PowerUpsPage({ go, game }: ScreenProps) {
  useKeydown((e) => {
    if (onControl(e)) return;
    if (e.key === 'Escape') go({ name: 'home' });
  });
  const level = levelOf(game.xp);
  return (
    <section className="panel sum" data-testid="power-ups">
      <div>
        <h1>{COPY.game.powerUpsTitle}</h1>
        <p className="muted">{COPY.game.powerUpsLead}</p>
      </div>
      <LevelBlock xp={game.xp} />
      <div className="pugrid">
        {POWER_UPS.map((p) => {
          const on = level >= p.level;
          const c = COPY.game.powerUps[p.id];
          return (
            <div key={p.id} className={`pu${on ? '' : ' locked'}`} data-testid={`pu-${p.id}`} data-unlocked={on}>
              <div className="ic"><GameIcon id={p.id} /></div>
              <h3>
                {c.name} <span className="lv">{on ? COPY.game.unlocked : COPY.game.atLevel(p.level)}</span>
              </h3>
              <p className="muted">{c.what}</p>
              <span className="skill">{c.trains}</span>
            </div>
          );
        })}
      </div>
      <div>
        <div className="label">{COPY.game.looksTitle}</div>
        <div className="looks" style={{ marginTop: 8 }}>
          {GAME_CONFIG.looks.map((l) => (
            <div key={l.id} className={`look${level >= l.level ? '' : ' locked'}`}>
              <div className="sw">{SWATCH[l.id].map((c) => <i key={c} style={{ background: c }} />)}</div>
              <b>{COPY.game.looks[l.id]}</b>
              <span className="note">{level >= l.level ? COPY.game.unlocked : COPY.game.atLevel(l.level)}</span>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8 }}>{COPY.game.looksNote}</p>
      </div>
    </section>
  );
}
