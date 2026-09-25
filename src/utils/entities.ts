import type { PvEnergyDiagramConfig } from '../types';

export interface EntitySlot {
  kind: 'entity';
  entity: string;
  name?: string;
  /** Aufgelöst inkl. Fallback auf das globale `forecast`-Feld (Standard: an). Nur bei Slot 1 relevant. */
  forecast: boolean;
  /** Aufgelöst inkl. Fallback auf das globale `show_cost`-Feld (Standard: an). */
  showCost: boolean;
}

/**
 * Slot 2 ist fest für den Akku reserviert: geladene/entladene Energie (kWh) plus
 * optional der Ladestand (%) für die Linie in der Tagesansicht. Anders als bei
 * `EntitySlot` gibt es hier keine Vorhersage/Kostenanzeige – ein "Total" macht bei
 * zwei getrennten Flüssen (Laden/Entladen) ohne festgelegte Vorzeichen-Konvention
 * keinen eindeutigen Sinn.
 */
export interface BatterySlot {
  kind: 'battery';
  name?: string;
  chargeEntity?: string;
  dischargeEntity?: string;
  socEntity?: string;
}

export type Slot = EntitySlot | BatterySlot;

/**
 * Wandelt eine alte Einzel-Entity-Config (`entity: "sensor.x"`) einmalig in
 * das neue Slot-Format um (`entity_1`), damit bestehende Karten nach dem
 * Update weiterlaufen, ohne dass man die YAML von Hand anpassen muss.
 *
 * Befüllt außerdem `forecast_1`/`show_cost_N` mit ihrem tatsächlichen
 * Standardwert, sobald die zugehörige Entität bzw. der Preis gesetzt ist.
 * Grund: Eine Checkbox mit Wert `undefined` zeigt sich im Editor als
 * "aus" an, obwohl unsere Logik `undefined` bisher als "an" (Standard)
 * behandelt hat – das sah für Nutzer wie ein Bug aus ("Haken ist weg, aber
 * Prognose wird trotzdem angezeigt"). Nach der Migration ist der Wert immer
 * explizit gesetzt, die Checkbox zeigt also den echten Zustand.
 */
export function migrateConfig(config: PvEnergyDiagramConfig): PvEnergyDiagramConfig {
  let migrated = config;
  if (migrated.entity && !migrated.entity_1) {
    migrated = { ...migrated, entity_1: migrated.entity };
  }

  const forecastDefault = migrated.forecast ?? true;
  const showCostDefault = migrated.show_cost ?? true;
  const hasPrice = migrated.price_per_kwh != null;
  const patch: Partial<PvEnergyDiagramConfig> = {};

  if (migrated.entity_1) {
    if (migrated.forecast_1 === undefined) patch.forecast_1 = forecastDefault;
    if (hasPrice && migrated.show_cost_1 === undefined) patch.show_cost_1 = showCostDefault;
  }
  if (migrated.entity_3 && hasPrice && migrated.show_cost_3 === undefined) {
    patch.show_cost_3 = showCostDefault;
  }
  if (migrated.entity_4 && hasPrice && migrated.show_cost_4 === undefined) {
    patch.show_cost_4 = showCostDefault;
  }
  if (migrated.entity_5 && hasPrice && migrated.show_cost_5 === undefined) {
    patch.show_cost_5 = showCostDefault;
  }

  return Object.keys(patch).length > 0 ? { ...migrated, ...patch } : migrated;
}

/**
 * Liefert die belegten Slots in fester Reihenfolge (1 = PV-Erzeugung, 2 = Akku,
 * 3–5 = weitere Entitäten). Leere Slots werden herausgefiltert – Slot 2 gilt als
 * leer, wenn keines der 3 Akku-Felder gesetzt ist.
 */
export function getSlots(config: PvEnergyDiagramConfig): Slot[] {
  const slots: Slot[] = [];

  if (config.entity_1) {
    slots.push({
      kind: 'entity',
      entity: config.entity_1,
      name: config.name_1,
      forecast: config.forecast_1 ?? config.forecast ?? true,
      showCost: config.show_cost_1 ?? config.show_cost ?? true,
    });
  }

  if (config.entity_2_charge || config.entity_2_discharge || config.entity_2_soc) {
    slots.push({
      kind: 'battery',
      name: config.name_2,
      chargeEntity: config.entity_2_charge,
      dischargeEntity: config.entity_2_discharge,
      socEntity: config.entity_2_soc,
    });
  }

  if (config.entity_3) {
    slots.push({
      kind: 'entity',
      entity: config.entity_3,
      name: config.name_3,
      forecast: false,
      showCost: config.show_cost_3 ?? config.show_cost ?? true,
    });
  }
  if (config.entity_4) {
    slots.push({
      kind: 'entity',
      entity: config.entity_4,
      name: config.name_4,
      forecast: false,
      showCost: config.show_cost_4 ?? config.show_cost ?? true,
    });
  }
  if (config.entity_5) {
    slots.push({
      kind: 'entity',
      entity: config.entity_5,
      name: config.name_5,
      forecast: false,
      showCost: config.show_cost_5 ?? config.show_cost ?? true,
    });
  }

  return slots;
}
