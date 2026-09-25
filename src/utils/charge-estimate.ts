import type { ForecastPoint } from '../data/forecast';

const HOUR_MS = 60 * 60 * 1000;

/**
 * Simuliert stundenweise vorwärts (Solarprognose minus Grundlast), bis der
 * Restbedarf gedeckt ist, und liefert den geschätzten Zeitpunkt zurück.
 * `null` bedeutet: Die verfügbare Prognose reicht nicht aus, um den Akku
 * voll zu bekommen (z. B. weil es schon Abend ist oder die Prognose nicht
 * weit genug in die Zukunft reicht) – dann lässt sich keine seriöse Aussage
 * treffen, statt eine falsche Zahl zu zeigen.
 *
 * `forecast` sind Stundenwerte (kWh je Stunde, Startzeitpunkt = Stundenbeginn),
 * wie sie `fetchSolarForecast()` liefert. Jede Stunde wird als konstante
 * Erzeugungsrate über die volle Stunde angenommen – für die aktuelle,
 * bereits angebrochene Stunde wird nur der verbleibende Anteil genutzt.
 */
export function estimateFullTime(
  remainingKwh: number,
  baseLoadKw: number,
  forecast: ForecastPoint[],
  now: Date,
): Date | null {
  if (remainingKwh <= 0) {
    return now;
  }

  let remaining = remainingKwh;

  const buckets = forecast
    .map((point) => ({ start: point.time, end: new Date(point.time.getTime() + HOUR_MS), kwh: point.value }))
    .filter((bucket) => bucket.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  for (const bucket of buckets) {
    const effectiveStart = bucket.start.getTime() > now.getTime() ? bucket.start : now;
    const effectiveHours = (bucket.end.getTime() - effectiveStart.getTime()) / HOUR_MS;
    if (effectiveHours <= 0) {
      continue;
    }

    // Konstante Rate über die Stunde angenommen – Grundlast bleibt gleich,
    // egal ob volle oder nur die restliche Stunde betrachtet wird.
    const netRateKw = bucket.kwh - baseLoadKw;
    if (netRateKw <= 0) {
      continue;
    }

    const availableKwh = netRateKw * effectiveHours;
    if (remaining <= availableKwh) {
      const hoursNeeded = remaining / netRateKw;
      return new Date(effectiveStart.getTime() + hoursNeeded * HOUR_MS);
    }
    remaining -= availableKwh;
  }

  return null;
}
