import { useState } from 'react';
import type { ScreenProps } from './App';
import { COPY } from './copy';
import { Keyboard } from './Keyboard';
import { onControl, useKeydown } from './keys';

/**
 * Three short cards before the first practice: how to sit, fingers on the home keys, eyes up.
 * They show once by themselves (old profiles too) and can be opened again from Home.
 */
export function Basics({ update, go, then }: ScreenProps & { then: 'practice' | 'home' }) {
  const [i, setI] = useState(0);
  const cards = COPY.basics.cards;
  const card = cards[i];
  const last = i === cards.length - 1;

  const next = () => {
    if (!last) return setI(i + 1);
    update((p) => (p.seenBasics = true));
    go({ name: then });
  };

  useKeydown((e) => {
    if (e.key !== 'Enter' || onControl(e)) return;
    e.preventDefault();
    next();
  });

  return (
    <section className="panel basics" data-testid="basics" data-card={i + 1}>
      <span className="note">{COPY.basics.step(i + 1, cards.length)}</span>
      <h1>{card.title}</h1>
      <p className="lead">{card.text}</p>
      {i === 1 && <Keyboard lit={null} level="labels" popped={false} wrong={null} line="" homeOnly />}
      <div className="row">
        <button className="btn" onClick={next} data-testid="basics-next">{last ? COPY.basics.start : COPY.basics.next}</button>
        <span className="note">{COPY.basics.orEnter}</span>
      </div>
    </section>
  );
}
