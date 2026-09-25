import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvEnergyFlowCardConfig, Period } from './types';
import { fetchStatistics, type StatBar } from './data/statistics';
import { getRangeForPeriod, shiftReferenceDate, RECORDER_PERIOD } from './utils/period';
import type { DateRange } from './utils/time';
import { renderPeriodHeader, periodHeaderStyles, ALL_PERIODS } from './components/period-header';
import {
  renderEnergyFlowContent,
  scaleEnergyFlowTotals,
  formatKwh,
  formatWatts,
  ENERGY_FLOW_VIEW_WIDTH,
  ENERGY_FLOW_VIEW_HEIGHT,
  type EnergyFlowTotals,
  type LiveFlow,
} from './chart/energy-flow';
import './pv-energy-flow-card-editor';

const REQUIRED_ENTITY_FIELDS = [
  'pv_entity',
  'battery_charge_entity',
  'battery_discharge_entity',
  'grid_import_entity',
  'grid_export_entity',
] as const;

type FlowTotals = EnergyFlowTotals;

function sum(bars: StatBar[]): number {
  return bars.reduce((total, bar) => total + bar.value, 0);
}

@customElement('pv-energy-flow-card')
export class PvEnergyFlowCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvEnergyFlowCardConfig;
  @state() private _period: Period = 'day';
  @state() private _referenceDate: Date = new Date();
  @state() private _totals?: FlowTotals;
  @state() private _loading = false;
  @state() private _error?: string;
  @state() private _view: 'flow' | 'cost' = 'flow';

  private _fetchKey?: string;

  public setConfig(config: PvEnergyFlowCardConfig): void {
    const missing = REQUIRED_ENTITY_FIELDS.filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(`Bitte folgende Entitäten in der Kartenkonfiguration angeben: ${missing.join(', ')}.`);
    }
    // Der Standard-Zeitraum soll nur beim allerersten Laden der Karte gelten,
    // nicht bei jeder späteren Config-Änderung den navigierten Zeitraum zurücksetzen.
    if (!this._config) {
      this._period = config.default_period ?? 'day';
    }
    this._config = config;
  }

  public getCardSize(): number {
    // Hochformat-Diagramm ist deutlich höher als die Balken-Karte.
    return 9;
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement('pv-energy-flow-card-editor');
  }

  public static getStubConfig(): PvEnergyFlowCardConfig {
    // Anders als bei der Solar-Karte lässt sich hier keine passende Entität
    // automatisch erraten – es braucht 5 spezifische Sensoren (PV/Batterie/
    // Netz), die sich nicht anhand des entity_id-Präfixes unterscheiden
    // lassen. Die Karte öffnet nach dem Hinzufügen direkt im Editor, wo der
    // Nutzer sie auswählt.
    return {
      type: 'custom:pv-energy-flow-card',
      title: 'Energiefluss',
      pv_entity: '',
      battery_charge_entity: '',
      battery_discharge_entity: '',
      grid_import_entity: '',
      grid_export_entity: '',
    };
  }

  private get _availablePeriods(): Period[] {
    return this._config?.periods?.length ? this._config.periods : ALL_PERIODS;
  }

  /**
   * Momentanleistung (W) direkt aus `hass.states` – kein Websocket-Fetch nötig,
   * da HA bei jeder Zustandsänderung ohnehin ein neues `hass`-Objekt an die
   * Karte durchreicht (reaktiv über die `@property hass`). Nur im
   * Energiefluss-Tab **des heutigen Tages** sinnvoll: eine Momentanleistung
   * passt nicht zur historischen Kosten-Ansicht, zu Woche/Monat/Jahr, noch zu
   * einem in der Tagesansicht angesteuerten vergangenen Tag ("jetzt" gehört
   * nicht zu einem Tag in der Vergangenheit).
   */
  private get _liveFlow(): LiveFlow | undefined {
    if (!this.hass || !this._config || this._period !== 'day' || this._view !== 'flow') {
      return undefined;
    }

    const timeZone = this.hass.config.time_zone;
    const todayRange = getRangeForPeriod('day', new Date(), timeZone);
    const shownRange = getRangeForPeriod('day', this._referenceDate, timeZone);
    if (shownRange.start.getTime() !== todayRange.start.getTime()) {
      return undefined;
    }

    const read = (entityId?: string): number | undefined => {
      if (!entityId) return undefined;
      const value = Number(this.hass!.states[entityId]?.state);
      return Number.isFinite(value) ? value : undefined;
    };

    const pv = read(this._config.pv_power_entity);
    const charge = read(this._config.battery_charge_power_entity);
    const discharge = read(this._config.battery_discharge_power_entity);
    const gridImport = read(this._config.grid_import_power_entity);
    const gridExport = read(this._config.grid_export_power_entity);

    if ([pv, charge, discharge, gridImport, gridExport].every((value) => value === undefined)) {
      return undefined;
    }

    const direct = pv !== undefined && charge !== undefined && gridExport !== undefined ? Math.max(pv - charge - gridExport, 0) : undefined;

    return { charge, direct, export: gridExport, discharge, import: gridImport };
  }

  protected willUpdate(): void {
    if (!this.hass || !this._config) {
      return;
    }

    if (!this._availablePeriods.includes(this._period)) {
      this._period = this._availablePeriods[0];
    }
    if (this._config.price_per_kwh == null && this._view === 'cost') {
      this._view = 'flow';
    }

    const timeZone = this.hass.config.time_zone;
    const range = getRangeForPeriod(this._period, this._referenceDate, timeZone);
    const key = [
      this._config.pv_entity,
      this._config.battery_charge_entity,
      this._config.battery_discharge_entity,
      this._config.grid_import_entity,
      this._config.grid_export_entity,
      this._period,
      range.start.getTime(),
    ].join('|');

    if (key !== this._fetchKey) {
      this._fetchKey = key;
      void this._fetchData(key, range);
    }
  }

  private async _fetchData(key: string, range: DateRange): Promise<void> {
    if (!this.hass || !this._config) {
      return;
    }

    this._loading = true;
    this._error = undefined;

    try {
      const recorderPeriod = RECORDER_PERIOD[this._period];
      const [pvBars, chargeBars, dischargeBars, importBars, exportBars] = await Promise.all([
        fetchStatistics(this.hass, this._config.pv_entity, range, recorderPeriod),
        fetchStatistics(this.hass, this._config.battery_charge_entity, range, recorderPeriod),
        fetchStatistics(this.hass, this._config.battery_discharge_entity, range, recorderPeriod),
        fetchStatistics(this.hass, this._config.grid_import_entity, range, recorderPeriod),
        fetchStatistics(this.hass, this._config.grid_export_entity, range, recorderPeriod),
      ]);

      // Falls inzwischen weitergeklickt wurde, ist diese Antwort veraltet.
      if (key !== this._fetchKey) {
        return;
      }

      const pv = sum(pvBars);
      const charge = sum(chargeBars);
      const discharge = sum(dischargeBars);
      const gridImport = sum(importBars);
      const gridExport = sum(exportBars);
      const pvDirect = Math.max(pv - charge - gridExport, 0);
      const hausbedarf = pvDirect + discharge + gridImport;

      this._totals = { pv, charge, discharge, gridImport, gridExport, pvDirect, hausbedarf };
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

  private _goToPrevious(): void {
    if (!this.hass) return;
    this._referenceDate = shiftReferenceDate(this._referenceDate, this._period, -1, this.hass.config.time_zone);
  }

  private _goToNext(): void {
    if (!this.hass) return;
    this._referenceDate = shiftReferenceDate(this._referenceDate, this._period, 1, this.hass.config.time_zone);
  }

  private _goToNow(): void {
    this._referenceDate = new Date();
  }

  private _onPeriodChange(period: Period): void {
    this._period = period;
    this._referenceDate = new Date();
  }

  private _selectView(view: 'flow' | 'cost'): void {
    this._view = view;
  }

  protected render() {
    if (!this._config || !this.hass) {
      return html``;
    }

    const timeZone = this.hass.config.time_zone;
    const locale = this.hass.locale.language;
    const price = this._config.price_per_kwh;
    const costFormat = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' });

    return html`
      <ha-card>
        ${renderPeriodHeader({
          period: this._period,
          referenceDate: this._referenceDate,
          availablePeriods: this._availablePeriods,
          timeZone,
          locale,
          onPrevious: this._goToPrevious,
          onNext: this._goToNext,
          onNow: this._goToNow,
          onPeriodChange: (period) => this._onPeriodChange(period),
        })}

        ${price != null
          ? html`
              <div class="view-tabs">
                <button
                  class=${this._view === 'flow' ? 'view-tab active' : 'view-tab'}
                  @click=${() => this._selectView('flow')}
                >
                  Energiefluss
                </button>
                <button
                  class=${this._view === 'cost' ? 'view-tab active' : 'view-tab'}
                  @click=${() => this._selectView('cost')}
                >
                  Kosten
                </button>
              </div>
            `
          : ''}

        <div class="title">${this._config.title ?? 'Energiefluss'}</div>

        ${this._error
          ? html`<div class="message error">Fehler: ${this._error}</div>`
          : this._loading && !this._totals
            ? html`<div class="message">Lade Daten…</div>`
            : this._totals
              ? html`
                  <div class="chart">
                    <svg
                      viewBox="0 0 ${ENERGY_FLOW_VIEW_WIDTH} ${ENERGY_FLOW_VIEW_HEIGHT}"
                      style="width: 100%; height: auto; display: block;"
                    >
                      ${this._view === 'cost' && price != null
                        ? renderEnergyFlowContent(scaleEnergyFlowTotals(this._totals, price), (value) =>
                            costFormat.format(value),
                          )
                        : renderEnergyFlowContent(
                            this._totals,
                            (value) => formatKwh(value, locale),
                            this._liveFlow ? { flow: this._liveFlow, format: (value) => formatWatts(value, locale) } : undefined,
                          )}
                    </svg>
                  </div>
                `
              : html``}
      </ha-card>
    `;
  }

  static styles = [
    periodHeaderStyles,
    css`
      :host {
        /* Feste Farbzuordnung PV/Speicher/Netz – CVD-geprüfte Palette
           (siehe CLAUDE.md, Abschnitt "Zweite Karte: Energiefluss"). */
        --pv-color: #d95926;
        --speicher-color: #199e70;
        --netz-color: #3987e5;
        /* Modul-Kästchen etwas heller/dunkler als der Kartenhintergrund,
           analog zu Home Assistants eigenen Eingabefeldern/Listenzeilen. */
        --efc-surface-color: var(--secondary-background-color, #262626);
        --efc-track-color: var(--card-background-color, #1c1c1c);
      }
      .view-tabs {
        display: flex;
        gap: 4px;
        padding: 8px 16px 0;
      }
      .view-tab {
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        color: var(--secondary-text-color);
        cursor: pointer;
        font: inherit;
        font-size: 0.85rem;
        padding: 4px 8px;
      }
      .view-tab.active {
        border-bottom-color: var(--primary-color);
        color: var(--primary-text-color);
        font-weight: 500;
      }
      .title {
        padding: 8px 16px 0;
        font-size: 1.2rem;
        font-weight: 500;
        color: var(--primary-text-color);
      }
      .chart {
        padding: 8px 16px 16px;
      }
      .message {
        padding: 16px 0;
        color: var(--secondary-text-color);
      }
      .message.error {
        color: var(--error-color);
      }
      .efc-label {
        font-size: 13px;
        fill: var(--primary-text-color);
        font-weight: 500;
      }
      .efc-value {
        font-size: 11.5px;
        fill: var(--secondary-text-color);
      }
      .efc-mini-name,
      .efc-mini-value {
        font-size: 9.5px;
        fill: var(--secondary-text-color);
      }
      .efc-ring-value {
        font-size: 17px;
        font-weight: 700;
        fill: var(--primary-text-color);
      }
      .efc-ring-label {
        font-size: 10.5px;
        fill: var(--secondary-text-color);
      }
      .efc-legend-text {
        font-size: 12px;
        fill: var(--secondary-text-color);
      }
      .efc-legend-value {
        font-size: 12px;
        fill: var(--primary-text-color);
        font-weight: 500;
      }
      .efc-flow-label {
        font-size: 10px;
        font-weight: 600;
        fill: var(--primary-text-color);
      }
      .efc-surface {
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
      }
      .efc-ring-segment {
        transition: stroke-dasharray 0.3s ease;
      }
      .efc-flow-dot {
        filter: drop-shadow(0 0 3px currentColor);
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'pv-energy-flow-card': PvEnergyFlowCard;
  }
}
