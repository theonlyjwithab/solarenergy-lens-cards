import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvEnergyFlowCardConfig } from './types';
import { resolveLang, t, type Lang } from './i18n';

// Gleiches `ha-form`-Muster wie beim Editor der PV Energy Diagram-Karte
// (src/pv-energy-diagram-editor.ts):
// von der HA-Frontend-App global registriertes Formular-Element, erzeugt aus
// einem Schema automatisch Entity-Picker, Dropdowns etc.

function getPeriodOptions(lang: Lang) {
  return [
    { value: 'day', label: t(lang, 'period_day') },
    { value: 'week', label: t(lang, 'period_week') },
    { value: 'month', label: t(lang, 'period_month') },
    { value: 'year', label: t(lang, 'period_year') },
  ];
}

function getSchema(lang: Lang) {
  const periodOptions = getPeriodOptions(lang);
  return [
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
    { name: 'default_period', selector: { select: { mode: 'dropdown', options: periodOptions } } },
    { name: 'periods', selector: { select: { multiple: true, mode: 'list', options: periodOptions } } },
    {
      name: 'price_per_kwh',
      selector: { number: { min: 0, step: 0.01, mode: 'box', unit_of_measurement: '€/kWh' } },
    },
  ];
}

function getLabels(lang: Lang): Record<string, string> {
  return {
    title: t(lang, 'label_title'),
    pv_entity: t(lang, 'label_pv_entity'),
    battery_charge_entity: t(lang, 'label_battery_charge_entity'),
    battery_discharge_entity: t(lang, 'label_battery_discharge_entity'),
    grid_import_entity: t(lang, 'label_grid_import_entity'),
    grid_export_entity: t(lang, 'label_grid_export_entity'),
    pv_power_entity: t(lang, 'label_live_pv_power'),
    battery_charge_power_entity: t(lang, 'label_live_charge_power'),
    battery_discharge_power_entity: t(lang, 'label_live_discharge_power'),
    grid_import_power_entity: t(lang, 'label_live_grid_import_power'),
    grid_export_power_entity: t(lang, 'label_live_grid_export_power'),
    default_period: t(lang, 'label_default_period'),
    periods: t(lang, 'label_periods'),
    price_per_kwh: t(lang, 'label_price_per_kwh_cost_tab'),
  };
}

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
        .schema=${getSchema(resolveLang(this.hass.locale.language))}
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
