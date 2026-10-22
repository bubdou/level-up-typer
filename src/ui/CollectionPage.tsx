import { useState } from 'react';
import type { CollectionSet, DotState } from '../game';
import { collection, collectionTotal, masteredCount } from '../game';
import type { ScreenProps } from './App';
import { COPY } from './copy';
import { onControl, useKeydown } from './keys';

/** Filled, ring and short dash: the three states differ by shape as well as colour. */
export function Dot({ state }: { state: DotState }) {
  return (
    <svg className={`dot ${state}`} viewBox="0 0 12 12" aria-hidden="true">
      {state === 'mastered' && <circle cx="6" cy="6" r="5" />}
      {state === 'open' && <circle cx="6" cy="6" r="4" fill="none" strokeWidth="2" />}
      {state === 'locked' && <rect x="3" y="5" width="6" height="2" rx="1" />}
    </svg>
  );
}

const setId = (s: CollectionSet) => `${s.track}-${s.index}`;

export function CollectionPage({ profile, go }: ScreenProps) {
  const [openSet, setOpenSet] = useState<string | null>(null);
  useKeydown((e) => {
    if (onControl(e)) return;
    if (e.key === 'Escape') go({ name: 'home' });
  });
  const zones = collection(profile);
  const n = masteredCount(profile);
  const chosen = (() => {
    for (const z of zones) {
      const i = z.sets.findIndex((s) => setId(s) === openSet);
      if (i >= 0) return { set: z.sets[i], zone: COPY.stages[z.stage], number: i + 1 };
    }
    return null;
  })();

  return (
    <section className="panel sum" data-testid="collection">
      <div>
        <h1>{COPY.game.collection}</h1>
        <p className="muted">{COPY.game.collectionLead}</p>
      </div>
      <div className="ministars">
        <b className="tnum" data-testid="mastered-count">{n}</b>
        <span className="muted">{COPY.game.ofTotal(collectionTotal)}</span>
      </div>
      <div className="plainsky">
        <div className="legend">
          <span><Dot state="mastered" />{COPY.game.legendMastered}</span>
          <span><Dot state="open" />{COPY.game.legendOpen}</span>
          <span><Dot state="locked" />{COPY.game.legendLocked}</span>
        </div>
        {zones.map((z) => (
          <div key={z.stage} className="zone" data-testid={`zone-${z.stage}`}>
            <div>
              <h3>{COPY.stages[z.stage]}</h3>
              <small className="tnum">{COPY.game.zoneCount(z.mastered, z.total)}</small>
            </div>
            <div className="sets">
              {z.sets.map((s, i) => {
                const id = setId(s);
                const label = `${COPY.game.setTitle(COPY.stages[z.stage], i + 1)}: ${s.open ? COPY.game.setCount(s.mastered) : COPY.game.setLocked}`;
                return (
                  <button
                    key={id}
                    className={`cset${s.open ? '' : ' lockedset'}`}
                    aria-label={label}
                    title={label}
                    aria-pressed={id === openSet}
                    disabled={!s.open}
                    onClick={() => setOpenSet(id === openSet ? null : id)}
                  >
                    {s.items.map((it) => <Dot key={it.key} state={it.state} />)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="setdetail" data-testid="set-detail">
          {chosen ? (
            <SetDetail {...chosen} />
          ) : (
            <span className="note">{COPY.game.pickSet}</span>
          )}
        </div>
      </div>
      <p className="note">{COPY.game.collectionSets} {COPY.game.tracksNote}</p>
    </section>
  );
}

function SetDetail({ set, zone, number }: { set: CollectionSet; zone: string; number: number }) {
  return (
    <>
      <b>{COPY.game.setTitle(zone, number)}</b>
      <span className="note">{COPY.game.setCount(set.mastered)}</span>
      <div className="chips">
        {set.items.map((it) => (
          <span key={it.key} className={`chip${it.state === 'mastered' ? ' star' : ''}`}>{it.text}</span>
        ))}
      </div>
    </>
  );
}
