// Every tunable number in the training engine lives here, so play testing can change
// thresholds without touching engine logic. Values are the M0 spec's starting values.

export const CONFIG = {
  // --- fast / slow, always compared with the learner's own numbers ---
  /** A chunk is slow when start time or ms per key is above this many times the personal median. */
  slowFactor: 1.5,
  /** The personal baseline is the median of this many recent clean chunks. */
  baselineWindow: 200,
  /** Until the baseline has this many clean chunks, nothing is judged slow. */
  baselineMinChunks: 20,
  /** A single pause longer than this is "away" and never enters any statistic. */
  awayMs: 10_000,

  // --- repair bay ---
  repairCleanNeeded: 3,
  repairMaxTries: 6,

  // --- revisits inside a round (counted in chunks between) ---
  /** A fixed chunk comes back after this many other chunks, then again after this many. */
  revisitAfterFix: [4, 12] as const,
  /** A chunk that was not fixed in 6 tries comes back after this many other chunks. */
  revisitAfterGiveUp: 2,

  // --- mastery ---
  /** Smooth in this many different rounds, with no miss in between. */
  masteryRounds: 2,
  /**
   * A smooth result this many chunks (or fewer) after a fix does not count toward mastery.
   * With revisitAfterFix[0] = 4 this skips the first revisit, which is the "right after
   * fixing it" attempt the spec excludes.
   */
  masteryIgnoreAfterFix: 4,

  // --- letters and key hints ---
  /** Each letter keeps its most recent pauses. */
  letterWindow: 10,
  /** A letter needs this many pauses before it can be judged hunting or known. */
  letterMinSamples: 5,
  /** The per-key baseline needs this many samples before letters are judged. */
  perKeyBaselineMinSamples: 5,
  /** Hunting: median pause above huntFactor x personal ms per key, and above huntFloorMs. */
  huntFactor: 2,
  huntFloorMs: 600,
  /** Known: median pause below knownFactor x personal ms per key, for knownRoundsNeeded rounds. */
  knownFactor: 1.2,
  knownRoundsNeeded: 2,
  /** How long before the next key lights up on the on-screen keyboard. */
  hintDelayMs: { hunt: 0, learning: 1000, known: 3000 },
  /** The keyboard fades and shrinks when at least this share of letters is known. */
  keyboardQuietKnownShare: 0.75,

  // --- today's round ---
  roundMinutesOptions: [5, 7, 10] as const,
  defaultRoundMinutes: 7,
  keysMsPerLetter: 20_000,
  keysMaxMs: 120_000,
  /** Share of the non-Keys time that goes to Chunks; Flow gets the rest. */
  chunksShare: 2 / 3,
  /** In the Chunks segment, the chance that the next chunk comes from the words track. */
  wordTrackShare: 0.5,
  /** Pause between segments while the next segment's name shows. */
  segmentBreakMs: 1000,

  // --- picking chunks ---
  batchSize: 10,
  /** The next batch of a track unlocks when this share of the current batch is mastered. */
  unlockMasteredShare: 0.8,
  weightWeak: 2,
  weightHunt: 2,
  weightMastered: 0.5,
  /** In the first chunks of each round, this share comes from the weak-chunk list. */
  crossRoundWeakShare: 0.3,
  crossRoundOpeningChunks: 30,
  /** Per-chunk history kept in storage. */
  itemHistory: 10,

  // --- flow ---
  /** With fewer eligible phrases or sentences than this, Flow builds short runs of known words. */
  flowMinItems: 3,
  /** With fewer practiced words than this, the Flow time goes to Chunks instead. */
  flowMinPracticedWords: 4,

  // --- feedback timing (ms) ---
  fixedToastMs: 800,
  giveUpToastMs: 1200,

  // --- read ahead ---
  /** Chunks after the current one that the strip can show. */
  aheadChunks: 8,
  /** In the Keys warm-up only a few, since its letter groups change with time in the segment. */
  aheadChunksKeys: 3,
  /** No-stop start (⚡): the next chunk's first key comes within this many times the personal ms per key. */
  handoffFactor: 1.5,
  /** Recent ⚡ judgments kept per kind (chunks and words, flow). */
  handoffWindow: 100,
  /** Fewer judgments than this and the next-chunk cue stays strong. */
  handoffMinJudged: 30,
  /** ⚡ rate at which the next-chunk cue turns soft, and at which it turns off. */
  cueSoftAt: 0.5,
  cueOffAt: 0.7,

  // --- set challenge (M2b) ---
  /** A set challenge mixes one set's 10 items for this long. */
  challengeMs: 45_000,

  // --- test ---
  testDurations: [1, 3] as const,
  testNudgeDays: 3,
  testTopMissedKeys: 3,
  /** The accuracy reference line on the progress chart. Our starting goal, not an industry standard. */
  testAccuracyTarget: 95,
  /** Rolling average window on the progress chart. */
  chartAverageWindow: 3,
} as const;

export type Config = typeof CONFIG;
