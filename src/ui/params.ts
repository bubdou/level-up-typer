/** Round length override for testing: ?minutes=0.25 */
export function roundMinutesOverride(): number | null {
  const v = new URLSearchParams(window.location.search).get('minutes');
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}
