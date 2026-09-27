import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvPaybackCardConfig } from './types';
import { fetchStatistics, type StatBar } from './data/statistics';
import {
  getPaybackRanges,
  computePaybackTotals,
  buildCumulativeSavings,
  estimatePayoffDate,
  type PaybackTotals,
  type SavingsPoint,
} from './utils/payback';
import { formatMonthYearLabel, formatMonthYearShortLabel } from './utils/format';
import { renderPaybackChart, PAYBACK_CHART_VIEW_WIDTH, PAYBACK_CHART_VIEW_HEIGHT } from './chart/payback-chart';
import './pv-payback-card-editor';
import { resolveLang, t } from './i18n';

const REQUIRED_FIELDS = [
  'pv_entity',
  'battery_charge_entity',
  'battery_discharge_entity',
  'grid_import_entity',
  'grid_export_entity',
  'price_per_kwh',
  'investment_cost',
  'install_date',
] as const;

// Kumulierte Lebenszeit-Statistik ändert sich nur langsam – ein stündlicher
// Refresh reicht, um die Karte "aktuell genug" zu halten, ohne den Recorder
// unnötig oft mit mehrjährigen Abfragen zu belasten.
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function sum(bars: StatBar[]): number {
  return bars.reduce((total, bar) => total + bar.value, 0);
}

@customElement('pv-payback-card')
export class PvPaybackCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvPaybackCardConfig;
  @state() private _totals?: PaybackTotals;
  @state() private _points?: SavingsPoint[];
  @state() private _loading = false;
  @state() private _error?: string;

  private _fetchKey?: string;

  public setConfig(config: PvPaybackCardConfig): void {
    const missing = REQUIRED_FIELDS.filter((key) => !config[key]);
    if (missing.length > 0) {
      const lang = resolveLang(this.hass?.locale.language);
      throw new Error(t(lang, 'config_error_missing_fields', { fields: missing.join(', ') }));
    }
    this._config = config;
  }

  public getCardSize(): number {
    return 8;
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement('pv-payback-card-editor');
  }

  public static getStubConfig(hass?: HomeAssistant): PvPaybackCardConfig {
    // Wie bei der Energiefluss-/Akku-Karte lässt sich hier keine passende
    // Entität automatisch erraten (5 spezifische Sensor-Rollen) – die Karte
    // startet nach dem Hinzufügen mit leeren Pflichtfeldern, die im Editor
    // ausgefüllt werden.
    return {
      type: 'custom:pv-payback-card',
      title: t(resolveLang(hass?.locale.language), 'stub_title_payback'),
      pv_entity: '',
      battery_charge_entity: '',
      battery_discharge_entity: '',
      grid_import_entity: '',
      grid_export_entity: '',
      price_per_kwh: 0,
      investment_cost: 0,
      install_date: '',
    };
  }

  protected willUpdate(): void {
    if (!this.hass || !this._config) {
      return;
    }

    const bucket = Math.floor(Date.now() / REFRESH_INTERVAL_MS);
    const key = [
      this._config.pv_entity,
      this._config.battery_charge_entity,
      this._config.battery_discharge_entity,
      this._config.grid_import_entity,
      this._config.grid_export_entity,
      this._config.price_per_kwh,
      this._config.investment_cost,
      this._config.install_date,
      this._config.initial_saved_offset,
      bucket,
    ].join('|');

    if (key !== this._fetchKey) {
      this._fetchKey = key;
      void this._fetchData(key);
    }
  }

  private async _fetchData(key: string): Promise<void> {
    if (!this.hass || !this._config) {
      return;
    }

    this._loading = true;
    this._error = undefined;

    try {
      const timeZone = this.hass.config.time_zone;
      const ranges = getPaybackRanges(this._config.install_date, timeZone);
      const { pv_entity, battery_charge_entity, battery_discharge_entity, grid_import_entity, grid_export_entity } =
        this._config;

      const [pvL, chargeL, dischargeL, , exportL, pvT, chargeT, dischargeT, , exportT] = await Promise.all([
        fetchStatistics(this.hass, pv_entity, ranges.lifetime, 'month'),
        fetchStatistics(this.hass, battery_charge_entity, ranges.lifetime, 'month'),
        fetchStatistics(this.hass, battery_discharge_entity, ranges.lifetime, 'month'),
        fetchStatistics(this.hass, grid_import_entity, ranges.lifetime, 'month'),
        fetchStatistics(this.hass, grid_export_entity, ranges.lifetime, 'month'),
        fetchStatistics(this.hass, pv_entity, ranges.trailing12, 'month'),
        fetchStatistics(this.hass, battery_charge_entity, ranges.trailing12, 'month'),
        fetchStatistics(this.hass, battery_discharge_entity, ranges.trailing12, 'month'),
        fetchStatistics(this.hass, grid_import_entity, ranges.trailing12, 'month'),
        fetchStatistics(this.hass, grid_export_entity, ranges.trailing12, 'month'),
      ]);

      // Falls inzwischen die Config sich geändert hat, ist diese Antwort veraltet.
      if (key !== this._fetchKey) {
        return;
      }

      const initialOffsetEuro = this._config.initial_saved_offset ?? 0;
      const pricePerKwh = this._config.price_per_kwh;

      const pvDirectLifetime = Math.max(sum(pvL) - sum(chargeL) - sum(exportL), 0);
      const lifetimeSavedKwh = pvDirectLifetime + sum(dischargeL);

      const pvDirectTrailing12 = Math.max(sum(pvT) - sum(chargeT) - sum(exportT), 0);
      const trailing12SavedKwh = pvDirectTrailing12 + sum(dischargeT);

      this._totals = computePaybackTotals({
        lifetimeSavedKwh,
        trailing12SavedKwh,
        pricePerKwh,
        investmentEuro: this._config.investment_cost,
        hasFullYear: ranges.hasFullYear,
        lifetimeStart: ranges.lifetime.start,
        now: ranges.lifetime.end,
        initialOffsetEuro,
      });

      this._points = buildCumulativeSavings({
        pvBars: pvL,
        chargeBars: chargeL,
        dischargeBars: dischargeL,
        exportBars: exportL,
        pricePerKwh,
        initialOffsetEuro,
      });
    } catch (err) {
      if (key !== this._fetchKey) {
        return;
      }
      this._error = err instanceof Error ? err.message : String(err);
    } finally {
      if (key === this._fetchKey) {
        this._loading = false;
      }
    }
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }

    const lang = resolveLang(this.hass.locale.language);
    const locale = this.hass.locale.language;
    const timeZone = this.hass.config.time_zone;
    const euro = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });
    const percentFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

    return html`
      <ha-card>
        <div class="title">${this._config.title ?? t(lang, 'stub_title_payback')}</div>

        ${this._error
          ? html`<div class="message error">${t(lang, 'error_prefix', { message: this._error })}</div>`
          : this._loading && !this._totals
            ? html`<div class="message">${t(lang, 'loading')}</div>`
            : this._totals
              ? this._renderContent(this._totals, this._points ?? [], lang, locale, timeZone, euro, percentFormat)
              : html``}
      </ha-card>
    `;
  }

  private _renderContent(
    totals: PaybackTotals,
    points: SavingsPoint[],
    lang: ReturnType<typeof resolveLang>,
    locale: string,
    timeZone: string,
    euro: Intl.NumberFormat,
    percentFormat: Intl.NumberFormat,
  ) {
    let paidOffAt: Date | undefined;
    let projection: { date: Date; euro: number } | undefined;
    if (totals.remainingEuro <= 0) {
      paidOffAt = points.find((point) => point.cumulativeSavedEuro >= totals.investmentEuro)?.date;
    } else if (totals.monthlyRateEuro > 0) {
      projection = { date: estimatePayoffDate(new Date(), totals.remainingMonths), euro: totals.investmentEuro };
    }

    const payoffLine = paidOffAt
      ? t(lang, 'payback_paid_off_since', { date: formatMonthYearLabel(paidOffAt, locale, timeZone) })
      : projection
        ? t(lang, 'payback_estimated_payoff', {
            date: (totals.isRoughEstimate ? '~' : '') + formatMonthYearLabel(projection.date, locale, timeZone),
          })
        : undefined;

    return html`
      <div class="hero">
        <span class="percent">${percentFormat.format(totals.percent)}</span>
        <span class="percent-suffix">% ${t(lang, 'payback_hero_suffix')}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style="width: ${Math.min(Math.max(totals.percent, 0), 100)}%;"></div>
      </div>
      <div class="progress-caption">
        ${t(lang, 'payback_label_saved')}: ${euro.format(totals.savedEuro)}
        ${t(lang, 'payback_of_investment', { value: euro.format(totals.investmentEuro) })}
      </div>

      ${payoffLine ? html`<div class="payoff-line">${payoffLine}</div>` : ''}
      ${
        // Die Unsicherheit betrifft nur die Restlaufzeit-Prognose, nicht ein
        // bereits erreichtes (aus echten Messdaten berechnetes) Amortisations-
        // Datum – der Hinweis erscheint deshalb nur, solange noch projiziert wird.
        !paidOffAt && totals.isRoughEstimate
          ? html`<div class="note">${t(lang, 'payback_rough_estimate_note')}</div>`
          : ''
      }
      ${points.length >= 2
        ? html`
            <div class="chart-box">
              <svg
                viewBox="0 0 ${PAYBACK_CHART_VIEW_WIDTH} ${PAYBACK_CHART_VIEW_HEIGHT}"
                style="width: 100%; height: auto; display: block;"
              >
                ${renderPaybackChart({
                  points,
                  investmentEuro: totals.investmentEuro,
                  projection,
                  paidOffAt,
                  investmentLabel: t(lang, 'payback_investment_axis_label'),
                  formatMonthYear: (date) => formatMonthYearShortLabel(date, locale, timeZone),
                })}
              </svg>
            </div>
          `
        : ''}

      <div class="chips">
        <div class="chip">
          <span class="chip-label">${t(lang, 'payback_label_remaining')}</span>
          <span class="chip-value">${euro.format(totals.remainingEuro)}</span>
        </div>
        <div class="chip">
          <span class="chip-label">${t(lang, 'payback_label_monthly_rate')}</span>
          <span class="chip-value">${euro.format(totals.monthlyRateEuro)}</span>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      /* Gleiche CVD-geprüfte Palette wie die Energiefluss-Karte (PV=orange,
         Speicher/Gewinnzone=grün), siehe CLAUDE.md. */
      --ppc-accent: #d95926;
      --ppc-profit: #199e70;
    }
    .title {
      padding: 12px 16px 0;
      font-size: 1.2rem;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .message {
      padding: 8px 16px 16px;
      color: var(--secondary-text-color);
    }
    .message.error {
      color: var(--error-color);
    }
    .hero {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 8px 16px 0;
    }
    .hero .percent {
      font-size: 2.1rem;
      font-weight: 700;
      color: var(--primary-text-color);
      line-height: 1;
    }
    .hero .percent-suffix {
      font-size: 0.85rem;
      color: var(--secondary-text-color);
    }
    .progress-track {
      margin: 10px 16px 4px;
      height: 8px;
      border-radius: 4px;
      background: var(--secondary-background-color, #262626);
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 4px;
      background: var(--ppc-accent);
    }
    .progress-caption {
      padding: 0 16px;
      font-size: 0.85rem;
      color: var(--secondary-text-color);
    }
    .payoff-line {
      padding: 8px 16px 0;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .note {
      padding: 2px 16px 0;
      font-size: 0.78rem;
      font-style: italic;
      color: var(--secondary-text-color);
    }
    .chart-box {
      margin: 12px 16px 4px;
      padding: 10px 8px 2px;
      background: var(--secondary-background-color, #262626);
      border-radius: 12px;
    }
    .chips {
      display: flex;
      gap: 12px;
      padding: 8px 16px 16px;
    }
    .chip {
      flex: 1;
      background: var(--secondary-background-color, #262626);
      border-radius: 12px;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .chip .chip-label {
      font-size: 0.75rem;
      color: var(--secondary-text-color);
    }
    .chip .chip-value {
      font-size: 1rem;
      font-weight: 600;
      color: var(--primary-text-color);
    }
    .ppc-axis {
      stroke: var(--divider-color, rgba(255, 255, 255, 0.15));
      stroke-width: 1;
    }
    .ppc-investment-line {
      stroke: var(--secondary-text-color);
      stroke-width: 1;
      stroke-dasharray: 4 4;
      opacity: 0.6;
    }
    .ppc-investment-label {
      font-size: 9px;
      fill: var(--secondary-text-color);
    }
    .ppc-today-line {
      stroke: var(--secondary-text-color);
      stroke-width: 1;
      stroke-dasharray: 3 4;
      opacity: 0.4;
    }
    .ppc-line-actual {
      fill: none;
      stroke: var(--ppc-accent);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .ppc-line-projected {
      stroke: var(--ppc-accent);
      stroke-width: 2.5;
      stroke-linecap: round;
      stroke-dasharray: 5 5;
      opacity: 0.75;
    }
    .ppc-dot-projected,
    .ppc-dot-paid-off {
      fill: var(--ppc-profit);
      stroke: var(--card-background-color, #1c1c1c);
      stroke-width: 1.5;
    }
    .ppc-axis-label {
      font-size: 9.5px;
      fill: var(--secondary-text-color);
    }
    .ppc-axis-label-highlight {
      fill: var(--ppc-profit);
      font-weight: 600;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'pv-payback-card': PvPaybackCard;
  }
}
