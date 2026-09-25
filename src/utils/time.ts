// Hilfsfunktionen, um Zeiträume (Tag/Woche/Monat/Jahr) in einer bestimmten
// IANA-Zeitzone (z. B. der HA-Konfiguration) zu berechnen – unabhängig von
// der Zeitzone des Browsers.

export interface DateRange {
  start: Date;
  end: Date;
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

function getZonedDateParts(date: Date, timeZone: string): { year: number; month: number; day: number } {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = dtf.formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return { year: Number(parts.year), month: Number(parts.month) - 1, day: Number(parts.day) };
}

/**
 * Wandelt eine "Wanduhrzeit" (Jahr/Monat/Tag/Stunde/…) in der angegebenen
 * Zeitzone in den entsprechenden UTC-Zeitpunkt um. `Date.UTC` normalisiert
 * dabei automatisch Überläufe (z. B. Tag 0 oder Monat 12), das nutzen wir für
 * die Bereichs- und Navigationsberechnungen unten aus.
 */
function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const naiveUtcMs = Date.UTC(year, month, day, hour, minute, second);
  const offsetMs = getTimeZoneOffsetMs(new Date(naiveUtcMs), timeZone);
  return new Date(naiveUtcMs - offsetMs);
}

export function getZonedDayBounds(date: Date, timeZone: string): DateRange {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  const start = zonedWallTimeToUtc(year, month, day, 0, 0, 0, timeZone);
  const end = zonedWallTimeToUtc(year, month, day + 1, 0, 0, 0, timeZone);
  return { start, end };
}

/** Woche von Montag bis Sonntag (deutsche Konvention). */
export function getZonedWeekBounds(date: Date, timeZone: string): DateRange {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  const refUtc = new Date(Date.UTC(year, month, day));
  const jsWeekday = refUtc.getUTCDay(); // 0 = Sonntag ... 6 = Samstag
  const isoWeekday = jsWeekday === 0 ? 7 : jsWeekday; // 1 = Montag ... 7 = Sonntag
  const mondayOffset = isoWeekday - 1;

  const start = zonedWallTimeToUtc(year, month, day - mondayOffset, 0, 0, 0, timeZone);
  const end = zonedWallTimeToUtc(year, month, day - mondayOffset + 7, 0, 0, 0, timeZone);
  return { start, end };
}

export function getZonedMonthBounds(date: Date, timeZone: string): DateRange {
  const { year, month } = getZonedDateParts(date, timeZone);
  const start = zonedWallTimeToUtc(year, month, 1, 0, 0, 0, timeZone);
  const end = zonedWallTimeToUtc(year, month + 1, 1, 0, 0, 0, timeZone);
  return { start, end };
}

export function getZonedYearBounds(date: Date, timeZone: string): DateRange {
  const { year } = getZonedDateParts(date, timeZone);
  const start = zonedWallTimeToUtc(year, 0, 1, 0, 0, 0, timeZone);
  const end = zonedWallTimeToUtc(year + 1, 0, 1, 0, 0, 0, timeZone);
  return { start, end };
}

/**
 * Verschiebt ein Referenzdatum um `amount` Einheiten (Tag/Monat/Jahr) in der
 * angegebenen Zeitzone. Die Uhrzeit wird bewusst auf 12:00 Mittag gesetzt,
 * damit Zeitzonen-Wechsel (Sommer-/Winterzeit) nicht versehentlich auf den
 * falschen Kalendertag springen lassen.
 */
export function shiftZonedDate(
  date: Date,
  unit: 'day' | 'month' | 'year',
  amount: number,
  timeZone: string,
): Date {
  const { year, month, day } = getZonedDateParts(date, timeZone);

  switch (unit) {
    case 'day':
      return zonedWallTimeToUtc(year, month, day + amount, 12, 0, 0, timeZone);
    case 'month':
      return zonedWallTimeToUtc(year, month + amount, day, 12, 0, 0, timeZone);
    case 'year':
      return zonedWallTimeToUtc(year + amount, month, day, 12, 0, 0, timeZone);
  }
}
