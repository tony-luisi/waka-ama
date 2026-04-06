import type { TideData, TideTime } from './types';

/**
 * Tide column labels: Incoming / Outgoing for movement; High / Low when slack (near an extremum).
 */
export function tideMovementLabel(tide: TideData, extremities?: TideTime[]): string {
  if (tide.direction === 'incoming') {
    return 'Incoming';
  }
  if (tide.direction === 'outgoing') {
    return 'Outgoing';
  }
  if (extremities?.length) {
    const t = tide.timestamp.getTime();
    let nearest: TideTime | undefined;
    let best = Infinity;
    for (const e of extremities) {
      const d = Math.abs(e.time.getTime() - t);
      if (d < best) {
        best = d;
        nearest = e;
      }
    }
    if (nearest && best <= 50 * 60 * 1000) {
      return nearest.type === 'high' ? 'High' : 'Low';
    }
  }
  return tide.type === 'high' ? 'High' : 'Low';
}
