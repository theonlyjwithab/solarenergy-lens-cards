import type { HomeAssistant } from '../types';
import type { StatBar } from './statistics';

// Antwortformat von `energy/solar_forecast`: pro Config-Entry (z. B. eine
// Forecast.Solar-Instanz) ein Objekt mit Wh-Werten je Stunde. Es gibt keine
// Zeitraum-Parameter – die Prognose bezieht sich immer auf "jetzt" (heute/
// nahe Zukunft), nicht auf einen frei wählbaren Tag in der Vergangenheit.
interface SolarForecastEntry {
  wh_hours: Record<string, number>;
}

type SolarForecastResult = Record<string, SolarForecastEntry>;

export interface ForecastPoint {
  time: Date;
  value: number; // kWh
}

/**
 * Holt die Solarprognose und summiert alle konfigurierten Quellen (z. B.
 * mehrere Forecast.Solar-Einträge für unterschiedlich ausgerichtete
 * Modulflächen) zu einer einzigen Zeitreihe in kWh.
 */
export async function fetchSolarForecast(hass: HomeAssistant): Promise<ForecastPoint[]> {
  const result = await hass.callWS<SolarForecastResult>({ type: 'energy/solar_forecast' });

  const totalsByHour = new Map<string, number>();
  for (const entry of Object.values(result)) {
    for (const [isoTime, wh] of Object.entries(entry.wh_hours)) {
      totalsByHour.set(isoTime, (totalsByHour.get(isoTime) ?? 0) + wh);
    }
  }

  return Array.from(totalsByHour.entries())
    .map(([isoTime, wh]) => ({ time: new Date(isoTime), value: wh / 1000 }))
    .sort((a, b) => a.time.getTime() - b.time.getTime());
}

/**
 * Ordnet Prognosepunkte den Stundenbalken der Tagesansicht zu. `null`
 * bedeutet: für diese Stunde liegt keine Prognose vor (z. B. weil sie schon
 * vergangen ist oder die Prognose nicht so weit reicht).
 */
export function alignForecastToBars(bars: StatBar[], forecast: ForecastPoint[]): Array<number | null> {
  return bars.map((bar) => {
    const matches = forecast.filter((point) => point.time >= bar.start && point.time < bar.end);
    if (matches.length === 0) {
      return null;
    }
    return matches.reduce((sum, point) => sum + point.value, 0);
  });
}
