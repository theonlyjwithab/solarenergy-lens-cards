import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvBatteryCardConfig } from './types';

// Gleiches `ha-form`-Muster wie bei den anderen beiden Karten-Editoren.

const SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: 'soc_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  {
    name: '',
    type: 'grid' as const,
    schema: [
      { name: 'charge_power_entity', required: true, selector: { entity: { domain: 'sensor' } } },
      { name: 'discharge_power_entity', required: true, selector: { entity: { domain: 'sensor' } } },
    ],
  },
  {
    name: 'battery_capacity_kwh',
    required: true,
    selector: { number: { min: 0, step: 0.1, mode: 'box', unit_of_measurement: 'kWh' } },
  },
  { name: 'pv_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_import_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_export_power_entity', selector: { entity: { domain: 'sensor' } } },
];

const LABELS: Record<string, string> = {
  title: 'Titel',
  soc_entity: 'Ladestand (%)',
  charge_power_entity: 'Ladeleistung (W)',
  discharge_power_entity: 'Entladeleistung (W)',
  battery_capacity_kwh: 'Batteriekapazität (kWh)',
  pv_power_entity: 'PV-Erzeugungsleistung (W, optional – für Ladezeit-Prognose)',
  grid_import_power_entity: 'Netzbezug-Leistung (W, optional – für Ladezeit-Prognose)',
  grid_export_power_entity: 'Netzeinspeise-Leistung (W, optional – für Ladezeit-Prognose)',
};

interface HaFormValueChangedDetail {
  value: PvBatteryCardConfig;
}

@customElement('pv-battery-card-editor')
export class PvBatteryCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvBatteryCardConfig;

  public setConfig(config: PvBatteryCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string }): string => LABELS[schema.name] ?? schema.name;

  private _valueChanged(ev: CustomEvent<HaFormValueChangedDetail>): void {
    ev.stopPropagation();
    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: ev.detail.value } }));
  }

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'pv-battery-card-editor': PvBatteryCardEditor;
  }
}
