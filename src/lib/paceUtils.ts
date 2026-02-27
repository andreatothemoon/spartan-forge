/** Convert seconds per km to "M:SS" display string */
export function secPerKmToDisplay(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Convert "M:SS" string to seconds per km */
export function displayToSecPerKm(display: string): number {
  const parts = display.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0]) * 60 + parseInt(parts[1]);
}

/** Convert seconds to human-readable duration */
export function secondsToDisplay(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const mins = Math.floor(sec / 60);
  const remainder = sec % 60;
  if (remainder === 0) return `${mins}min`;
  return `${mins}min ${remainder}s`;
}

/** Convert meters to display */
export function metersToDisplay(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

/** Default 5-zone pace zones based on threshold pace */
export function defaultPaceZones(thresholdSec: number) {
  return [
    { zone: 1, name: 'Recovery', low: Math.round(thresholdSec * 1.25), high: Math.round(thresholdSec * 1.4) },
    { zone: 2, name: 'Easy', low: Math.round(thresholdSec * 1.1), high: Math.round(thresholdSec * 1.25) },
    { zone: 3, name: 'Tempo', low: Math.round(thresholdSec * 0.98), high: Math.round(thresholdSec * 1.1) },
    { zone: 4, name: 'Threshold', low: Math.round(thresholdSec * 0.92), high: Math.round(thresholdSec * 0.98) },
    { zone: 5, name: 'VO2max', low: Math.round(thresholdSec * 0.82), high: Math.round(thresholdSec * 0.92) },
  ];
}

/** Default 5-zone HR zones based on threshold HR */
export function defaultHrZones(thresholdHr: number) {
  return [
    { zone: 1, name: 'Recovery', low: Math.round(thresholdHr * 0.65), high: Math.round(thresholdHr * 0.75) },
    { zone: 2, name: 'Easy', low: Math.round(thresholdHr * 0.75), high: Math.round(thresholdHr * 0.85) },
    { zone: 3, name: 'Tempo', low: Math.round(thresholdHr * 0.85), high: Math.round(thresholdHr * 0.92) },
    { zone: 4, name: 'Threshold', low: Math.round(thresholdHr * 0.92), high: Math.round(thresholdHr * 1.0) },
    { zone: 5, name: 'VO2max', low: thresholdHr, high: Math.round(thresholdHr * 1.08) },
  ];
}

/** Days of the week */
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const DAY_LABELS: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export const SESSION_TYPES = ['easy', 'interval', 'tempo', 'long', 'recovery', 'race_sim', 'strength'] as const;
export const SESSION_TYPE_LABELS: Record<string, string> = {
  easy: 'Easy Run', interval: 'Intervals', tempo: 'Tempo', long: 'Long Run',
  recovery: 'Recovery', race_sim: 'Race Sim', strength: 'Strength',
};

export const STEP_TYPES = ['warmup', 'work', 'recover', 'cooldown'] as const;
