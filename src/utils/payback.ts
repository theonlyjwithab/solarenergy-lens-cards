import type { StatBar } from '../data/statistics';
import { getZonedDayBounds, shiftZonedDate, type DateRange } from './time';

const MS_PER_MONTH = 1000 * 60 * 60 * 24 * 30.44;

export interface PaybackRanges {
  /** Vom Kaufdatum bis heute – Grundlage für die kumulierte Gesamt-Ersparnis. */
  lifetime: DateRange;
  /** Die letzten (bis zu) 12 Monate – Grundlage für die rollierende Jahresrate. */
  trailing12: DateRange;
  /**
   * Liegt der Kauf mindestens 12 Monate zurück? Erst dann deckt `trailing12`
   * einen vollen Sommer/Winter-Zyklus ab und die Prognose gilt als
   * verlässlich – sonst bleibt nur eine grobe Lebenszeit-Durchschnitts-
   * Schätzung (siehe `computePaybackTotals`).
   */
  hasFullYear: boolean;
}

export function getPaybackRanges(installDateIso: string, timeZone: string, now: Date = new Date()): PaybackRanges {
  const lifetimeStart = getZonedDayBounds(new Date(installDateIso), timeZone).start;
  const twelveMonthsAgo = shiftZonedDate(now, 'month', -12, timeZone);
  const hasFullYear = twelveMonthsAgo.getTime() >= lifetimeStart.getTime();

  return {
    lifetime: { start: lifetimeStart, end: now },
    trailing12: { start: hasFullYear ? twelveMonthsAgo : lifetimeStart, end: now },
    hasFullYear,
  };
}

export interface PaybackTotals {
  savedEuro: number;
  investmentEuro: number;
  /** Kann > 100 sein, sobald die Anlage bereits amortisiert ist. */
  percent: number;
  remainingEuro: number;
  monthlyRateEuro: number;
  /** Monate bis zur vollständigen Amortisation, 0 falls bereits erreicht. */
  remainingMonths: number;
  /**
   * `true`, solange die Anlage noch keine 12 Monate läuft: Die Monatsrate
   * basiert dann auf dem Lebenszeit-Durchschnitt statt der rollierenden
   * 12-Monats-Rate und berücksichtigt daher keine Sommer/Winter-Schwankung –
   * in der UI entsprechend als grobe Schätzung kennzeichnen.
   */
  isRoughEstimate: boolean;
}

export function computePaybackTotals(params: {
  lifetimeSavedKwh: number;
  trailing12SavedKwh: number;
  pricePerKwh: number;
  investmentEuro: number;
  hasFullYear: boolean;
  lifetimeStart: Date;
  now: Date;
  /** Manuell erfasste Ersparnis vor Beginn der Sensor-Aufzeichnung (€), siehe `PvPaybackCardConfig.initial_saved_offset`. */
  initialOffsetEuro: number;
}): PaybackTotals {
  const { lifetimeSavedKwh, trailing12SavedKwh, pricePerKwh, investmentEuro, hasFullYear, lifetimeStart, now, initialOffsetEuro } =
    params;

  // Der Offset deckt den Zeitraum vor Sensor-Start ab und wird einmalig
  // addiert – er fließt bewusst NICHT in die Monatsrate/Prognose ein, die
  // ausschließlich auf echten (getrackten) Daten basieren soll.
  const savedEuro = lifetimeSavedKwh * pricePerKwh + initialOffsetEuro;
  const remainingEuro = Math.max(investmentEuro - savedEuro, 0);
  const percent = investmentEuro > 0 ? (savedEuro / investmentEuro) * 100 : 0;

  const monthsSinceInstall = (now.getTime() - lifetimeStart.getTime()) / MS_PER_MONTH;
  const monthlyRateEuro = hasFullYear
    ? (trailing12SavedKwh * pricePerKwh) / 12
    : monthsSinceInstall > 0
      ? savedEuro / monthsSinceInstall
      : 0;

  const remainingMonths = monthlyRateEuro > 0 ? remainingEuro / monthlyRateEuro : 0;

  return {
    savedEuro,
    investmentEuro,
    percent,
    remainingEuro,
    monthlyRateEuro,
    remainingMonths,
    isRoughEstimate: !hasFullYear,
  };
}

/** Ein Punkt im Verlaufsdiagramm: kumulierte Ersparnis (€) zu einem Zeitpunkt. */
export interface SavingsPoint {
  date: Date;
  cumulativeSavedEuro: number;
}

/**
 * Baut die kumulierte Ersparnis-Kurve aus den monatlichen Bucket-Werten der
 * 4 Entitäten (PV, Laden, Entladen, Einspeisung – Netzbezug wird für "Gespart"
 * nicht gebraucht, siehe Berechnung in CLAUDE.md). Die Bucket-Listen können
 * unterschiedlich lang sein, falls eine Entität später als die anderen erst
 * in HA erfasst wurde – deshalb wird über die Vereinigung aller Bucket-Start-
 * zeitpunkte iteriert statt über einen fixen Index, fehlende Werte zählen
 * als 0 (kein Beitrag in diesem Monat).
 */
export function buildCumulativeSavings(params: {
  pvBars: StatBar[];
  chargeBars: StatBar[];
  dischargeBars: StatBar[];
  exportBars: StatBar[];
  pricePerKwh: number;
  initialOffsetEuro: number;
}): SavingsPoint[] {
  const { pvBars, chargeBars, dischargeBars, exportBars, pricePerKwh, initialOffsetEuro } = params;

  const starts = new Set<number>();
  for (const bars of [pvBars, chargeBars, dischargeBars, exportBars]) {
    for (const bar of bars) {
      starts.add(bar.start.getTime());
    }
  }
  const sortedStarts = Array.from(starts).sort((a, b) => a - b);

  const byStart = (bars: StatBar[]): Map<number, number> => new Map(bars.map((bar) => [bar.start.getTime(), bar.value]));
  const pvMap = byStart(pvBars);
  const chargeMap = byStart(chargeBars);
  const dischargeMap = byStart(dischargeBars);
  const exportMap = byStart(exportBars);

  let cumulative = initialOffsetEuro;
  return sortedStarts.map((ts) => {
    const pv = pvMap.get(ts) ?? 0;
    const charge = chargeMap.get(ts) ?? 0;
    const discharge = dischargeMap.get(ts) ?? 0;
    const gridExport = exportMap.get(ts) ?? 0;
    const pvDirect = Math.max(pv - charge - gridExport, 0);
    const savedKwh = pvDirect + discharge;
    cumulative += savedKwh * pricePerKwh;
    return { date: new Date(ts), cumulativeSavedEuro: cumulative };
  });
}

/** Schätzt den Amortisations-Zeitpunkt aus der verbleibenden Monatszahl (kann Nachkommastellen haben). */
export function estimatePayoffDate(now: Date, remainingMonths: number): Date {
  return new Date(now.getTime() + remainingMonths * MS_PER_MONTH);
}
