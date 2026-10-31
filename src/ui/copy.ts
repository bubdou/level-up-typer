// All English UI text in one place, from the M0 spec's copy table.
// Change words here, not in components.

import type { Unlock } from '../game';

export const COPY = {
  appName: 'Level Up Typer',
  nav: { progress: 'Progress', settings: 'Settings', home: 'Home', collection: 'Collection', powerUps: 'Power-ups' },

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

  segments: { keys: 'Keys', chunks: 'Chunks', flow: 'Flow', set: 'Challenge' } as Record<string, string>,

  practice: {
    keysTitle: 'Keys: find these keys',
    keysTip: 'Eyes up. Use the keyboard on screen.',
    readIt: 'Read it, then type it in one go.',
    fingers: 'Pointer fingers on the bumps of F and J.',
    repairTitle: 'Again! 3 clean in a row',
    // Why this chunk is back, so a fixed-up key does not feel like being sent back for nothing.
    repairWhy: 'There was a wrong key.',
    tryOf: (n: number, max: number) => `Try ${n} of ${max}`,
    fixed: 'Fixed!',
    giveUp: "We'll try this one again soon.",
    backFromRepair: 'Back to the line. Type the underlined one.',
    paused: 'Paused. Press Space to go on.',
    pausedStop: 'Press Esc again to stop.',
    escHint: 'Esc: pause',
    quitTitle: 'Stop and go home. What you did so far is saved.',
    keyboardNote: 'Colors show which finger. Bumps on F and J.',
    hideKeyboard: 'Hide keyboard',
    showKeyboard: 'Show keyboard',
    hints: (mode: string) => `Hints: ${mode}`,
    noStop: 'no stop',
    // eyes up: the on-screen keyboard steps away
    fingers5: {
      l5: 'Left pinky',
      l4: 'Left ring finger',
      l3: 'Left middle finger',
      l2: 'Left index finger',
      r2: 'Right index finger',
      r3: 'Right middle finger',
      r4: 'Right ring finger',
      r5: 'Right pinky',
    } as Record<string, string>,
    onHome: "It's on its home key.",
    thumb: 'Thumb on the space bar.',
    pressedDir: (k: string, t: string, dir: string) => `You pressed ${k}. ${t} is ${dir}.`,
    pressedFind: (k: string, t: string) => `You pressed ${k}. Find ${t}.`,
    pressedNowSpace: (k: string) => `You pressed ${k}. Now press space.`,
    pressedSpace: (t: string) => `You pressed space. Find ${t}.`,
    tucked: 'Keyboard tucked away. It pops up if you get stuck.',
    // catch the star (Keys warm-up)
    starEnter: 'Enter',
    starCaught: '★ +5',
    starsFlew: 'Two stars flew away. Keep your eyes on the screen.',
  },

  basics: {
    cards: [
      { title: 'Sit like this', text: 'Sit up tall. Feet flat on the floor. The screen is in front of your eyes. Shoulders relaxed.' },
      {
        title: 'Fingers home',
        text: 'Find the small bumps on F and J. Put your pointer fingers there. Rest the other fingers on A S D and K L ;. Thumbs rest on the space bar.',
      },
      {
        title: 'Eyes up',
        text: "Keep your eyes on the screen. Can't find a key? Look at the keyboard on the screen, not at your hands. Lost? Feel for the bumps on F and J. It's OK to be slow at first.",
      },
    ],
    step: (n: number, of: number) => `${n} of ${of}`,
    next: 'Next',
    start: 'Start',
    orEnter: 'or press Enter',
    link: 'How to sit and place your fingers',
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
    handoffs: (n: number, m: number) => `⚡ No-stop starts: ${n} of ${m}`,
    stars: (n: number, m: number) => `★ Stars caught: ${n} of ${m}`,
    starsOff: 'Your eyes stay on the screen. Stars are off now.',
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
    cols: ['Date', 'Round', 'Minutes', 'Start time', 'Per key', 'Clean', 'XP', 'Keys to find'],
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
    look: 'Look',
    paceLine: 'Usual-pace line in tests',
    lookLocked: (name: string, level: number) => `${name} (level ${level})`,
    sounds: 'Sounds',
    animations: 'Animations',
    weekGoal: 'Week goal',
    weekGoalDays: (n: number) => `${n} days a week`,
    motionNote: 'Animations are always off when your computer is set to reduce motion.',
    aboutTitle: 'About',
    about: [
      'Letter pairs: ranking by Peter Norvig from Google Books Ngram counts.',
      'Short chunks: trigram ranking from 9,481 Project Gutenberg books, plus common word endings.',
      'Common words and More words: the Dolch sight word lists (1936).',
      'Phrases and sentences: written for Level Up Typer.',
    ],
  },

  // M2 game layer, from the M2 spec's copy table (plain look).
  game: {
    level: (n: number) => `Level ${n}`,
    xpOf: (into: number, need: number) => `${fmtNum(into)} / ${fmtNum(need)} XP`,
    nextUnlock: (level: number, name: string) => `Level ${level} unlocks ${name}`,
    week: 'This week',
    weekProgress: (n: number, goal: number, xp: number) => `${n} of ${goal} days. ${goal - n} more for +${xp} XP.`,
    weekDone: (xp: number) => `Week goal done! +${xp} XP`,
    weekStreak: (n: number) => `Week goal: ${n} weeks in a row`,
    dayLetters: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
    dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    collection: 'Collection',
    masteredOf: (n: number, total: number) => `${n} of ${total} mastered`,
    ofTotal: (total: number) => `of ${total} mastered`,
    seeCollection: 'See your collection',
    testsNoXp: "Tests don't give XP.",
    headStart: (perRound: number) => `Head start: +${perRound} XP for each round you played.`,
    // practice
    roundXp: (n: number) => `+${fmtNum(n)} XP`,
    combo: 'Combo',
    comboLocked: 'Combo unlocks at level 2',
    shield: 'Shield',
    sparkOn: 'Spark on',
    pop: (xp: number) => `+${xp}`,
    popMastered: (xp: number) => `+${xp} · mastered`,
    fixedPoints: (xp: number) => `Fixed! +${xp}`,
    levelUp: (n: number, what: string | null) => (what ? `Level ${n}! ${what} unlocked` : `Level ${n}!`),
    comboOn: 'Combo! Points ×2',
    shieldKept: 'Shield kept your Combo',
    // summary
    pointsTitle: 'Points this round',
    rows: {
      smooth: 'Smooth chunks',
      letters: 'Single letters',
      slowClean: 'Clean but slow',
      quick: 'No-stop starts ⚡ (Spark)',
      fixed: 'Fixed',
      fixedLetters: 'Fixed letters',
      mastered: 'Newly mastered',
      flowChain: 'Flow Chain',
      comboBonus: 'Combo bonus',
      keyFinder: 'Keys found',
      weekGoal: 'Week goal',
      stars: 'Stars caught',
    } as Record<string, string>,
    times: (n: number, xp: number) => `${n} × ${xp}`,
    doubled: 'doubled points',
    weekDetail: (days: number) => `${days} days this week`,
    total: 'Total',
    newPowerUp: (level: number) => `Level ${level} · new power-up`,
    newLook: (level: number) => `Level ${level} · new look`,
    newLookText: 'Pick it in Settings. It changes the practice colours.',
    newlyMastered: 'Newly mastered',
    noneMastered: 'None this round. Smooth again in another round to master it.',
    keyFound: (k: string, xp: number) => `Key found: ${k} +${xp}`,
    // collection
    collectionLead: 'Every chunk, word or phrase you master fills a dot.',
    collectionSets: 'Sets of 10 open as you go: master 8 of a set and the next one opens.',
    tracksNote: 'Chunks, words and flow grow side by side, so three groups fill at once.',
    zoneCount: (n: number, total: number) => `${n} of ${total}`,
    legendMastered: 'Mastered',
    legendOpen: 'Practicing',
    legendLocked: 'Not open yet',
    legendAgain: 'Practice again',
    practiceAgain: 'Practice again',
    setTitle: (zone: string, n: number) => `${zone}, set ${n}`,
    setCount: (n: number, size: number) => `${n} of ${size} mastered`,
    setLocked: 'This set opens later.',
    setComplete: 'Set complete. A new set is open.',
    pickSet: 'Pick a set to see what is in it.',
    // set challenge (M2b)
    challengeTitle: (set: string) => `${set} challenge`,
    challengeLead: 'Type this set mixed together for 45 seconds. Same rules: a wrong key still means fix it.',
    challengeButton: 'Challenge this set',
    challengeLocked: (n: number, size: number) => `Master ${n} of ${size} to challenge this set.`,
    medalRules: 'Gold: 95% clean on the first try. Silver: 85%. Bronze: finish it. You can try again any time; your best medal stays.',
    medals: { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as Record<string, string>,
    bestMedal: (m: string) => `Best: ${m}`,
    newBestMedal: 'New best medal!',
    noMedal: 'Stopped early, so no medal this time.',
    challengeSub: (chunks: number, clean: number) => `${chunks} chunks, ${clean}% clean on the first try.`,
    tryAgain: 'Try again',
    backToCollection: 'Done',
    challengeHelp: 'Enter: Done · R: Try again',
    // test pace line (M2b)
    paceKey: 'Your usual pace',
    paceAhead: 'Ahead of your usual pace',
    paceNote: (wpm: number) => `The gold mark moves at ${wpm} wpm, the average of your last 3 tests.`,
    // power-ups
    powerUpsTitle: 'Power-ups',
    powerUpsLead: 'Nothing to click here. Each power-up turns on by itself when you reach its level, and works while you practice. None of them skip a fix.',
    atLevel: (n: number) => `Level ${n}`,
    unlocked: 'Unlocked',
    looksTitle: 'Looks',
    looksNote: 'Looks change the practice colours. The finger colours on the keyboard stay the same.',
    powerUps: {
      combo: { name: 'Combo', what: '10 clean chunks in a row: your points double until a wrong key.', trains: 'Trains: accuracy first' },
      spark: { name: 'Spark', what: '+5 for each ⚡: you start the next chunk with no stop.', trains: 'Trains: reading ahead' },
      keyFinder: { name: 'Key Finder', what: '+50 when a key you looked for becomes easy.', trains: 'Trains: keys without looking' },
      flowChain: { name: 'Flow Chain', what: 'In Flow, 5 in a row with no long stop: +10.', trains: 'Trains: word to word' },
      shield: { name: 'Shield', what: 'Once a round, a wrong key keeps your Combo. You still fix the chunk.', trains: 'Keeps a Combo safe' },
    } as Record<string, { name: string; what: string; trains: string }>,
    looks: { classic: 'Classic', ocean: 'Ocean', forest: 'Forest', night: 'Night' } as Record<string, string>,
    lookName: (name: string) => `${name} look`,
  },

  warn: {
    ime: 'Switch your keyboard to ABC to type here.',
    caps: 'Caps Lock is on.',
  },

  back: 'Back',
  minutes: (n: number) => `${n} min`,
} as const;

export function fmtNum(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

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

/** "Spark", or "Ocean look". */
export const unlockName = (u: Unlock) => (u.kind === 'powerUp' ? COPY.game.powerUps[u.id].name : COPY.game.lookName(COPY.game.looks[u.id]));
