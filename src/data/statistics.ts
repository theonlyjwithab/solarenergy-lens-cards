import type { HomeAssistant } from '../types';
import type { DateRange } from '../utils/time';

// Antwortformat von `recorder/statistics_during_period` bei types: ['change'].
// Pro Statistik-ID ein Array von Zeitfenstern mit dem jeweiligen Zuwachs.
interface StatisticsDuringPeriodEntry {
  start: number; // Unix-Zeitstempel in ms
  end: number;
  change: number | null;
}

type StatisticsDuringPeriodResult = Record<string, StatisticsDuringPeriodEntry[]>;

// Antwortformat bei types: ['mean'] – für fluktuierende Momentanwerte (z. B.
// Ladestand in %), im Unterschied zum kumulativen "change" oben.
interface StatisticsDuringPeriodMeanEntry {
  start: number;
  end: number;
  mean: number | null;
}

type StatisticsDuringPeriodMeanResult = Record<string, StatisticsDuringPeriodMeanEntry[]>;

/** Bucket-Größe, in der der Recorder die Werte zusammenfasst. */
export type RecorderPeriod = 'hour' | 'day' | 'month';

export interface StatBar {
  start: Date;
  end: Date;
  value: number; // kWh (fetchStatistics) bzw. % (fetchMeanStatistics) in diesem Zeitfenster
}

/**
 * Holt Erzeugungswerte (kWh je Bucket) für eine Entität im angegebenen
 * Zeitraum über die Recorder-Websocket-API. `recorderPeriod` bestimmt die
 * Bucket-Größe (Stunde/Tag/Monat) je nach gewählter Ansicht.
 */
export async function fetchStatistics(
  hass: HomeAssistant,
  entityId: string,
  range: DateRange,
  recorderPeriod: RecorderPeriod,
): Promise<StatBar[]> {
  const result = await hass.callWS<StatisticsDuringPeriodResult>({
    type: 'recorder/statistics_during_period',
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: [entityId],
    period: recorderPeriod,
    types: ['change'],
    // Ohne explizite Einheit liefert der Recorder die Werte in der Einheit,
    // in der die Statistik ursprünglich gespeichert wurde (z. B. Wh statt
    // kWh, je nach Sensor) – wir beschriften aber überall fix mit "kWh".
    // Das fordert dieselbe Umrechnung an, die auch das eingebaute
    // HA-Energie-Dashboard nutzt.
    units: { energy: 'kWh' },
  });

  const entries = result[entityId] ?? [];

  return entries.map((entry) => ({
    start: new Date(entry.start),
    end: new Date(entry.end),
    value: entry.change ?? 0,
  }));
}

/**
 * Holt einen Momentanwert (z. B. Akku-Ladestand in %) als stündlichen
 * Durchschnitt (`types: ['mean']`) statt als kumulativen Zuwachs – für
 * `state_class: measurement`-Sensoren ist "change" nicht sinnvoll, da sie
 * schwankende Werte statt eines monoton wachsenden Zählers liefern.
 */
export async function fetchMeanStatistics(
  hass: HomeAssistant,
  entityId: string,
  range: DateRange,
  recorderPeriod: RecorderPeriod,
): Promise<StatBar[]> {
  const result = await hass.callWS<StatisticsDuringPeriodMeanResult>({
    type: 'recorder/statistics_during_period',
    start_time: range.start.toISOString(),
    end_time: range.end.toISOString(),
    statistic_ids: [entityId],
    period: recorderPeriod,
    types: ['mean'],
  });

  const entries = result[entityId] ?? [];

  return entries.map((entry) => ({
    start: new Date(entry.start),
    end: new Date(entry.end),
    value: entry.mean ?? 0,
  }));
}

/**
 * Füllt eine Stunden-Serie auf den vollen Bereich auf (z. B. 24 Balken für
 * einen Tag), auch wenn der Recorder für noch nicht vergangene Stunden
 * naturgemäß keine Daten liefert. Ohne das würde die Tagesansicht des
 * heutigen Tages am aktuellen Zeitpunkt enden – dadurch gäbe es keine
 * x-Achsen-Spalten mehr, in die die Prognoselinie für die restlichen
 * Stunden des Tages gezeichnet werden könnte.
 */
export function padHourlyBars(bars: StatBar[], range: DateRange): StatBar[] {
  const hourMs = 60 * 60 * 1000;
  const hourCount = Math.round((range.end.getTime() - range.start.getTime()) / hourMs);
  const byStart = new Map(bars.map((bar) => [bar.start.getTime(), bar]));

  return Array.from({ length: hourCount }, (_, index) => {
    const start = new Date(range.start.getTime() + index * hourMs);
    const existing = byStart.get(start.getTime());
    if (existing) {
      return existing;
    }
    return { start, end: new Date(start.getTime() + hourMs), value: 0 };
  });
}
