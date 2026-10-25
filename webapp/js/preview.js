// "Preview on device": where in the day the fast-forwarded playback is.
import { timeLabel } from './schedule.js';

export const DAY = 1440;
export const SPEEDS = [1, 2, 5]; // minutes of real time for one whole day

// Minute of the day after elapsedMs of playback at "one day in dayMinutes".
export function advance(minute, elapsedMs, dayMinutes) {
  return (((minute + (elapsedMs / (dayMinutes * 60000)) * DAY) % DAY) + DAY) % DAY;
}

export function clockAt(minute) {
  const m = Math.floor(minute) % DAY;
  return timeLabel(Math.floor(m / 60), m % 60);
}
