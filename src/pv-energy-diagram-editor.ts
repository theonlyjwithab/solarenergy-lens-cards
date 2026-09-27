import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvEnergyDiagramConfig } from './types';
import { migrateConfig } from './utils/entities';
import { resolveLang, t, type Lang } from './i18n';

// `<ha-form>` ist ein von der HA-Frontend-Anwendung global registriertes
// Custom Element, das aus einem Schema automatisch ein themefähiges Formular
// baut (Entity-Picker, Dropdowns, Zahlenfelder, …). So sparen wir uns eigene
// Formular-Widgets und bekommen HA-typisches Aussehen/Verhalten geschenkt.

function getPeriodOptions(lang: Lang) {
  return [
    { value: 'day', label: t(lang, 'period_day') },
    { value: 'week', label: t(lang, 'period_week') },
    { value: 'month', label: t(lang, 'period_month') },
    { value: 'year', label: t(lang, 'period_year') },
  ];
}

// Standardfarben zur Auswahl; `custom_value: true` am Selector erlaubt trotzdem
// eine frei eingegebene CSS-Farbe (Hex, "orange", …), falls keine der Vorgaben passt.
function getBarColorOptions(lang: Lang) {
  return [
    { value: 'var(--primary-color)', label: t(lang, 'color_default') },
    { value: '#03a9f4', label: t(lang, 'color_blue') },
    { value: '#4caf50', label: t(lang, 'color_green') },
    { value: '#ff9800', label: t(lang, 'color_orange') },
    { value: '#ffc107', label: t(lang, 'color_yellow') },
    { value: '#f44336', label: t(lang, 'color_red') },
    { value: '#9c27b0', label: t(lang, 'color_purple') },
  ];
}

// Feste Anzahl Entitäts-Slots statt einer frei erweiterbaren Liste – ha-form
// unterstützt keine dynamischen Listen von Objekten, dafür bräuchte es eine
// komplett eigene Mini-Oberfläche. 5 Slots decken den Bedarf (z. B. mehrere
// Wechselrichter/Strings) ab und lassen sich bei Bedarf leicht erhöhen.
// Die Vorhersage-Checkbox gibt es bewusst nur bei Slot 1 (PV Erzeugung) – eine
// Solarprognose ergibt für andere Entitäten inhaltlich keinen Sinn.
function entitySlotSchema(index: 1 | 3 | 4 | 5) {
  return [
    {
      name: '',
      type: 'grid' as const,
      schema: [
        { name: `entity_${index}`, selector: { entity: { domain: 'sensor' } } },
        { name: `name_${index}`, selector: { text: {} } },
      ],
    },
    index === 1
      ? {
          name: '',
          type: 'grid' as const,
          schema: [
            { name: 'forecast_1', selector: { boolean: {} } },
            { name: 'show_cost_1', selector: { boolean: {} } },
          ],
        }
      : { name: `show_cost_${index}`, selector: { boolean: {} } },
  ];
}

// Slot 2 ist fest für den Akku reserviert: 3 Sensor-Rollen statt einer
// einzelnen Entität (siehe Entscheidung in CLAUDE.md).
const BATTERY_SLOT_SCHEMA = [
  {
    name: '',
    type: 'grid' as const,
    schema: [
      { name: 'entity_2_charge', selector: { entity: { domain: 'sensor' } } },
      { name: 'entity_2_discharge', selector: { entity: { domain: 'sensor' } } },
    ],
  },
  {
    name: '',
    type: 'grid' as const,
    schema: [
      { name: 'entity_2_soc', selector: { entity: { domain: 'sensor' } } },
      { name: 'name_2', selector: { text: {} } },
    ],
  },
];

function getSchema(lang: Lang) {
  const periodOptions = getPeriodOptions(lang);
  const barColorOptions = getBarColorOptions(lang);
  return [
    { name: 'title', selector: { text: {} } },
    {
      name: 'price_per_kwh',
      selector: { number: { min: 0, step: 0.01, mode: 'box', unit_of_measurement: '€/kWh' } },
    },
    ...entitySlotSchema(1),
    ...BATTERY_SLOT_SCHEMA,
    ...entitySlotSchema(3),
    ...entitySlotSchema(4),
    ...entitySlotSchema(5),
    { name: 'default_period', selector: { select: { mode: 'dropdown', options: periodOptions } } },
    { name: 'periods', selector: { select: { multiple: true, mode: 'list', options: periodOptions } } },
    {
      name: 'bar_color',
      selector: { select: { mode: 'dropdown', custom_value: true, options: barColorOptions } },
    },
    {
      name: 'height',
      selector: { number: { min: 80, max: 400, step: 10, mode: 'box', unit_of_measurement: 'px' } },
    },
  ];
}

function getLabels(lang: Lang): Record<string, string> {
  const showCost = t(lang, 'label_show_cost');
  return {
    title: t(lang, 'label_title'),
    price_per_kwh: t(lang, 'label_price_per_kwh'),
    entity_1: t(lang, 'label_entity_1'),
    name_1: t(lang, 'label_name_n', { n: 1 }),
    forecast_1: t(lang, 'label_forecast'),
    show_cost_1: showCost,
    entity_2_charge: t(lang, 'label_battery_charge_kwh'),
    entity_2_discharge: t(lang, 'label_battery_discharge_kwh'),
    entity_2_soc: t(lang, 'label_battery_soc_pct'),
    name_2: t(lang, 'label_name_battery'),
    entity_3: t(lang, 'label_entity_n_optional', { n: 3 }),
    name_3: t(lang, 'label_name_n', { n: 3 }),
    show_cost_3: showCost,
    entity_4: t(lang, 'label_entity_n_optional', { n: 4 }),
    name_4: t(lang, 'label_name_n', { n: 4 }),
    show_cost_4: showCost,
    entity_5: t(lang, 'label_entity_n_optional', { n: 5 }),
    name_5: t(lang, 'label_name_n', { n: 5 }),
    show_cost_5: showCost,
    default_period: t(lang, 'label_default_period'),
    periods: t(lang, 'label_periods'),
    bar_color: t(lang, 'label_bar_color'),
    height: t(lang, 'label_height'),
  };
}

interface HaFormValueChangedDetail {
  value: PvEnergyDiagramConfig;
}

@customElement('pv-energy-diagram-editor')
export class PvEnergyDiagramEditor extends LitElement {
  @property({ attribute: false }) public hass?: HomeAssistant;

  @state() private _config?: PvEnergyDiagramConfig;

  public setConfig(config: PvEnergyDiagramConfig): void {
    this._config = migrateConfig(config);
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
    'pv-energy-diagram-editor': PvEnergyDiagramEditor;
  }
}
