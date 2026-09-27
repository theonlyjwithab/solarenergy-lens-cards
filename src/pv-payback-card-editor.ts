import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvPaybackCardConfig } from './types';
import { resolveLang, t, type Lang } from './i18n';

// Gleiches `ha-form`-Muster wie bei den anderen Karten-Editoren (flache
// Schema-Liste, analog zur Energiefluss-Karte statt Grid-Paaren wie bei der
// Akku-Karte – für 5 gleichrangige Entitäten übersichtlicher).

const SCHEMA = [
  { name: 'title', selector: { text: {} } },
  { name: 'pv_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'battery_charge_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'battery_discharge_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_import_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  { name: 'grid_export_entity', required: true, selector: { entity: { domain: 'sensor' } } },
  {
    name: 'price_per_kwh',
    required: true,
    selector: { number: { min: 0, step: 0.01, mode: 'box', unit_of_measurement: '€/kWh' } },
  },
  {
    name: 'investment_cost',
    required: true,
    selector: { number: { min: 0, step: 10, mode: 'box', unit_of_measurement: '€' } },
  },
  { name: 'install_date', required: true, selector: { date: {} } },
  {
    name: 'initial_saved_offset',
    selector: { number: { min: 0, step: 10, mode: 'box', unit_of_measurement: '€' } },
  },
];

function getLabels(lang: Lang): Record<string, string> {
  return {
    title: t(lang, 'label_title'),
    pv_entity: t(lang, 'label_pv_entity'),
    battery_charge_entity: t(lang, 'label_battery_charge_entity'),
    battery_discharge_entity: t(lang, 'label_battery_discharge_entity'),
    grid_import_entity: t(lang, 'label_grid_import_entity'),
    grid_export_entity: t(lang, 'label_grid_export_entity'),
    price_per_kwh: t(lang, 'label_price_per_kwh'),
    investment_cost: t(lang, 'label_investment_cost'),
    install_date: t(lang, 'label_install_date'),
    initial_saved_offset: t(lang, 'label_initial_saved_offset'),
  };
}

interface HaFormValueChangedDetail {
  value: PvPaybackCardConfig;
}

@customElement('pv-payback-card-editor')
export class PvPaybackCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvPaybackCardConfig;

  public setConfig(config: PvPaybackCardConfig): void {
    this._config = config;
  }

  private _computeLabel = (schema: { name: string }): string => {
    const labels = getLabels(resolveLang(this.hass?.locale.language));
    return labels[schema.name] ?? schema.name;
  };

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
    'pv-payback-card-editor': PvPaybackCardEditor;
  }
}
