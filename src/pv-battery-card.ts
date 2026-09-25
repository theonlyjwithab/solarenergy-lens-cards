import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvBatteryCardConfig } from './types';
import { renderBatteryGauge, BATTERY_GAUGE_VIEW_WIDTH, BATTERY_GAUGE_VIEW_HEIGHT } from './chart/battery-gauge';
import './pv-battery-card-editor';

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

  public setConfig(config: PvBatteryCardConfig): void {
    const missing = REQUIRED_FIELDS.filter((key) => !config[key]);
    if (missing.length > 0) {
      throw new Error(`Bitte folgende Felder in der Kartenkonfiguration angeben: ${missing.join(', ')}.`);
    }
    this._config = config;
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
                <div class="soc-value">${Math.round(soc)} %</div>
              </div>
              ${hasPower
                ? html`<div class="power-row">${renderPowerFlow(netPower, this.hass.locale.language)}</div>`
                : ''}
            `
          : html`<div class="message">Keine Daten</div>`}
      </ha-card>
    `;
  }

  static styles = css`
    .title {
      padding: 16px 16px 0;
      font-size: 1.2rem;
      font-weight: 500;
      color: var(--primary-text-color);
    }
    .battery-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px 16px;
    }
    .battery-icon {
      width: 120px;
      height: auto;
      flex-shrink: 0;
    }
    .soc-value {
      font-size: 1.8rem;
      font-weight: 600;
      color: var(--primary-text-color);
    }
    .power-row {
      padding: 0 16px 16px;
      font-size: 0.95rem;
      color: var(--primary-text-color);
    }
    .power-row .idle {
      color: var(--secondary-text-color);
    }
    .power-arrow {
      display: inline-block;
      font-weight: 700;
    }
    .message {
      padding: 8px 16px 16px;
      color: var(--secondary-text-color);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'pv-battery-card': PvBatteryCard;
  }
}
