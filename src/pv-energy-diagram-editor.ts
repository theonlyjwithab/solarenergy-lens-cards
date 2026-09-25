import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { HomeAssistant, PvEnergyDiagramConfig } from './types';
import { migrateConfig } from './utils/entities';

// `<ha-form>` ist ein von der HA-Frontend-Anwendung global registriertes
// Custom Element, das aus einem Schema automatisch ein themefähiges Formular
// baut (Entity-Picker, Dropdowns, Zahlenfelder, …). So sparen wir uns eigene
// Formular-Widgets und bekommen HA-typisches Aussehen/Verhalten geschenkt.

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Tag' },
  { value: 'week', label: 'Woche' },
  { value: 'month', label: 'Monat' },
  { value: 'year', label: 'Jahr' },
];

// Standardfarben zur Auswahl; `custom_value: true` am Selector erlaubt trotzdem
// eine frei eingegebene CSS-Farbe (Hex, "orange", …), falls keine der Vorgaben passt.
const BAR_COLOR_OPTIONS = [
  { value: 'var(--primary-color)', label: 'Standard (Theme-Akzentfarbe)' },
  { value: '#03a9f4', label: 'Blau' },
  { value: '#4caf50', label: 'Grün' },
  { value: '#ff9800', label: 'Orange' },
  { value: '#ffc107', label: 'Gelb' },
  { value: '#f44336', label: 'Rot' },
  { value: '#9c27b0', label: 'Lila' },
];

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

const SCHEMA = [
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
  { name: 'default_period', selector: { select: { mode: 'dropdown', options: PERIOD_OPTIONS } } },
  { name: 'periods', selector: { select: { multiple: true, mode: 'list', options: PERIOD_OPTIONS } } },
  {
    name: 'bar_color',
    selector: { select: { mode: 'dropdown', custom_value: true, options: BAR_COLOR_OPTIONS } },
  },
  {
    name: 'height',
    selector: { number: { min: 80, max: 400, step: 10, mode: 'box', unit_of_measurement: 'px' } },
  },
];

const LABELS: Record<string, string> = {
  title: 'Titel',
  price_per_kwh: 'Strompreis (€/kWh)',
  entity_1: 'PV Erzeugung',
  name_1: 'Name 1',
  forecast_1: 'Vorhersage zeigen',
  show_cost_1: 'Kosten zeigen',
  entity_2_charge: 'Akku: Laden (kWh)',
  entity_2_discharge: 'Akku: Entladen (kWh)',
  entity_2_soc: 'Akku: Ladestand (%)',
  name_2: 'Name (Akku)',
  entity_3: 'Entität 3 (optional)',
  name_3: 'Name 3',
  show_cost_3: 'Kosten zeigen',
  entity_4: 'Entität 4 (optional)',
  name_4: 'Name 4',
  show_cost_4: 'Kosten zeigen',
  entity_5: 'Entität 5 (optional)',
  name_5: 'Name 5',
  show_cost_5: 'Kosten zeigen',
  default_period: 'Standard-Zeitraum',
  periods: 'Wählbare Zeiträume',
  bar_color: 'Balkenfarbe',
  height: 'Diagrammhöhe',
};

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
    'pv-energy-diagram-editor': PvEnergyDiagramEditor;
  }
}
