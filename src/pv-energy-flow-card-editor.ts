import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvEnergyFlowCardConfig } from './types';

// Gleiches `ha-form`-Muster wie beim Editor der PV Energy Diagram-Karte
// (src/pv-energy-diagram-editor.ts):
// von der HA-Frontend-App global registriertes Formular-Element, erzeugt aus
// einem Schema automatisch Entity-Picker, Dropdowns etc.

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Tag' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
  { value: 'year', label: 'Jahr' },
];

const SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: 'pv_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'battery_charge_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'battery_discharge_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_import_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_export_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'pv_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'battery_charge_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'battery_discharge_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_import_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_export_power_entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'default_period', selector: { select: { mode: 'dropdown', options: PERIOD_OPTIONS } } },
  { name: 'periods', selector: { select: { multiple: true, mode: 'list', options: PERIOD_OPTIONS } } },
  {
    name: 'price_per_kwh',
    selector: { number: { min: 0, step: 0.01, mode: 'box', unit_of_measurement: '€/kWh' } },
  },
];

const LABELS: Record<string, string> = {
  title: 'Titel',
  pv_entity: 'PV-Erzeugung',
  battery_charge_entity: 'Batterie laden',
  battery_discharge_entity: 'Batterie entladen',
  grid_import_entity: 'Netzbezug',
  grid_export_entity: 'Netzeinspeisung',
  pv_power_entity: 'Live-Leistung PV (W, optional)',
  battery_charge_power_entity: 'Live-Leistung Laden (W, optional)',
  battery_discharge_power_entity: 'Live-Leistung Entladen (W, optional)',
  grid_import_power_entity: 'Live-Leistung Netzbezug (W, optional)',
  grid_export_power_entity: 'Live-Leistung Einspeisung (W, optional)',
  default_period: 'Standard-Zeitraum',
  periods: 'Wählbare Zeiträume',
  price_per_kwh: 'Strompreis (für Kosten/Ersparnis-Tab)',
};

interface HaFormValueChangedDetail {
  value: PvEnergyFlowCardConfig;
}

@customElement('pv-energy-flow-card-editor')
export class PvEnergyFlowCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvEnergyFlowCardConfig;

  public setConfig(config: PvEnergyFlowCardConfig): void {
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
    'pv-energy-flow-card-editor': PvEnergyFlowCardEditor;
  }
}
