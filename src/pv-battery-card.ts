import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvBatteryCardConfig } from './types';
import { renderBatteryGauge, BATTERY_GAUGE_VIEW_WIDTH, BATTERY_GAUGE_VIEW_HEIGHT } from './chart/battery-gauge';
import { fetchSolarForecast, type ForecastPoint } from './data/forecast';
import { fetchAverageBaseLoadKw } from './data/base-load';
import { estimateFullTime } from './utils/charge-estimate';
import { formatEstimatedTimeLabel } from './utils/format';
import './pv-battery-card-editor';

// Wie oft die Ladezeit-Prognose (Solarprognose + Grundlast-Mittelwert)
// höchstens neu geholt wird. Häufiger nachzufragen brächte kaum bessere
// Werte (Grundlast wird ohnehin über mehrere Stunden gemittelt), aber mehr
// Websocket-Last – der 10-Minuten-Takt läuft einfach über die Zeitbucket im
// Fetch-Key mit, jedes Mal wenn `hass` sich sowieso ändert.
const FORECAST_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const REQUIRED_FIELDS = [
  'soc_entity',
  'charge_power_entity',
  'discharge_power_entity',
  'battery_capacity_kwh',
] as const;

// Unterhalb dieser Schwelle (W) gilt der Akku als im Ruhezustand statt
// fälschlich "lädt"/"entlädt" wegen Sensor-Messrauschen anzuzeigen.
const POWER_IDLE_THRESHOLD = 5;

/** Netto-Leistung (Ladeleistung − Entladeleistung) als Pfeil + Text. */
function renderPowerFlow(netPower: number, locale: string) {
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  if (Math.abs(netPower) < POWER_IDLE_THRESHOLD) {
    return html`<span class="power-flow idle">Im Ruhezustand</span>`;
  }
  if (netPower > 0) {
    return html`<span class="power-flow charging"><span class="power-arrow">↑</span> ${format.format(netPower)} W lädt</span>`;
  }
  return html`<span class="power-flow discharging"><span class="power-arrow">↓</span> ${format.format(-netPower)} W entlädt</span>`;
}

@customElement('pv-battery-card')
export class PvBatteryCard extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvBatteryCardConfig;
  @state() private _forecast?: ForecastPoint[];
  @state() private _baseLoadKw?: number;

  private _forecastFetchKey?: string;

  public setConfig(config: PvBatteryCardConfig): void {
    const missing = REQUIRED_FIELDS.filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(`Bitte folgende Felder in der Kartenkonfiguration angeben: ${missing.join(', ')}.`);
    }
    this._config = config;
  }

  protected willUpdate(): void {
    if (!this.hass || !this._config) {
      return;
    }

    const { pv_power_entity, grid_import_power_entity, grid_export_power_entity } = this._config;
    if (!pv_power_entity || !grid_import_power_entity || !grid_export_power_entity) {
      // Ladezeit-Prognose ohne die drei Leistungssensoren nicht möglich –
      // Karte zeigt dann einfach nur SoC + Live-Leistung.
      return;
    }

    const bucket = Math.floor(Date.now() / FORECAST_REFRESH_INTERVAL_MS);
    const key = [
      pv_power_entity,
      grid_import_power_entity,
      grid_export_power_entity,
      this._config.charge_power_entity,
      this._config.discharge_power_entity,
      bucket,
    ].join('|');

    if (key !== this._forecastFetchKey) {
      this._forecastFetchKey = key;
      void this._fetchForecastData(
        key,
        pv_power_entity,
        grid_import_power_entity,
        grid_export_power_entity,
        this._config.charge_power_entity,
        this._config.discharge_power_entity,
      );
    }
  }

  private async _fetchForecastData(
    key: string,
    pvPowerEntity: string,
    gridImportPowerEntity: string,
    gridExportPowerEntity: string,
    chargePowerEntity: string,
    dischargePowerEntity: string,
  ): Promise<void> {
    if (!this.hass) {
      return;
    }

    try {
      const [forecast, baseLoadKw] = await Promise.all([
        fetchSolarForecast(this.hass),
        fetchAverageBaseLoadKw(
          this.hass,
          pvPowerEntity,
          gridImportPowerEntity,
          gridExportPowerEntity,
          chargePowerEntity,
          dischargePowerEntity,
        ),
      ]);

      // Falls inzwischen die Config sich geändert hat, ist diese Antwort veraltet.
      if (key !== this._forecastFetchKey) {
        return;
      }
      this._forecast = forecast;
      this._baseLoadKw = baseLoadKw;
    } catch {
      // Die Ladezeit-Prognose ist eine optionale Zusatzfunktion – ein Fehler
      // hier (z. B. keine Forecast.Solar-Quelle konfiguriert) soll nicht die
      // eigentliche SoC-/Leistungsanzeige überdecken, die Zeile bleibt
      // einfach weg (analog zur Prognose-Fehlerbehandlung der Diagramm-Karte).
    }
  }

  public getCardSize(): number {
    return 3;
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement('pv-battery-card-editor');
  }

  public static getStubConfig(): PvBatteryCardConfig {
    // Anders als bei der ersten Karte lässt sich hier keine passende Entität
    // automatisch erraten (Ladestand/Leistung lassen sich nicht am
    // entity_id-Präfix erkennen) – die Karte startet nach dem Hinzufügen mit
    // leeren Pflichtfeldern, die im Editor ausgefüllt werden.
    return {
      type: 'custom:pv-battery-card',
      title: 'Akkustand',
      soc_entity: '',
      charge_power_entity: '',
      discharge_power_entity: '',
      battery_capacity_kwh: 0,
    };
  }

  protected render() {
    if (!this._config || !this.hass) {
      return nothing;
    }

    const socState = this.hass.states[this._config.soc_entity];
    const soc = socState ? Number(socState.state) : NaN;
    const hasSoc = Number.isFinite(soc);

    const chargeState = this.hass.states[this._config.charge_power_entity];
    const dischargeState = this.hass.states[this._config.discharge_power_entity];
    const chargePower = chargeState ? Number(chargeState.state) : NaN;
    const dischargePower = dischargeState ? Number(dischargeState.state) : NaN;
    const hasPower = Number.isFinite(chargePower) && Number.isFinite(dischargePower);
    const netPower = chargePower - dischargePower;

    const locale = this.hass.locale.language;
    const timeZone = this.hass.config.time_zone;
    const estimateLabel = hasSoc ? this._chargeEstimateLabel(soc, locale, timeZone) : undefined;

    return html`
      <ha-card>
        <div class="title">${this._config.title ?? 'Akkustand'}</div>
        ${hasSoc
          ? html`
              <div class="battery-row">
                <svg
                  class="battery-icon"
                  viewBox="0 0 ${BATTERY_GAUGE_VIEW_WIDTH} ${BATTERY_GAUGE_VIEW_HEIGHT}"
                >
                  ${renderBatteryGauge(soc)}
                </svg>
              </div>
              ${hasPower ? html`<div class="power-row">${renderPowerFlow(netPower, locale)}</div>` : ''}
              ${estimateLabel ? html`<div class="estimate-row">${estimateLabel}</div>` : ''}
            `
          : html`<div class="message">Keine Daten</div>`}
      </ha-card>
    `;
  }

  /** Ladezeit-Text unterhalb der Leistungsanzeige, oder `undefined` falls (noch) nicht ermittelbar. */
  private _chargeEstimateLabel(soc: number, locale: string, timeZone: string): string | undefined {
    if (!this._config) {
      return undefined;
    }
    if (soc >= 100) {
      return 'Akku voll';
    }
    if (!this._forecast || this._baseLoadKw == null) {
      return undefined;
    }

    const remainingKwh = (this._config.battery_capacity_kwh * (100 - soc)) / 100;
    const estimate = estimateFullTime(remainingKwh, this._baseLoadKw, this._forecast, new Date());
    if (!estimate) {
      return 'Kein Aufladen mehr innerhalb der Prognose erwartet';
    }
    return `Voll ca. ${formatEstimatedTimeLabel(estimate, new Date(), locale, timeZone)}`;
  }

  static styles = css`
    .title {
      padding: 12px 16px 0;
      font-size: 1.2rem;
      font-weight: 500;
      color: var(--primary-text-color);
      text-align: center;
    }
    .battery-row {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 16px;
    }
    .battery-icon {
      width: 160px;
      height: auto;
      flex-shrink: 0;
    }
    .power-row {
      padding: 0 16px 2px;
      font-size: 0.95rem;
      color: var(--primary-text-color);
      text-align: center;
    }
    .power-row .idle {
      color: var(--secondary-text-color);
    }
    .power-arrow {
      display: inline-block;
      font-weight: 700;
    }
    .estimate-row {
      padding: 0 16px 12px;
      font-size: 0.9rem;
      color: var(--secondary-text-color);
      text-align: center;
    }
    .message {
      padding: 8px 16px 16px;
      color: var(--secondary-text-color);
      text-align: center;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'pv-battery-card': PvBatteryCard;
  }
}
