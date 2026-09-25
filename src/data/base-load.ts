import type { HomeAssistant } from '../types';
import { fetchMeanStatistics, type StatBar } from './statistics';

const BASE_LOAD_LOOKBACK_HOURS = 3;

function average(bars: StatBar[]): number {
  return bars.length > 0 ? bars.reduce((sum, bar) => sum + bar.value, 0) / bars.length : 0;
}

/**
 * Grundlast (aktueller Hausverbrauch, kW) gibt es nicht als fertigen Sensor,
 * sondern wird aus dem Mittelwert der letzten Stunden von PV-Erzeugung,
 * Netzbezug, Netzeinspeisung und Batterieleistung berechnet – analog zur
 * Hausbedarf-Berechnung der Flow-Karte, nur mit Momentanleistung (W) statt
 * Periodensumme (kWh), und über mehrere Stunden gemittelt statt eines
 * einzelnen Live-Werts, um kurzzeitige Verbrauchsspitzen (Herd, Wasserkocher)
 * wegzumitteln.
 */
export async function fetchAverageBaseLoadKw(
  hass: HomeAssistant,
  pvPowerEntity: string,
  gridImportPowerEntity: string,
  gridExportPowerEntity: string,
  chargePowerEntity: string,
  dischargePowerEntity: string,
): Promise<number> {
  const end = new Date();
  const start = new Date(end.getTime() - BASE_LOAD_LOOKBACK_HOURS * 60 * 60 * 1000);
  const range = { start, end };

  const [pv, gridImport, gridExport, charge, discharge] = await Promise.all([
    fetchMeanStatistics(hass, pvPowerEntity, range, 'hour'),
    fetchMeanStatistics(hass, gridImportPowerEntity, range, 'hour'),
    fetchMeanStatistics(hass, gridExportPowerEntity, range, 'hour'),
    fetchMeanStatistics(hass, chargePowerEntity, range, 'hour'),
    fetchMeanStatistics(hass, dischargePowerEntity, range, 'hour'),
  ]);

  const baseLoadW =
    average(pv) + average(gridImport) - average(gridExport) - (average(charge) - average(discharge));

  // Kann durch Messrauschen/Mittelung leicht negativ werden, ergibt inhaltlich
  // aber keinen Sinn (negative Grundlast = Haus "verbraucht" negativ) – auf 0
  // begrenzt, analog zum pvDirect-Clamping der Flow-Karte.
  return Math.max(baseLoadW, 0) / 1000;
}
