import { html, css, type TemplateResult } from 'lit';
import type { Period } from '../types';
import { getRangeForPeriod } from '../utils/period';
import { formatRangeLabel } from '../utils/format';

export const ALL_PERIODS: Period[] = ['day', 'week', 'month', 'year'];

const PERIOD_LABELS: Record<Period, string> = {
  day: 'Tag',
  week: 'Woche',
  month: 'Monat',
  year: 'Jahr',
};

export interface PeriodHeaderOptions {
  period: Period;
  referenceDate: Date;
  availablePeriods: Period[];
  timeZone: string;
  locale: string;
  onPrevious: () => void;
  onNext: () => void;
  onNow: () => void;
  onPeriodChange: (period: Period) => void;
}

/**
 * Kopfzeile mit Datum + Navigation (Jetzt/Zurück/Vor) + Zeitraum-Auswahl.
 * Von beiden Karten (Solar, Energiefluss) gemeinsam genutzt – reine
 * Render-Funktion, der Zustand (Periode/Referenzdatum) bleibt bei der
 * jeweiligen Karte.
 */
export function renderPeriodHeader(options: PeriodHeaderOptions): TemplateResult {
  const { period, referenceDate, availablePeriods, timeZone, locale, onPrevious, onNext, onNow, onPeriodChange } =
    options;

  const range = getRangeForPeriod(period, referenceDate, timeZone);
  const nowRange = getRangeForPeriod(period, new Date(), timeZone);
  const isCurrentPeriod = range.start.getTime() === nowRange.start.getTime();
  const label = formatRangeLabel(period, range, locale, timeZone);

  return html`
    <div class="header">
      <div class="nav">
        <button class="icon-button" @click=${onPrevious} aria-label="Zurück">‹</button>
        <button class="text-button" @click=${onNow}>Jetzt</button>
        <button class="icon-button" @click=${onNext} ?disabled=${isCurrentPeriod} aria-label="Vor">›</button>
      </div>
      <div class="date-label">${label}</div>
      <select
        class="period-select"
        .value=${period}
        @change=${(ev: Event) => onPeriodChange((ev.target as HTMLSelectElement).value as Period)}
      >
        ${availablePeriods.map((p) => html`<option value=${p}>${PERIOD_LABELS[p]}</option>`)}
      </select>
    </div>
  `;
}

export const periodHeaderStyles = css`
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px 0;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }
  .nav {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .date-label {
    flex: 1;
    text-align: center;
  }
  .icon-button,
  .text-button {
    background: none;
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    color: var(--primary-text-color);
    cursor: pointer;
    padding: 2px 8px;
    font: inherit;
  }
  .icon-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .period-select {
    background: var(--card-background-color, #1c1c1c);
    border: 1px solid var(--divider-color);
    border-radius: 4px;
    color: var(--primary-text-color);
    font: inherit;
    padding: 2px 4px;
  }
  /* Die Dropdown-Liste eines <select> wird vom Browser nativ gerendert und
     ignoriert sonst unsere Kartenfarben (weißer Hintergrund + heller Text
     aus dem Dark Theme = unlesbar). Chromium erlaubt es, das per Styling
     auf <option> zu korrigieren. */
  .period-select option {
    background: var(--card-background-color, #1c1c1c);
    color: var(--primary-text-color);
  }
`;
