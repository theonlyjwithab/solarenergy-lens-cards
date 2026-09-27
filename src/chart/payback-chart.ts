import { svg, nothing, type SVGTemplateResult } from 'lit';
import type { SavingsPoint } from '../utils/payback';

export const PAYBACK_CHART_VIEW_WIDTH = 312;
export const PAYBACK_CHART_VIEW_HEIGHT = 170;

const PAD_LEFT = 4;
const PAD_RIGHT = 4;
// Etwas Platz oben für die "Investition"-Beschriftung über der gestrichelten
// Linie, unten für die Monats-/Jahres-Achsenbeschriftung.
const PAD_TOP = 22;
const PAD_BOTTOM = 22;
const AXIS_Y = PAYBACK_CHART_VIEW_HEIGHT - PAD_BOTTOM;

// Anteil der Plot-Breite, der dem historischen (echten) Datenabschnitt fest
// zugewiesen wird, sobald eine Prognose gezeichnet wird. Ohne diesen
// Mindestanteil würde eine strikt zeitproportionale Achse die Historie fast
// auf einen Punkt zusammenquetschen, wenn eine junge Anlage (wenige Wochen
// Daten) auf einen mehrjährigen Amortisations-Zeitpunkt hochgerechnet wird –
// "heute" würde dann optisch mit "Kauf" und der "Investition"-Beschriftung
// zusammenfallen. Der Prognose-Abschnitt bekommt dafür keinen eigenen
// zeitproportionalen Maßstab: Es gibt dort ohnehin nur einen Punkt (den
// Break-even), eine gerade Linie von "heute" bis zum rechten Rand reicht.
const HISTORY_FRACTION_WITH_PROJECTION = 0.45;

export interface PaybackChartParams {
  /** Kumulierte Ersparnis-Kurve, ein Punkt pro Monats-Bucket seit `install_date`. */
  points: SavingsPoint[];
  investmentEuro: number;
  /** Prognostizierter Break-even-Zeitpunkt, falls noch nicht erreicht und eine Monatsrate > 0 vorliegt. */
  projection?: { date: Date; euro: number };
  /** Zeitpunkt, an dem die Investition laut den historischen Daten bereits erreicht wurde. */
  paidOffAt?: Date;
  investmentLabel: string;
  formatMonthYear: (date: Date) => string;
}

/**
 * Liefert nur den SVG-*Inhalt* (Lits `svg`-Tag ist ausschließlich für Inhalte
 * innerhalb eines bereits im `html`-Template stehenden `<svg>` gedacht, siehe
 * CLAUDE.md-Bugfix-Notiz zur ersten Karte) – das `<svg>`-Element selbst steht
 * im Template der Karte.
 */
export function renderPaybackChart(params: PaybackChartParams): SVGTemplateResult | typeof nothing {
  const { points, investmentEuro, projection, paidOffAt, investmentLabel, formatMonthYear } = params;
  if (points.length < 2) {
    return nothing;
  }

  const firstDate = points[0].date;
  const lastPoint = points[points.length - 1];

  const maxValue = Math.max(investmentEuro, lastPoint.cumulativeSavedEuro, projection?.euro ?? 0, 1) * 1.05;
  const historySpanMs = Math.max(lastPoint.date.getTime() - firstDate.getTime(), 1);

  const plotWidth = PAYBACK_CHART_VIEW_WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = AXIS_Y - PAD_TOP;
  // Der historische Abschnitt bekommt bei vorhandener Prognose nur einen festen
  // Breitenanteil (siehe Kommentar zu HISTORY_FRACTION_WITH_PROJECTION), sonst
  // die volle Breite – die Prognose selbst braucht keinen eigenen Maßstab, sie
  // ist immer nur eine gerade Linie von "heute" bis zum rechten Rand.
  const historyWidth = plotWidth * (projection ? HISTORY_FRACTION_WITH_PROJECTION : 1);
  const scaleX = (date: Date): number => PAD_LEFT + ((date.getTime() - firstDate.getTime()) / historySpanMs) * historyWidth;
  const scaleY = (value: number): number => AXIS_Y - (Math.max(value, 0) / maxValue) * plotHeight;

  const linePoints = points.map((point) => `${scaleX(point.date).toFixed(1)},${scaleY(point.cumulativeSavedEuro).toFixed(1)}`).join(' ');
  const investmentY = scaleY(investmentEuro);
  const todayX = scaleX(lastPoint.date);
  const todayY = scaleY(lastPoint.cumulativeSavedEuro);
  const projectionX = PAYBACK_CHART_VIEW_WIDTH - PAD_RIGHT;

  return svg`
    <line x1="${PAD_LEFT}" y1="${AXIS_Y}" x2="${PAYBACK_CHART_VIEW_WIDTH - PAD_RIGHT}" y2="${AXIS_Y}" class="ppc-axis"></line>
    <line
      x1="${PAD_LEFT}" y1="${investmentY}"
      x2="${PAYBACK_CHART_VIEW_WIDTH - PAD_RIGHT}" y2="${investmentY}"
      class="ppc-investment-line"
    ></line>
    <text x="${PAD_LEFT}" y="${investmentY - 6}" class="ppc-investment-label">${investmentLabel}</text>

    <line x1="${todayX}" y1="${PAD_TOP - 8}" x2="${todayX}" y2="${AXIS_Y}" class="ppc-today-line"></line>

    <polyline points="${linePoints}" class="ppc-line-actual"></polyline>

    ${projection
      ? svg`
          <line
            x1="${todayX}" y1="${todayY}"
            x2="${projectionX}" y2="${scaleY(projection.euro)}"
            class="ppc-line-projected"
          ></line>
          <circle cx="${projectionX}" cy="${scaleY(projection.euro)}" r="4" class="ppc-dot-projected"></circle>
        `
      : nothing}
    ${paidOffAt
      ? svg`<circle cx="${scaleX(paidOffAt)}" cy="${investmentY}" r="4" class="ppc-dot-paid-off"></circle>`
      : nothing}

    <text x="${PAD_LEFT}" y="${PAYBACK_CHART_VIEW_HEIGHT - 4}" class="ppc-axis-label">${formatMonthYear(firstDate)}</text>
    <text x="${todayX}" y="${PAYBACK_CHART_VIEW_HEIGHT - 4}" text-anchor="middle" class="ppc-axis-label">
      ${formatMonthYear(lastPoint.date)}
    </text>
    ${projection
      ? svg`
          <text
            x="${projectionX}" y="${PAYBACK_CHART_VIEW_HEIGHT - 4}"
            text-anchor="end" class="ppc-axis-label ppc-axis-label-highlight"
          >
            ${formatMonthYear(projection.date)}
          </text>
        `
      : nothing}
  `;
}
