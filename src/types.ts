// Minimale Typen für den Start – wird in späteren Schritten erweitert
// (z. B. um Statistik- und Forecast-Antworttypen).

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  language: string;
  locale: {
    language: string;
    number_format: string;
    time_format: string;
  };
  config: {
    time_zone: string;
  };
  callWS<T>(msg: Record<string, unknown>): Promise<T>;
}

export type Period = 'day' | 'week' | 'month' | 'year';

export interface PvEnergyDiagramConfig {
  type: string;
  title?: string;
  /** @deprecated Alte Einzel-Entität – wird automatisch nach `entity_1` migriert. */
  entity?: string;
  /** Bis zu 5 feste Entitäts-Slots, zwischen denen per Tabs gewechselt werden kann. */
  entity_1?: string;
  name_1?: string;
  /** Vorhersagelinie für diese Entität zeigen. Fehlt der Wert, gilt `forecast` (Standard: an). */
  forecast_1?: boolean;
  /** Kostenanzeige für diese Entität. Fehlt der Wert, gilt `show_cost` (Standard: an). */
  show_cost_1?: boolean;
  /**
   * Slot 2 ist fest für den Akku reserviert und braucht 3 verschiedene Sensor-Rollen
   * statt einer einzelnen Entität: geladene/entladene Energie (kWh, kumulativ) und
   * Ladestand (%, Momentanwert) für die Ladestand-Linie in der Tagesansicht.
   */
  entity_2_charge?: string;
  entity_2_discharge?: string;
  entity_2_soc?: string;
  name_2?: string;
  entity_3?: string;
  name_3?: string;
  show_cost_3?: boolean;
  entity_4?: string;
  name_4?: string;
  show_cost_4?: boolean;
  entity_5?: string;
  name_5?: string;
  show_cost_5?: boolean;
  /** Zeitraum, mit dem die Karte beim Laden startet. Standard: 'day'. */
  default_period?: Period;
  /** Welche Zeiträume im Dropdown wählbar sind. Standard: alle vier. */
  periods?: Period[];
  /** Fallback für Entitäten ohne eigenes forecast_N-Feld. Standard: an. */
  forecast?: boolean;
  /** CSS-Farbe für die Balken, z. B. "#03a9f4" oder "orange". */
  bar_color?: string;
  /** Diagrammhöhe in Pixel. */
  height?: number;
  /** Strompreis in €/kWh, für eine Kostenanzeige neben der Summe. */
  price_per_kwh?: number;
  /** Kostenanzeige an/aus (nur relevant, wenn price_per_kwh gesetzt ist). Standard: an. */
  show_cost?: boolean;
}

export interface PvBatteryCardConfig {
  type: string;
  title?: string;
  /** Ladestand (%, Momentanwert). */
  soc_entity: string;
  /** Ladeleistung (W, Momentanwert, ≥ 0). */
  charge_power_entity: string;
  /** Entladeleistung (W, Momentanwert, ≥ 0). */
  discharge_power_entity: string;
  /** Batteriekapazität in kWh, für die Ladezeit-Schätzung. */
  battery_capacity_kwh: number;
  /**
   * Grundlast gibt es nicht als fertigen Sensor, sondern wird aus PV-Erzeugung +
   * Netzbezug − Netzeinspeisung − Ladeleistung + Entladeleistung berechnet
   * (analog zur Hausbedarf-Berechnung der Flow-Karte, nur mit Momentanleistung
   * statt Periodensumme). Alle drei Felder optional: Sind sie nicht vollständig
   * gesetzt, zeigt die Karte nur SoC + Live-Leistung ohne Ladezeit-Prognose.
   */
  pv_power_entity?: string;
  grid_import_power_entity?: string;
  grid_export_power_entity?: string;
}

export interface PvEnergyFlowCardConfig {
  type: string;
  title?: string;
  /** PV-Erzeugung gesamt (kWh, total_increasing). */
  pv_entity: string;
  /** In die Batterie geladene Energie (kWh). */
  battery_charge_entity: string;
  /** Aus der Batterie entladene Energie (kWh). */
  battery_discharge_entity: string;
  /** Aus dem Netz bezogene Energie (kWh). */
  grid_import_entity: string;
  /** Ins Netz eingespeiste Energie (kWh). */
  grid_export_entity: string;
  /**
   * Optionale Momentanleistungs-Sensoren (W, state_class measurement) für die
   * Live-Beschriftung direkt auf den Flusslinien (nur Tagesansicht/Energiefluss-
   * Tab, da eine Momentanleistung unabhängig von der Historie ist). Ohne
   * Angabe bleibt die jeweilige Linie unbeschriftet – rein optionale Ergänzung.
   */
  pv_power_entity?: string;
  battery_charge_power_entity?: string;
  battery_discharge_power_entity?: string;
  grid_import_power_entity?: string;
  grid_export_power_entity?: string;
  /** Zeitraum, mit dem die Karte beim Laden startet. Standard: 'day'. */
  default_period?: Period;
  /** Welche Zeiträume im Dropdown wählbar sind. Standard: alle vier. */
  periods?: Period[];
  /** Strompreis in €/kWh. Wenn gesetzt, erscheint ein zweiter Tab "Kosten". */
  price_per_kwh?: number;
}
