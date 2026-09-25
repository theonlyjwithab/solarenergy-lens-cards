import { html, svg, type TemplateResult } from 'lit';
import type { StatBar } from '../data/statistics';
import { computeNiceStep } from './bar-chart';

export const DEFAULT_CHART_HEIGHT = 150;
// Als Konstanten statt nur inline in renderBatteryChart(), damit die Kartenkopfzeile
// (Legende vor "Geladen"/"Entladen") exakt dieselben Farben referenzieren kann.
export const DEFAULT_CHARGE_COLOR = 'var(--success-color, #4caf50)';
export const DEFAULT_DISCHARGE_COLOR = 'var(--warning-color, #ff9800)';

export interface BatteryChartOptions {
  height?: number;
  locale?: string;
  chargeColor?: string;
  dischargeColor?: string;
  /** Eine Beschriftung pro Balkenpaar für die x-Achse. */
  labels?: string[];
  /** Volle Beschreibung pro Balkenpaar für den Tooltip. */
  tooltipLabels?: string[];
  /**
   * Ladestand (%) je Bucket, nur in der Tagesansicht befüllt. `null` bedeutet
   * "kein Messwert für dieses Zeitfenster" (z. B. noch nicht vergangene Stunde)
   * und reißt die Linie an der Stelle ab, statt fälschlich 0 % zu zeigen.
   */
  soc?: Array<number | null>;
  hoveredIndex?: number | null;
  onHover?: (index: number | null) => void;
}

/** Baut den SVG-Pfad der Ladestand-Linie auf einer fixen 0–100%-Skala (unabhängig von der kWh-Achse der Balken). */
function buildSocPath(soc: Array<number | null>, barCount: number): string {
  let path = '';
  let penDown = false;

  soc.forEach((value, index) => {
    if (value === null) {
      penDown = false;
      return;
    }
    const x = ((index + 0.5) / barCount) * 100;
    const y = 100 - value;
    path += `${penDown ? 'L' : 'M'} ${x} ${y} `;
    penDown = true;
  });

  return path.trim();
}

/**
 * Rendert Laden/Entladen als gruppierte Balken (analog zu `bar-chart.ts`,
 * gleiches HTML/CSS-Muster) plus optional eine durchgezogene Ladestand-Linie
 * (%) als SVG-Overlay. Die Linie nutzt bewusst eine eigene fixe 0–100%-Skala
 * statt der kWh-Achse der Balken – beide Größen sind nicht vergleichbar, eine
 * gemeinsame Achse würde eine falsche Beziehung suggerieren.
 */
export function renderBatteryChart(
  chargeBars: StatBar[],
  dischargeBars: StatBar[],
  options: BatteryChartOptions = {},
): TemplateResult {
  const height = options.height ?? DEFAULT_CHART_HEIGHT;
  const locale = options.locale ?? 'de';
  const chargeColor = options.chargeColor ?? DEFAULT_CHARGE_COLOR;
  const dischargeColor = options.dischargeColor ?? DEFAULT_DISCHARGE_COLOR;
  const barCount = Math.max(chargeBars.length, dischargeBars.length);
  const labels = options.labels ?? Array.from({ length: barCount }, () => '');
  const tooltipLabels = options.tooltipLabels ?? Array.from({ length: barCount }, () => '');
  const soc = options.soc;
  const hasSoc = !!soc && soc.some((value) => value !== null);
  const hoveredIndex = options.hoveredIndex ?? null;
  const onHover = options.onHover;
  const numberFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  const maxValue = Math.max(...chargeBars.map((bar) => bar.value), ...dischargeBars.map((bar) => bar.value), 0.001);
  const step = computeNiceStep(maxValue, 4);
  const axisMax = Math.max(step, Math.ceil(maxValue / step) * step);
  const tickCount = Math.round(axisMax / step);
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => i * step);
  const socTicks = [0, 25, 50, 75, 100];

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
          ${Array.from({ length: barCount }, (_, index) => {
            const chargeValue = chargeBars[index]?.value ?? 0;
            const dischargeValue = dischargeBars[index]?.value ?? 0;
            const chargePct = chargeValue > 0 ? Math.max((chargeValue / axisMax) * 100, 2) : 0;
            const dischargePct = dischargeValue > 0 ? Math.max((dischargeValue / axisMax) * 100, 2) : 0;
            const hoveredSoc = hoveredIndex !== null ? (soc?.[hoveredIndex] ?? null) : null;
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
                  if (ev.pointerType !== 'mouse') onHover?.(hoveredIndex === index ? null : index);
                }}
              >
                ${hoveredIndex === index
                  ? html`
                      <div class="tooltip">
                        <div class="tooltip-title">${tooltipLabels[index]}</div>
                        <div class="tooltip-row">
                          <span class="tooltip-dot" style="background: ${chargeColor};"></span>
                          Geladen: ${numberFormat.format(chargeValue)} kWh
                        </div>
                        <div class="tooltip-row">
                          <span class="tooltip-dot" style="background: ${dischargeColor};"></span>
                          Entladen: ${numberFormat.format(dischargeValue)} kWh
                        </div>
                        ${hoveredSoc !== null
                          ? html`<div class="tooltip-row">Ladestand: ${numberFormat.format(hoveredSoc)} %</div>`
                          : ''}
                      </div>
                    `
                  : ''}
                <div class="battery-bars">
                  <div class="battery-bar" style="height: ${chargePct}%; background: ${chargeColor};"></div>
                  <div class="battery-bar" style="height: ${dischargePct}%; background: ${dischargeColor};"></div>
                </div>
              </div>
            `;
          })}
          ${hasSoc && barCount > 0
            ? html`
                <svg class="soc-line" viewBox="0 0 100 100" preserveAspectRatio="none">
                  ${svg`<path
                    d=${buildSocPath(soc!, barCount)}
                    fill="none"
                    stroke="var(--info-color, #2196f3)"
                    stroke-width="1.5"
                    vector-effect="non-scaling-stroke"
                  />`}
                </svg>
              `
            : ''}
        </div>
        <div class="x-axis">${labels.map((label) => html`<div class="x-label">${label}</div>`)}</div>
      </div>
      ${hasSoc
        ? html`
            <div class="y-axis-col y-axis-col-right" style="height: ${height}px;">
              <span class="y-axis-unit">%</span>
              <div class="y-axis">
                ${socTicks
                  .slice()
                  .reverse()
                  .map((tick) => html`<span>${tick}</span>`)}
              </div>
            </div>
          `
        : ''}
    </div>
  `;
}
