/** Round length override for testing: ?minutes=0.25 */
export function roundMinutesOverride(): number | null {
  const v = new URLSearchParams(window.location.search).get('minutes');
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** End-to-end tests skip the first-run cards unless they test them: ?basics=skip */
export function skipBasics(): boolean {
  return new URLSearchParams(window.location.search).get('basics') === 'skip';
}
