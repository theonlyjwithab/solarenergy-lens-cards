import type { Period } from '../types';
import type { RecorderPeriod } from '../data/statistics';
import {
  getZonedDayBounds,
  getZonedWeekBounds,
  getZonedMonthBounds,
  getZonedYearBounds,
  shiftZonedDate,
  type DateRange,
} from './time';

/** Für jede Ansicht: welche Bucket-Größe der Recorder liefern soll. */
export const RECORDER_PERIOD: Record<Period, RecorderPeriod> = {
  day: 'hour',
  week: 'day',
  month: 'day',
  year: 'month',
};

const RANGE_BOUNDS: Record<Period, (date: Date, timeZone: string) => DateRange> = {
  day: getZonedDayBounds,
  week: getZonedWeekBounds,
  month: getZonedMonthBounds,
  year: getZonedYearBounds,
};

export function getRangeForPeriod(period: Period, referenceDate: Date, timeZone: string): DateRange {
  return RANGE_BOUNDS[period](referenceDate, timeZone);
}

/** Verschiebt das Referenzdatum um einen Zeitraum nach vorn (+1) oder zurück (-1). */
export function shiftReferenceDate(
  referenceDate: Date,
  period: Period,
  direction: -1 | 1,
  timeZone: string,
): Date {
  if (period === 'week') {
    return shiftZonedDate(referenceDate, 'day', 7 * direction, timeZone);
  }
  return shiftZonedDate(referenceDate, period, direction, timeZone);
}
