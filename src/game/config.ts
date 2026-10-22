// Every tunable number in the game layer lives here, so play testing can change points and
// levels without touching game logic. Values are the M2 spec's starting values.

export const GAME_CONFIG = {
  // --- XP for each engine event ---
  xp: {
    /** A smooth chunk: clean and not slow. */
    smooth: 10,
    /** Clean but slow. It still goes to the repair bay, but being accurate earns something. */
    slowClean: 5,
    /** A wrong key. Never negative. */
    error: 0,
    /** Leaving the repair bay with 3 clean in a row. Repair tries themselves earn nothing. */
    fixed: 15,
    /** An item mastered: one more dot filled in the Collection. */
    mastered: 20,
    /** Once a week, when the week goal is met. */
    weekGoal: 200,
    /** Head start for each round played before M2. Given once. */
    headStartPerRound: 300,
  },

  // --- levels: going from level n to n + 1 costs levelBase + levelStep * (n - 1) ---
  levelBase: 500,
  levelStep: 250,

  // --- power-ups (level they unlock at, and their numbers) ---
  combo: { level: 2, need: 10, multiplier: 2 },
  spark: { level: 3, xp: 5 },
  keyFinder: { level: 4, xp: 50, repeatDays: 7 },
  flowChain: { level: 5, words: 5, xp: 10 },
  shield: { level: 6, perRound: 1 },

  /** Practice-screen colour looks, unlocked by level. */
  looks: [
    { id: 'classic', level: 1 },
    { id: 'ocean', level: 7 },
    { id: 'forest', level: 9 },
    { id: 'night', level: 11 },
  ],

  // --- week goal ---
  /** A round counts for its day only if this many active minutes were typed. */
  weekRoundMinMinutes: 5,
  weekGoalDaysDefault: 4,
  weekGoalDaysOptions: [3, 4, 5, 7],

  // --- in-round feedback (ms) ---
  /** Small "+10" next to the chunk strip. */
  popMs: 900,
  /** Level-up, Combo and Shield bubbles. The spec caps any bubble at 1.5 s; the screen redraws every 200 ms. */
  bubbleMs: 1300,
} as const;

export type LookId = (typeof GAME_CONFIG.looks)[number]['id'];
