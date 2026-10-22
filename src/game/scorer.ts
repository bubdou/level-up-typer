import type { ChunkEvent } from '../engine';
import { GAME_CONFIG } from './config';
import { levelOf } from './levels';
import type { Unlock } from './powerups';
import { hasPowerUp, unlocksBetween } from './powerups';
import type { RoundPoints } from './state';

/** Short messages shown between chunks. */
export type Bubble = { kind: 'level'; level: number; unlocks: Unlock[] } | { kind: 'combo' } | { kind: 'shield' };

/** What the last chunk earned, for the small "+10" next to the strip. */
export interface Feedback {
  xp: number;
  fixed: boolean;
  mastered: boolean;
  bubbles: Bubble[];
}

const zeroCounts = (): RoundPoints['counts'] => ({ smooth: 0, slowClean: 0, quick: 0, fixed: 0, mastered: 0, flowChain: 0 });
const zeroXp = (): RoundPoints['xp'] => ({
  smooth: 0,
  slowClean: 0,
  quick: 0,
  fixed: 0,
  mastered: 0,
  flowChain: 0,
  comboBonus: 0,
  keyFinder: 0,
  weekGoal: 0,
});

/**
 * Turns one round's engine events into XP. It only listens: it never changes what the engine
 * picks, judges or repairs. Power-ups follow the level reached so far, so one that unlocks in the
 * middle of a round works from the next chunk on.
 */
export class RoundScorer {
  readonly xpBefore: number;
  readonly counts = zeroCounts();
  readonly xp = zeroXp();
  readonly newlyMastered: string[] = [];
  private _combo = 0;
  private _shieldUsed = false;
  private chain = 0;
  /** Item keys mastered for the first time ever in this round. */
  readonly firstMastered: string[] = [];
  private everMastered: ReadonlySet<string>;
  private pending: Feedback = { xp: 0, fixed: false, mastered: false, bubbles: [] };

  constructor(xpBefore: number, everMastered: Iterable<string> = []) {
    this.xpBefore = xpBefore;
    this.everMastered = new Set(everMastered);
  }

  get gained(): number {
    return Object.values(this.xp).reduce((a, b) => a + b, 0);
  }

  get level(): number {
    return levelOf(this.xpBefore + this.gained);
  }

  get combo(): number {
    return this._combo;
  }

  /** Points are doubled while this is true. */
  get hot(): boolean {
    return hasPowerUp(this.level, 'combo') && this._combo >= GAME_CONFIG.combo.need;
  }

  get shieldUsed(): boolean {
    return this._shieldUsed;
  }

  /** Feedback since the last call. */
  take(): Feedback {
    const f = this.pending;
    this.pending = { xp: 0, fixed: false, mastered: false, bubbles: [] };
    return f;
  }

  onEvent(e: ChunkEvent) {
    const lv = this.level;
    switch (e.type) {
      case 'smooth':
      case 'slow': {
        const mult = this.hot ? GAME_CONFIG.combo.multiplier : 1;
        if (e.type === 'smooth') {
          this.counts.smooth++;
          this.award('smooth', GAME_CONFIG.xp.smooth, mult);
          // Spark trains starting a chunk without stopping first, so the Keys warm-up does not count.
          if (hasPowerUp(lv, 'spark') && e.segment !== 'keys' && e.quickStart === true) {
            this.counts.quick++;
            this.award('quick', GAME_CONFIG.spark.xp, mult);
          }
        } else {
          this.counts.slowClean++;
          this.award('slowClean', GAME_CONFIG.xp.slowClean, 1);
        }
        if (hasPowerUp(lv, 'combo')) {
          this._combo++;
          if (this._combo === GAME_CONFIG.combo.need) this.pending.bubbles.push({ kind: 'combo' });
        }
        this.flow(e, lv);
        break;
      }
      case 'error': {
        if (hasPowerUp(lv, 'combo') && this._combo > 0) {
          if (hasPowerUp(lv, 'shield') && !this._shieldUsed) {
            this._shieldUsed = true;
            this.pending.bubbles.push({ kind: 'shield' });
          } else {
            this._combo = 0;
          }
        }
        this.flow(e, lv);
        break;
      }
      case 'fixed':
        this.counts.fixed++;
        this.pending.fixed = true;
        this.award('fixed', GAME_CONFIG.xp.fixed, 1);
        break;
      case 'mastered':
        // Paid once per item: mastering it again after the engine cleared it earns nothing extra.
        if (this.everMastered.has(e.itemKey) || this.firstMastered.includes(e.itemKey)) break;
        this.firstMastered.push(e.itemKey);
        this.counts.mastered++;
        this.newlyMastered.push(e.text);
        this.pending.mastered = true;
        this.award('mastered', GAME_CONFIG.xp.mastered, 1);
        break;
    }
  }

  /** Flow Chain: in Flow, 5 clean words in a row that each start no slower than usual. */
  private flow(e: Extract<ChunkEvent, { start: number | null }>, lv: number) {
    if (e.segment !== 'flow' || !hasPowerUp(lv, 'flowChain')) return;
    const quick = e.type === 'smooth' && e.start !== null && e.medianStart !== null && e.start <= e.medianStart;
    if (!quick) {
      this.chain = 0;
      return;
    }
    this.chain++;
    if (this.chain >= GAME_CONFIG.flowChain.words) {
      this.chain = 0;
      this.counts.flowChain++;
      this.award('flowChain', GAME_CONFIG.flowChain.xp, 1);
    }
  }

  private award(kind: 'smooth' | 'slowClean' | 'quick' | 'fixed' | 'mastered' | 'flowChain', base: number, mult: number) {
    if (base <= 0) return;
    const before = this.level;
    this.xp[kind] += base;
    this.xp.comboBonus += base * (mult - 1);
    this.pending.xp += base * mult;
    const after = this.level;
    if (after > before) {
      for (let l = before + 1; l <= after; l++) this.pending.bubbles.push({ kind: 'level', level: l, unlocks: unlocksBetween(l - 1, l) });
    }
  }
}
