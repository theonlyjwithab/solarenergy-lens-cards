import { html, svg, type TemplateResult } from 'lit';
import type { StatBar } from '../data/statistics';

export const DEFAULT_CHART_HEIGHT = 150;

export interface BarChartOptions {
  height?: number;
  barColor?: string;
  locale?: string;
  /** Eine Beschriftung pro Balken für die x-Achse; leerer String blendet sie an der Stelle aus. */
  labels?: string[];
  /** Volle Beschreibung pro Balken für den Tooltip, z. B. "12:00 – 13:00". */
  tooltipLabels?: string[];
  /** Prognosewert (kWh) je Balken, `null` wenn für diese Stunde keine Prognose vorliegt. */
  forecast?: Array<number | null>;
  /** Index des gerade gehoverten/angetippten Balkens, für den Tooltip. */
  hoveredIndex?: number | null;
  onHover?: (index: number | null) => void;
  /** Strompreis in €/kWh; wenn gesetzt, zeigt der Tooltip zusätzlich die Kosten des Balkens. */
  pricePerKwh?: number;
}

/** Rundet den Achsen-Schrittwert auf "schöne" Werte (1/2/5 × Zehnerpotenz). */
export function computeNiceStep(maxValue: number, targetTicks: number): number {
  const roughStep = maxValue / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const residual = roughStep / magnitude;
  let niceResidual: number;
  if (residual > 5) {
    niceResidual = 10;
  } else if (residual > 2) {
    niceResidual = 5;
  } else if (residual > 1) {
    niceResidual = 2;
  } else {
    niceResidual = 1;
  }
  return niceResidual * magnitude;
}

function buildForecastPath(forecast: Array<number | null>, axisMax: number, barCount: number): string {
  let path = '';
  let penDown = false;

  forecast.forEach((value, index) => {
    if (value === null) {
      penDown = false;
      return;
    }
    const x = ((index + 0.5) / barCount) * 100;
    const y = 100 - (value / axisMax) * 100;
    path += `${penDown ? 'L' : 'M'} ${x} ${y} `;
    penDown = true;
  });

  return path.trim();
}

/**
 * Rendert Balken + Achsen als reines HTML/CSS (Flexbox) statt SVG. Grund:
 * Text in SVG würde durch das nicht-uniforme Strecken des Diagramms auf die
 * volle Kartenbreite verzerrt dargestellt. Die Balken selbst sind einfache
 * Rechtecke – dafür reicht Flexbox mit prozentualer Höhe völlig aus. Die
 * Prognoselinie ist die Ausnahme: Sie ist nur eine Linie (kein Text), daher
 * verzerrt sie beim Strecken nicht und wird als SVG-Overlay gezeichnet.
 */
export function renderChart(bars: StatBar[], options: BarChartOptions = {}): TemplateResult {
  const height = options.height ?? DEFAULT_CHART_HEIGHT;
  const barColor = options.barColor ?? 'var(--primary-color)';
  const locale = options.locale ?? 'de';
  const labels = options.labels ?? bars.map(() => '');
  const tooltipLabels = options.tooltipLabels ?? bars.map(() => '');
  const forecast = options.forecast;
  const hoveredIndex = options.hoveredIndex ?? null;
  const onHover = options.onHover;
  const pricePerKwh = options.pricePerKwh;
  const costFormat = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });

  const maxActual = Math.max(...bars.map((bar) => bar.value), 0.001);
  const maxForecast = forecast ? Math.max(...forecast.filter((v): v is number => v !== null), 0) : 0;
  const maxValue = Math.max(maxActual, maxForecast, 0.001);

  const step = computeNiceStep(maxValue, 4);
  const axisMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const tickCount = Math.round(axisMax / step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * step);
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const hoveredForecast = hoveredIndex !== null ? (forecast?.[hoveredIndex] ?? null) : null;

  return html`
    <div class="chart-row">
      <div class="y-axis-col" style="height: ${height}px;">
        <span class="y-axis-unit">kWh</span>
        <div class="y-axis">
          ${ticks
            .slice()
            .reverse()
            .map((tick) => html`<span>${numberFormat.format(tick)}</span>`)}
        </div>
      </div>
      <div class="plot-area">
        <div class="bars" style="height: ${height}px;">
          <div class="gridlines">
            ${ticks
              .filter((tick) => tick > 0)
              .map((tick) => html`<div class="gridline" style="bottom: ${(tick / axisMax) * 100}%;"></div>`)}
          </div>
          ${bars.map((bar, index) => {
            const pct = bar.value > 0 ? Math.max((bar.value / axisMax) * 100, 2) : 0;
            return html`
              <div
                class="bar-col"
                @pointerenter=${(ev: PointerEvent) => {
                  if (ev.pointerType === 'mouse') onHover?.(index);
                }}
                @pointerleave=${(ev: PointerEvent) => {
                  if (ev.pointerType === 'mouse') onHover?.(null);
                }}
                @pointerup=${(ev: PointerEvent) => {
                  // Touch/Stift haben kein echtes Hover – hier per Tap umschalten.
                  // Auf Mobilgeräten feuert der Browser bei einem Tap sonst zusätzlich
                  // ein simuliertes mouseenter+click, die sich gegenseitig sofort wieder
                  // ausgeschaltet haben (erster Tap zeigte den Tooltip nur kurz auf).
                  if (ev.pointerType !== 'mouse') onHover?.(hoveredIndex === index ? null : index);
                }}
              >
                ${hoveredIndex === index
                  ? html`
                      <div class="tooltip">
                        <div class="tooltip-title">${tooltipLabels[index]}</div>
                        <div class="tooltip-row">
                          <span class="tooltip-dot" style="background: ${barColor};"></span>
                          Erzeugung: ${numberFormat.format(bar.value)} kWh
                        </div>
                        ${hoveredForecast !== null
                          ? html`
                              <div class="tooltip-row">
                                <span class="tooltip-dot forecast"></span>
                                Vorhersage: ${numberFormat.format(hoveredForecast)} kWh
                              </div>
                            `
                          : ''}
                        ${pricePerKwh != null
                          ? html`<div class="tooltip-row">Kosten: ${costFormat.format(bar.value * pricePerKwh)}</div>`
                          : ''}
                      </div>
                    `
                  : ''}
                <div class="bar" style="height: ${pct}%; background: ${barColor};"></div>
              </div>
            `;
          })}
          ${forecast && bars.length > 0
            ? html`
                <svg class="forecast-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                  ${svg`<path
                    d=${buildForecastPath(forecast, axisMax, bars.length)}
                    fill="none"
                    stroke="var(--primary-text-color)"
                    stroke-width="1.5"
                    stroke-dasharray="4 3"
                    vector-effect="non-scaling-stroke"
                  />`}
                </svg>
              `
            : ''}
        </div>
        <div class="x-axis">${labels.map((label) => html`<div class="x-label">${label}</div>`)}</div>
      </div>
    </div>
  `;
}
