import { svg, type SVGTemplateResult } from 'lit';

export const BATTERY_GAUGE_VIEW_WIDTH = 120;
export const BATTERY_GAUGE_VIEW_HEIGHT = 60;

/**
 * Füllfarbe des Akkustands: HSL-Interpolation zwischen zwei Farbpaaren
 * (rot→orange für 0–50 %, orange→grün für 50–100 %) statt harter Farbkante bei
 * einem festen Schwellwert – vermeidet einen abrupten Sprung z. B. zwischen
 * 49 % und 51 %.
 */
export function socColor(soc: number): string {
  const clamped = Math.max(0, Math.min(100, soc));
  const red = { h: 4, s: 90, l: 55 };
  const orange = { h: 36, s: 100, l: 50 };
  const green = { h: 142, s: 60, l: 42 };
  const [from, to, t] = clamped <= 50 ? [red, orange, clamped / 50] : [orange, green, (clamped - 50) / 50];
  const h = from.h + (to.h - from.h) * t;
  const s = from.s + (to.s - from.s) * t;
  const l = from.l + (to.l - from.l) * t;
  return `hsl(${h.toFixed(1)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

/**
 * Liegende Batterie-Form (iOS-Statusleisten-Stil): äußerer Umriss mit
 * Pluspol-Nub rechts, Innenbereich als Füllstandsbalken. Liefert nur den
 * SVG-*Inhalt* – das `<svg>`-Element selbst steht im `html`-Template der Karte
 * (siehe Bugfix-Historie in CLAUDE.md: `svg`-Tag ist nur für Inhalte
 * *innerhalb* eines bereits vorhandenen `<svg>` gedacht).
 */
export function renderBatteryGauge(soc: number): SVGTemplateResult {
  const clamped = Math.max(0, Math.min(100, soc));
  const outlineX = 2;
  const outlineY = 2;
  const outlineWidth = 100;
  const outlineHeight = 46;
  const padding = 6;
  const innerX = outlineX + padding;
  const innerY = outlineY + padding;
  const innerMaxWidth = outlineWidth - padding * 2;
  const innerHeight = outlineHeight - padding * 2;
  const fillWidth = (clamped / 100) * innerMaxWidth;

  const centerX = outlineX + outlineWidth / 2;
  const centerY = outlineY + outlineHeight / 2;
  const label = `${Math.round(clamped)} %`;
  // Pille hinter der Zahl statt Text direkt auf dem Füllbalken: sitzt die
  // Zahl teils auf gefülltem, teils auf leerem Bereich, wäre der Kontrast
  // sonst nicht garantiert (gleiches Prinzip wie `renderFlowLabel` in
  // chart/energy-flow.ts).
  const labelWidth = Math.max(34, label.length * 7 + 10);
  const labelHeight = 18;

  return svg`
    <rect
      x=${outlineX} y=${outlineY} width=${outlineWidth} height=${outlineHeight} rx="8"
      fill="none" stroke="var(--secondary-text-color)" stroke-width="4"
    />
    <rect
      x=${outlineX + outlineWidth + 2} y=${outlineY + outlineHeight / 2 - 8} width="6" height="16" rx="2"
      fill="var(--secondary-text-color)"
    />
    <rect x=${innerX} y=${innerY} width=${fillWidth} height=${innerHeight} rx="4" fill=${socColor(clamped)} />
    <rect
      x=${centerX - labelWidth / 2} y=${centerY - labelHeight / 2} width=${labelWidth} height=${labelHeight} rx=${labelHeight / 2}
      fill="var(--card-background-color, #1c1c1c)" opacity="0.85"
    />
    <text
      x=${centerX} y=${centerY + 4} text-anchor="middle"
      font-size="12" font-weight="700" fill="var(--primary-text-color)"
    >${label}</text>
  `;
}
