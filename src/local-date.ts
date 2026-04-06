/**
 * YYYY-MM-DD for the user's local calendar (Pacific/Auckland, etc.).
 * Do not use date.toISOString().split('T')[0] — that is UTC and shifts the day
 * around midnight in NZ, breaking NIWA tide requests and interpolation.
 */
export function formatLocalDateYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
