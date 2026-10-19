// All English UI text in one place, from the M0 spec's copy table.
// Change words here, not in components.

export const COPY = {
  appName: 'Level Up Typer',
  nav: { progress: 'Progress', settings: 'Settings', home: 'Home' },

  home: {
    title: 'Ready to practice?',
    lead: 'Read it, then type it in one go.',
    roundLabel: "Today's round",
    start: 'Start',
    orEnter: 'or press Enter',
    choose: 'Choose what to practice',
    backToToday: "Back to today's round",
    youChose: 'You chose this.',
    keysBecause: (letters: string[]) => `Keys first, because you still look for ${letters.join(', ')}.`,
    noKeys: 'No keys to find today.',
    total: (min: string) => `${min} in all.`,
    plan: (parts: string[]) => `Today: ${parts.join(' · ')}`,
    today: (min: number, fixed: number) => `Today: ${Math.round(min)} min, ${fixed} fixed`,
    testLabel: 'Take a test',
    testIntro: 'See your speed and accuracy, and watch the curve go up.',
    testNudge: 'Time for a test?',
    lastTest: (wpm: number, acc: number) => `Last test: ${wpm} wpm, ${acc}%.`,
    testKeys: 'Press T for 1 min, or 3 for 3 min',
    keysToFind: 'Keys to find',
  },

  stages: {
    pairs: 'Letter pairs',
    short: 'Short chunks',
    common: 'Common words',
    more: 'More words',
    phrases: 'Phrases',
    sentences: 'Sentences',
  } as Record<string, string>,

  segments: { keys: 'Keys', chunks: 'Chunks', flow: 'Flow' } as Record<string, string>,

  practice: {
    keysTitle: 'Keys: find these keys',
    keysTip: 'Eyes up. Use the keyboard on screen.',
    readIt: 'Read it, then type it in one go.',
    fingers: 'Pointer fingers on the bumps of F and J.',
    repairTitle: 'Again! 3 clean in a row',
    tryOf: (n: number, max: number) => `Try ${n} of ${max}`,
    fixed: 'Fixed!',
    giveUp: "We'll try this one again soon.",
    paused: 'Paused. Press Space to go on.',
    pausedStop: 'Press Esc again to stop.',
    keyboardNote: 'Colors show which finger. Bumps on F and J.',
    hideKeyboard: 'Hide keyboard',
    showKeyboard: 'Show keyboard',
    hints: (mode: string) => `Hints: ${mode}`,
  },

  summary: {
    title: 'Nice work!',
    sub: (chunks: number, min: number) => `${chunks} chunks in ${min.toFixed(1)} min.`,
    startTime: 'Start time',
    was: (s: string) => `was ${s}`,
    clean: 'Clean chunks',
    fixedCount: 'Fixed',
    youFixed: 'You fixed',
    nothingFixed: 'Nothing needed fixing.',
    keysLookedFor: 'Keys you looked for',
    noKeys: 'None. Great!',
    done: 'Done',
    oneMore: 'One more round',
    keysHelp: 'Enter: Done · R: One more round',
  },

  test: {
    title: (min: number) => `Test · ${min} min`,
    clockStarts: 'The clock starts when you type.',
    rules: 'No key hints in a test. A wrong key stops you until you press the right one.',
    stopped: 'Test stopped. Try again?',
    tryAgain: 'Try again',
    resultTitle: (min: number) => `${min} min test`,
    newBest: 'New best!',
    wpm: 'wpm',
    accuracy: 'accuracy',
    lastTime: (wpm: number) => `Last time: ${wpm} wpm`,
    missedMost: 'Keys you missed most',
    missedNote: 'These keys go into your next Keys practice.',
    noMissed: 'None. Great!',
    done: 'Done',
    seeProgress: 'See all progress',
    keysHelp: 'Enter: Done · P: See all progress',
    stoppedHelp: 'Enter: Try again · Esc: Home',
  },

  chart: {
    up: (n: number) => `Up ${n} wpm since you started`,
    best: (n: number) => `Some days are slower. Your best is ${n} wpm.`,
    oneMore: (min: number) => `Take one more ${min} min test to see your curve.`,
    none: (min: number) => `Take two ${min} min tests to see your curve.`,
    legend: 'Dots are single tests. The thick line is the average of the last 3.',
    best_label: (n: number) => `best ${n}`,
    accuracy: 'Accuracy',
    min1: '1 min',
    min3: '3 min',
  },

  progress: {
    title: 'Progress',
    tests: 'Tests',
    rounds: 'Practice rounds',
    noRounds: 'Your rounds show here after you play.',
    cols: ['Date', 'Round', 'Minutes', 'Start time', 'Per key', 'Clean'],
    keysToFind: 'Keys to find',
    keysToFindNote: 'Letters with long pauses before them.',
    slowChunks: 'Slow chunks',
    slowChunksNote: 'Clean, but a long wait before or inside.',
    none: 'None',
  },

  settings: {
    title: 'Settings',
    roundLength: 'Round length',
    keyHints: 'Key hints',
    hintModes: { auto: 'Auto', always: 'Always', off: 'Off' } as Record<string, string>,
    reset: 'Reset progress',
    resetConfirm: 'Press again to reset',
    resetDone: 'Progress cleared.',
    storageNote: 'Progress is saved in this browser.',
    aboutTitle: 'About',
    about: [
      'Letter pairs: ranking by Peter Norvig from Google Books Ngram counts.',
      'Short chunks: trigram ranking from 9,481 Project Gutenberg books, plus common word endings.',
      'Common words and More words: the Dolch sight word lists (1936).',
      'Phrases and sentences: written for Level Up Typer.',
    ],
  },

  warn: {
    ime: 'Switch your keyboard to ABC to type here.',
    caps: 'Caps Lock is on.',
  },

  back: 'Back',
  minutes: (n: number) => `${n} min`,
} as const;

export function fmtDuration(ms: number): string {
  return ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`;
}

export function fmtSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

export function fmtClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
