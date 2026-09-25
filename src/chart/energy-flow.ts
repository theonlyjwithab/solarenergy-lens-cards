import { svg, nothing, type SVGTemplateResult } from 'lit';

export interface EnergyFlowTotals {
  pv: number;
  charge: number;
  discharge: number;
  gridImport: number;
  gridExport: number;
  /** Berechnet: PV − Laden − Einspeisung, auf 0 begrenzt. */
  pvDirect: number;
  /** Berechnet: PV-Direktverbrauch + Entladen + Netzbezug. */
  hausbedarf: number;
}

export const ENERGY_FLOW_VIEW_WIDTH = 320;
export const ENERGY_FLOW_VIEW_HEIGHT = 620;

const RING_RADIUS = 62;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const MIN_STROKE = 4;
const MAX_STROKE = 20;

/** Lücke zwischen den 3 Ring-Segmenten (in Umfangs-Einheiten), für den
 * "getrennten Kreisbögen"-Look statt einem durchgehenden Ring. */
const RING_GAP = 4;

/** Radius der wandernden Energie-Kugel auf den Flusslinien. */
const FLOW_DOT_RADIUS = 4.5;
/** Nur ab dieser Momentanleistung (W) wird überhaupt eine Kugel angezeigt –
 * die Kugel bildet die *aktuell* fließende Leistung ab, nicht die
 * Perioden-Summe (die auch bei 0 W gerade jetzt > 0 sein kann, wenn im
 * Tagesverlauf schon mal etwas floss). Ohne konfigurierte
 * Leistungs-Entitäten (kein `live`) wird daher gar keine Kugel gezeigt. */
const FLOW_DOT_MIN_WATTS = 1;

function strokeWidthFor(value: number, maxValue: number): number {
  if (maxValue <= 0) {
    return MIN_STROKE;
  }
  return MIN_STROKE + (Math.max(value, 0) / maxValue) * (MAX_STROKE - MIN_STROKE);
}

/** Je stärker der Fluss relativ zum stärksten der 5 Flüsse, desto schneller
 * wandert die Kugel (2,5s schnellster, 5s schwächster spürbarer Fluss). */
function flowDotDuration(value: number, maxValue: number): string {
  const ratio = maxValue > 0 ? Math.min(Math.max(value, 0) / maxValue, 1) : 0;
  return (5 - ratio * 2.5).toFixed(2);
}

/** Wandernde Kugel entlang eines Flusspfads (`pathId` = dessen `id`),
 * nur gerendert falls dort gerade (Momentanleistung) nennenswert Energie
 * fließt. Heller Kern + farbiger Rand statt Volltonfarbe wie die Linie
 * selbst – sonst kaum von der gleichfarbigen, oft dickeren Linie zu
 * unterscheiden. */
function renderFlowDot(pathId: string, color: string, watts: number | undefined, maxWatts: number): SVGTemplateResult | typeof nothing {
  if (watts === undefined || watts < FLOW_DOT_MIN_WATTS) {
    return nothing;
  }
  return svg`
    <circle
      r="${FLOW_DOT_RADIUS}"
      fill="var(--primary-text-color)"
      stroke="${color}"
      stroke-width="2"
      style="color: ${color}"
      class="efc-flow-dot"
    >
      <animateMotion dur="${flowDotDuration(watts, maxWatts)}s" repeatCount="indefinite">
        <mpath href="#${pathId}" />
      </animateMotion>
    </circle>
  `;
}

export function formatKwh(value: number, locale: string): string {
  const number = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value);
  return `${number} kWh`;
}

export function formatWatts(value: number, locale: string): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  return `${number} W`;
}

/**
 * Momentanleistung (W) je Fluss, für die Live-Beschriftung direkt auf den
 * Pfaden. Jedes Feld ist einzeln optional: anders als bei `EnergyFlowTotals`
 * (Historie, immer alle 5 Sensoren nötig) kann hier z. B. nur "Laden"
 * konfiguriert sein, ohne dass die anderen Linien fälschlich 0 W zeigen.
 * `direct` lässt sich nur berechnen, wenn PV/Laden/Einspeisung alle 3 als
 * Momentanleistung vorliegen (gleiche Formel wie `pvDirect` bei den Totals).
 */
export interface LiveFlow {
  charge?: number;
  direct?: number;
  export?: number;
  discharge?: number;
  import?: number;
}

/** Position + Größe der Beschriftungs-Pille passen sich der Textlänge an. */
function renderFlowLabel(cx: number, cy: number, text: string): SVGTemplateResult {
  const width = Math.max(30, text.length * 6 + 14);
  const height = 18;
  return svg`
    <g>
      <rect x="${cx - width / 2}" y="${cy - height / 2}" width="${width}" height="${height}" rx="${height / 2}" fill="var(--efc-surface-color)" />
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="efc-flow-label">${text}</text>
    </g>
  `;
}

/** Multipliziert jeden Fluss mit einem Faktor (z. B. Strompreis) – die
 * Prozentanteile im Ring bleiben dabei automatisch gleich, da eine
 * gleichmäßige Skalierung die Verhältnisse nicht verändert. So lässt sich
 * dasselbe Diagramm unverändert für eine Kosten-Ansicht wiederverwenden. */
export function scaleEnergyFlowTotals(totals: EnergyFlowTotals, factor: number): EnergyFlowTotals {
  return {
    pv: totals.pv * factor,
    charge: totals.charge * factor,
    discharge: totals.discharge * factor,
    gridImport: totals.gridImport * factor,
    gridExport: totals.gridExport * factor,
    pvDirect: totals.pvDirect * factor,
    hausbedarf: totals.hausbedarf * factor,
  };
}

/**
 * Liefert nur den *Inhalt* des Diagramms (Pfade, Kästchen, Ring, Legende),
 * kein eigenes <svg>-Element – das steht wie bei bar-chart.ts direkt im
 * html-Template der Karte (siehe dortige Begründung: Lits `svg`-Tag ist nur
 * für Inhalte innerhalb eines bestehenden <svg>, nicht um es selbst zu
 * erzeugen).
 *
 * Layout-Koordinaten sind bewusst fest (kein responsives Neuberechnen) –
 * das ganze SVG wird über sein `viewBox` gleichmäßig skaliert, siehe Karte.
 *
 * `formatValue` entkoppelt die Darstellung von der Einheit – dieselbe
 * Funktion rendert sowohl die kWh-Ansicht als auch (mit skalierten Totals +
 * Währungsformat) die Kosten-Ansicht.
 */
export function renderEnergyFlowContent(
  totals: EnergyFlowTotals,
  formatValue: (value: number) => string,
  live?: { flow: LiveFlow; format: (value: number) => string },
): SVGTemplateResult {
  const { pv, charge, discharge, gridImport, gridExport, pvDirect, hausbedarf } = totals;

  const maxFlow = Math.max(pvDirect, charge, gridExport, discharge, gridImport, 0.001);
  const wDirect = strokeWidthFor(pvDirect, maxFlow);
  const wCharge = strokeWidthFor(charge, maxFlow);
  const wExport = strokeWidthFor(gridExport, maxFlow);
  const wDischarge = strokeWidthFor(discharge, maxFlow);
  const wImport = strokeWidthFor(gridImport, maxFlow);

  const total = Math.max(hausbedarf, 0.001);
  const pctDirect = (pvDirect / total) * 100;
  const pctDischarge = (discharge / total) * 100;
  const pctImport = (gridImport / total) * 100;

  const segDirect = (pctDirect / 100) * RING_CIRCUMFERENCE;
  const segDischarge = (pctDischarge / 100) * RING_CIRCUMFERENCE;
  const segImport = (pctImport / 100) * RING_CIRCUMFERENCE;

  const liveWatts = live ? [live.flow.charge, live.flow.direct, live.flow.export, live.flow.discharge, live.flow.import].filter((w): w is number => w !== undefined) : [];
  const maxLiveWatts = Math.max(...liveWatts, 0.001);

  return svg`
    <path id="flow-charge" d="M85,112 C85,155 77.5,165 77.5,212" fill="none" stroke="var(--pv-color)" stroke-width=${wCharge} opacity="0.88" stroke-linecap="round" />
    <path id="flow-direct" d="M160,112 C160,215 160,278 160,352" fill="none" stroke="var(--pv-color)" stroke-width=${wDirect} opacity="0.88" stroke-linecap="round" />
    <path id="flow-export" d="M235,112 C235,155 242.5,165 242.5,212" fill="none" stroke="var(--pv-color)" stroke-width=${wExport} opacity="0.88" stroke-linecap="round" />
    <path id="flow-discharge" d="M77.5,240 C77.5,295 120,352 160,352" fill="none" stroke="var(--speicher-color)" stroke-width=${wDischarge} opacity="0.9" stroke-linecap="round" />
    <path id="flow-import" d="M242.5,240 C242.5,295 200,352 160,352" fill="none" stroke="var(--netz-color)" stroke-width=${wImport} opacity="0.9" stroke-linecap="round" />

    ${renderFlowDot('flow-charge', 'var(--pv-color)', live?.flow.charge, maxLiveWatts)}
    ${renderFlowDot('flow-direct', 'var(--pv-color)', live?.flow.direct, maxLiveWatts)}
    ${renderFlowDot('flow-export', 'var(--pv-color)', live?.flow.export, maxLiveWatts)}
    ${renderFlowDot('flow-discharge', 'var(--speicher-color)', live?.flow.discharge, maxLiveWatts)}
    ${renderFlowDot('flow-import', 'var(--netz-color)', live?.flow.import, maxLiveWatts)}

    ${live?.flow.charge !== undefined ? renderFlowLabel(82, 159, live.format(live.flow.charge)) : ''}
    ${live?.flow.direct !== undefined ? renderFlowLabel(160, 237, live.format(live.flow.direct)) : ''}
    ${live?.flow.export !== undefined ? renderFlowLabel(238, 159, live.format(live.flow.export)) : ''}
    ${live?.flow.discharge !== undefined ? renderFlowLabel(90, 302, live.format(live.flow.discharge)) : ''}
    ${live?.flow.import !== undefined ? renderFlowLabel(230, 302, live.format(live.flow.import)) : ''}

    <rect x="20" y="20" width="280" height="100" rx="10" fill="var(--efc-surface-color)" class="efc-surface" />
    <text x="34" y="44">
      <tspan class="efc-label">PV</tspan>
      <tspan class="efc-value" dx="10">${formatValue(pv)} Erzeugung</tspan>
    </text>
    <text x="85" y="90" text-anchor="middle" class="efc-mini-name">geladen</text>
    <text x="85" y="104" text-anchor="middle" class="efc-mini-value">${formatValue(charge)}</text>
    <text x="160" y="90" text-anchor="middle" class="efc-mini-name">verbraucht</text>
    <text x="160" y="104" text-anchor="middle" class="efc-mini-value">${formatValue(pvDirect)}</text>
    <text x="235" y="90" text-anchor="middle" class="efc-mini-name">eingespeist</text>
    <text x="235" y="104" text-anchor="middle" class="efc-mini-value">${formatValue(gridExport)}</text>

    <rect x="20" y="198" width="115" height="56" rx="10" fill="var(--efc-surface-color)" class="efc-surface" />
    <text x="32" y="220" class="efc-label">Speicher</text>
    <text x="32" y="238" class="efc-value">entladen ${formatValue(discharge)}</text>

    <rect x="185" y="198" width="115" height="56" rx="10" fill="var(--efc-surface-color)" class="efc-surface" />
    <text x="197" y="220" class="efc-label">Netz</text>
    <text x="197" y="238" class="efc-value">bezogen ${formatValue(gridImport)}</text>

    <rect x="50" y="332" width="220" height="266" rx="10" fill="var(--efc-surface-color)" class="efc-surface" />
    <g transform="translate(160,414) rotate(-90)">
      <circle r=${RING_RADIUS} fill="none" stroke="var(--efc-track-color)" stroke-width="18" />
      <circle
        r=${RING_RADIUS}
        fill="none"
        stroke="var(--pv-color)"
        stroke-width="18"
        stroke-linecap="round"
        stroke-dasharray="${Math.max(segDirect - RING_GAP, 0)} ${RING_CIRCUMFERENCE}"
        stroke-dashoffset="0"
        class="efc-ring-segment"
      />
      <circle
        r=${RING_RADIUS}
        fill="none"
        stroke="var(--speicher-color)"
        stroke-width="18"
        stroke-linecap="round"
        stroke-dasharray="${Math.max(segDischarge - RING_GAP, 0)} ${RING_CIRCUMFERENCE}"
        stroke-dashoffset="${-segDirect}"
        class="efc-ring-segment"
      />
      <circle
        r=${RING_RADIUS}
        fill="none"
        stroke="var(--netz-color)"
        stroke-width="18"
        stroke-linecap="round"
        stroke-dasharray="${Math.max(segImport - RING_GAP, 0)} ${RING_CIRCUMFERENCE}"
        stroke-dashoffset="${-(segDirect + segDischarge)}"
        class="efc-ring-segment"
      />
    </g>
    <text x="160" y="408" text-anchor="middle" class="efc-ring-value">${formatValue(hausbedarf)}</text>
    <text x="160" y="425" text-anchor="middle" class="efc-ring-label">Hausbedarf</text>

    <circle cx="76" cy="515" r="5" fill="var(--pv-color)" />
    <text x="88" y="519" class="efc-legend-text">PV-Direktverbrauch</text>
    <text x="244" y="519" text-anchor="end" class="efc-legend-value">${Math.round(pctDirect)}%</text>

    <circle cx="76" cy="543" r="5" fill="var(--speicher-color)" />
    <text x="88" y="547" class="efc-legend-text">aus Speicher</text>
    <text x="244" y="547" text-anchor="end" class="efc-legend-value">${Math.round(pctDischarge)}%</text>

    <circle cx="76" cy="571" r="5" fill="var(--netz-color)" />
    <text x="88" y="575" class="efc-legend-text">aus Netz</text>
    <text x="244" y="575" text-anchor="end" class="efc-legend-value">${Math.round(pctImport)}%</text>
  `;
}
