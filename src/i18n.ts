/**
 * Zentrales Übersetzungs-Wörterbuch für alle 3 Karten (PV Energy Diagram,
 * PV Energy Flow Card, PV Battery Card) + geteilte Module (Header, Charts,
 * Editoren). Sprache wird **ausschließlich automatisch** aus der
 * HA-Oberflächensprache (`hass.locale.language`) abgeleitet – bewusst kein
 * Config-Feld dafür (Nutzerentscheidung), da die Karten ohnehin in derselben
 * Sprache wie der Rest von Home Assistant angezeigt werden sollen.
 *
 * Nur Deutsch/Englisch gepflegt: nur Deutsch (bzw. "de-*") liefert die
 * deutschen Texte, jede andere HA-Sprache (Englisch, aber auch z. B.
 * Französisch oder Spanisch) fällt auf Englisch zurück.
 */

export type Lang = 'de' | 'en';

/** `hass.locale.language` ist z. B. "de", "de-DE", "en", "en-GB", "fr", … */
export function resolveLang(languageCode: string | undefined | null): Lang {
  return languageCode?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

const de = {
  period_day: 'Tag',
  period_week: 'Woche',
  period_month: 'Monat',
  period_year: 'Jahr',
  nav_back: 'Zurück',
  nav_now: 'Jetzt',
  nav_forward: 'Vor',

  loading: 'Lade Daten…',
  error_prefix: 'Fehler: {message}',

  config_error_at_least_one_entity: 'Bitte mindestens eine Entität in der Kartenkonfiguration angeben.',
  config_error_missing_entities: 'Bitte folgende Entitäten in der Kartenkonfiguration angeben: {fields}.',
  config_error_missing_fields: 'Bitte folgende Felder in der Kartenkonfiguration angeben: {fields}.',

  tab_battery_fallback: 'Akku',
  total_charged: 'Geladen: {value} kWh',
  total_discharged: 'Entladen: {value} kWh',

  tooltip_generation: 'Erzeugung',
  tooltip_forecast: 'Vorhersage',
  tooltip_cost: 'Kosten',
  tooltip_charged: 'Geladen',
  tooltip_discharged: 'Entladen',
  tooltip_soc: 'Ladestand',

  stub_title_solar: 'Solar',
  stub_title_flow: 'Energiefluss',
  stub_title_battery: 'Akkustand',
  stub_title_payback: 'Amortisation',
  payback_hero_suffix: 'amortisiert',
  payback_label_saved: 'Gespart',
  payback_of_investment: 'von {value}',
  payback_label_remaining: 'Restbetrag',
  payback_label_monthly_rate: 'Ø pro Monat',
  payback_paid_off_since: 'Amortisiert seit {date}',
  payback_estimated_payoff: 'Voraussichtlich amortisiert: {date}',
  payback_rough_estimate_note: 'Grobe Schätzung – noch keine 12 Monate Daten',
  payback_investment_axis_label: 'Investition',
  label_investment_cost: 'Anschaffungskosten (€)',
  label_install_date: 'Kauf-/Inbetriebnahmedatum',
  label_initial_saved_offset: 'Bereits gespart vor Sensor-Start (€, optional)',

  tab_flow: 'Energiefluss',
  tab_cost: 'Kosten',

  flow_pv: 'PV',
  flow_generation: 'Erzeugung',
  flow_charged: 'geladen',
  flow_consumed: 'verbraucht',
  flow_exported: 'eingespeist',
  flow_storage: 'Speicher',
  flow_discharged: 'entladen {value}',
  flow_grid: 'Netz',
  flow_imported: 'bezogen {value}',
  flow_household_demand: 'Hausbedarf',
  flow_legend_pv_direct: 'PV-Direktverbrauch',
  flow_legend_from_storage: 'aus Speicher',
  flow_legend_from_grid: 'aus Netz',

  color_default: 'Standard (Theme-Akzentfarbe)',
  color_blue: 'Blau',
  color_green: 'Grün',
  color_orange: 'Orange',
  color_yellow: 'Gelb',
  color_red: 'Rot',
  color_purple: 'Lila',

  label_title: 'Titel',
  label_price_per_kwh: 'Strompreis (€/kWh)',
  label_price_per_kwh_cost_tab: 'Strompreis (für Kosten/Ersparnis-Tab)',
  label_entity_1: 'PV Erzeugung',
  label_name_n: 'Name {n}',
  label_forecast: 'Vorhersage zeigen',
  label_show_cost: 'Kosten zeigen',
  label_battery_charge_kwh: 'Akku: Laden (kWh)',
  label_battery_discharge_kwh: 'Akku: Entladen (kWh)',
  label_battery_soc_pct: 'Akku: Ladestand (%)',
  label_name_battery: 'Name (Akku)',
  label_entity_n_optional: 'Entität {n} (optional)',
  label_default_period: 'Standard-Zeitraum',
  label_periods: 'Wählbare Zeiträume',
  label_bar_color: 'Balkenfarbe',
  label_height: 'Diagrammhöhe',

  label_pv_entity: 'PV-Erzeugung',
  label_battery_charge_entity: 'Batterie laden',
  label_battery_discharge_entity: 'Batterie entladen',
  label_grid_import_entity: 'Netzbezug',
  label_grid_export_entity: 'Netzeinspeisung',
  label_live_pv_power: 'Live-Leistung PV (W, optional)',
  label_live_charge_power: 'Live-Leistung Laden (W, optional)',
  label_live_discharge_power: 'Live-Leistung Entladen (W, optional)',
  label_live_grid_import_power: 'Live-Leistung Netzbezug (W, optional)',
  label_live_grid_export_power: 'Live-Leistung Einspeisung (W, optional)',

  label_soc_entity: 'Ladestand (%)',
  label_charge_power_entity: 'Ladeleistung (W)',
  label_discharge_power_entity: 'Entladeleistung (W)',
  label_battery_capacity: 'Batteriekapazität (kWh)',
  label_pv_power_forecast: 'PV-Erzeugungsleistung (W, optional – für Ladezeit-Prognose)',
  label_grid_import_power_forecast: 'Netzbezug-Leistung (W, optional – für Ladezeit-Prognose)',
  label_grid_export_power_forecast: 'Netzeinspeise-Leistung (W, optional – für Ladezeit-Prognose)',

  idle_state: 'Im Ruhezustand',
  charging_suffix: '{value} W lädt',
  discharging_suffix: '{value} W entlädt',
  battery_full: 'Akku voll',
  no_more_charging_expected: 'Kein Aufladen mehr innerhalb der Prognose erwartet',
  full_at_prefix: 'Voll ca. {time}',
  no_data: 'Keine Daten',
  time_suffix_hour: '{time} Uhr',
} as const;

const en: Record<keyof typeof de, string> = {
  period_day: 'Day',
  period_week: 'Week',
  period_month: 'Month',
  period_year: 'Year',
  nav_back: 'Back',
  nav_now: 'Now',
  nav_forward: 'Forward',

  loading: 'Loading data…',
  error_prefix: 'Error: {message}',

  config_error_at_least_one_entity: 'Please specify at least one entity in the card configuration.',
  config_error_missing_entities: 'Please specify the following entities in the card configuration: {fields}.',
  config_error_missing_fields: 'Please specify the following fields in the card configuration: {fields}.',

  tab_battery_fallback: 'Battery',
  total_charged: 'Charged: {value} kWh',
  total_discharged: 'Discharged: {value} kWh',

  tooltip_generation: 'Generation',
  tooltip_forecast: 'Forecast',
  tooltip_cost: 'Cost',
  tooltip_charged: 'Charged',
  tooltip_discharged: 'Discharged',
  tooltip_soc: 'State of charge',

  stub_title_solar: 'Solar',
  stub_title_flow: 'Energy flow',
  stub_title_battery: 'Battery status',
  stub_title_payback: 'Payback',
  payback_hero_suffix: 'paid back',
  payback_label_saved: 'Saved',
  payback_of_investment: 'of {value}',
  payback_label_remaining: 'Remaining amount',
  payback_label_monthly_rate: 'Avg. per month',
  payback_paid_off_since: 'Paid off since {date}',
  payback_estimated_payoff: 'Estimated payoff: {date}',
  payback_rough_estimate_note: 'Rough estimate – less than 12 months of data yet',
  payback_investment_axis_label: 'Investment',
  label_investment_cost: 'Investment cost (€)',
  label_install_date: 'Purchase / install date',
  label_initial_saved_offset: 'Already saved before sensor tracking started (€, optional)',

  tab_flow: 'Energy flow',
  tab_cost: 'Cost',

  flow_pv: 'PV',
  flow_generation: 'Generation',
  flow_charged: 'charged',
  flow_consumed: 'consumed',
  flow_exported: 'exported',
  flow_storage: 'Battery',
  flow_discharged: 'discharged {value}',
  flow_grid: 'Grid',
  flow_imported: 'imported {value}',
  flow_household_demand: 'Household demand',
  flow_legend_pv_direct: 'Direct PV use',
  flow_legend_from_storage: 'from battery',
  flow_legend_from_grid: 'from grid',

  color_default: 'Default (theme accent color)',
  color_blue: 'Blue',
  color_green: 'Green',
  color_orange: 'Orange',
  color_yellow: 'Yellow',
  color_red: 'Red',
  color_purple: 'Purple',

  label_title: 'Title',
  label_price_per_kwh: 'Electricity price (€/kWh)',
  label_price_per_kwh_cost_tab: 'Electricity price (for cost/savings tab)',
  label_entity_1: 'PV generation',
  label_name_n: 'Name {n}',
  label_forecast: 'Show forecast',
  label_show_cost: 'Show cost',
  label_battery_charge_kwh: 'Battery: charging (kWh)',
  label_battery_discharge_kwh: 'Battery: discharging (kWh)',
  label_battery_soc_pct: 'Battery: state of charge (%)',
  label_name_battery: 'Name (battery)',
  label_entity_n_optional: 'Entity {n} (optional)',
  label_default_period: 'Default period',
  label_periods: 'Selectable periods',
  label_bar_color: 'Bar color',
  label_height: 'Chart height',

  label_pv_entity: 'PV generation',
  label_battery_charge_entity: 'Battery charging',
  label_battery_discharge_entity: 'Battery discharging',
  label_grid_import_entity: 'Grid import',
  label_grid_export_entity: 'Grid export',
  label_live_pv_power: 'Live power PV (W, optional)',
  label_live_charge_power: 'Live power charging (W, optional)',
  label_live_discharge_power: 'Live power discharging (W, optional)',
  label_live_grid_import_power: 'Live power grid import (W, optional)',
  label_live_grid_export_power: 'Live power grid export (W, optional)',

  label_soc_entity: 'State of charge (%)',
  label_charge_power_entity: 'Charging power (W)',
  label_discharge_power_entity: 'Discharging power (W)',
  label_battery_capacity: 'Battery capacity (kWh)',
  label_pv_power_forecast: 'PV generation power (W, optional – for charge time forecast)',
  label_grid_import_power_forecast: 'Grid import power (W, optional – for charge time forecast)',
  label_grid_export_power_forecast: 'Grid export power (W, optional – for charge time forecast)',

  idle_state: 'Idle',
  charging_suffix: '{value} W charging',
  discharging_suffix: '{value} W discharging',
  battery_full: 'Battery full',
  no_more_charging_expected: 'No further charging expected within the forecast',
  full_at_prefix: 'Full at approx. {time}',
  no_data: 'No data',
  time_suffix_hour: '{time}',
};

const DICTS: Record<Lang, Record<keyof typeof de, string>> = { de, en };

export type TranslationKey = keyof typeof de;

export function t(lang: Lang, key: TranslationKey, vars?: Record<string, string | number>): string {
  let text = DICTS[lang][key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
