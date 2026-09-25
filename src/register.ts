import './pv-energy-diagram';
import './pv-energy-flow-card';
import './pv-battery-card';

// Registrierung im Karten-Auswahldialog von Home Assistant.
window.customCards = window.customCards || [];
window.customCards.push(
  {
    type: 'pv-energy-diagram',
    name: 'PV Energy Diagram',
    description: 'Zeigt die Solarerzeugung als Balkendiagramm mit Prognose.',
    preview: false,
  },
  {
    type: 'pv-energy-flow-card',
    name: 'PV Energy Flow Card',
    description: 'Zeigt, woher der Hausbedarf kommt (PV / Speicher / Netz) als Fluss- und Ring-Diagramm.',
    preview: false,
  },
  {
    type: 'pv-battery-card',
    name: 'PV Battery Card',
    description: 'Zeigt den Akkustand als Batterie-Symbol mit Lade-/Entladeleistung und Ladezeit-Prognose.',
    preview: false,
  },
);

declare global {
  interface Window {
    customCards: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
    }>;
  }
}
