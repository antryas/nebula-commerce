import { Pipe, PipeTransform } from '@angular/core';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

/**
 * Human-friendly age of a timestamp: `just now`, `5 min ago`, `3 h ago`, `2 d ago`,
 * or `Aug 3` once it is a week old. Pure: pass `now` to re-evaluate or for tests.
 */
@Pipe({ name: 'relativeTime' })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | Date | null | undefined, now: Date = new Date()): string {
    if (value == null) return '';
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    if (Number.isNaN(time)) return '';

    const diff = now.getTime() - time;
    if (diff < MINUTE) return 'just now';
    if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
    if (diff < DAY) return `${Math.floor(diff / HOUR)} h ago`;
    if (diff < WEEK) return `${Math.floor(diff / DAY)} d ago`;
    return SHORT_DATE.format(date);
  }
}
