import type { Period } from '../types';
import type { StatBar } from '../data/statistics';
import type { DateRange } from './time';

/** Formatiert den aktuell angezeigten Zeitraum für die Kopfzeile, z. B. "September 2026". */
export function formatRangeLabel(period: Period, range: DateRange, locale: string, timeZone: string): string {
  switch (period) {
    case 'day':
      return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(range.start);
    case 'week': {
      const lastDay = new Date(range.end.getTime() - 24 * 60 * 60 * 1000);
      const dayMonth = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', timeZone });
      const year = new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone }).format(lastDay);
      return `${dayMonth.format(range.start)} – ${dayMonth.format(lastDay)} ${year}`;
    }
    case 'month':
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(range.start);
    case 'year':
      return new Intl.DateTimeFormat(locale, { year: 'numeric', timeZone }).format(range.start);
  }
}

/**
 * Liefert eine Beschriftung pro Balken für die x-Achse. Bei vielen Balken
 * (Tag/Monat) wird ausgedünnt, damit sich die Texte nicht überlappen.
 */
export function formatBarLabels(period: Period, bars: StatBar[], locale: string, timeZone: string): string[] {
  if (bars.length === 0) {
    return [];
  }

  switch (period) {
    case 'day': {
      // Nur die zweistellige Stunde ("02"), ohne Minuten oder Wortzusätze.
      // `Intl.DateTimeFormat` formatiert `hour`-only im Deutschen sonst als
      // "2 Uhr" (zu breit für die schmale Balkenspalte). formatToParts()
      // umgeht das, indem wir nur den 'hour'-Teil herausgreifen und den Rest
      // (z. B. "Uhr") ignorieren – unabhängig von Locale-Eigenheiten.
      const hourFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', hourCycle: 'h23', timeZone });
      const step = Math.max(1, Math.ceil(bars.length / 6));
      return bars.map((bar, index) => {
        if (index % step !== 0) {
          return '';
        }
        const hourPart = hourFormat.formatToParts(bar.start).find((part) => part.type === 'hour');
        return hourPart?.value ?? '';
      });
    }
    case 'week': {
      const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone });
      return bars.map((bar) => weekdayFormat.format(bar.start));
    }
    case 'month': {
      const dayFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', timeZone });
      const step = Math.max(1, Math.ceil(bars.length / 6));
      return bars.map((bar, index) => (index % step === 0 ? dayFormat.format(bar.start) : ''));
    }
    case 'year': {
      const monthFormat = new Intl.DateTimeFormat(locale, { month: 'short', timeZone });
      return bars.map((bar) => monthFormat.format(bar.start));
    }
  }
}

/** Volle Beschreibung eines einzelnen Balkens für den Tooltip, z. B. "12:00 – 13:00". */
export function formatBarTooltipLabel(period: Period, bar: StatBar, locale: string, timeZone: string): string {
  switch (period) {
    case 'day': {
      const hourFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone });
      return `${hourFormat.format(bar.start)} – ${hourFormat.format(bar.end)}`;
    }
    case 'week':
    case 'month':
      return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone }).format(bar.start);
    case 'year':
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone }).format(bar.start);
  }
}
