import { defineConfig } from 'vite';

// Baut die Karte als einzelne ES-Modul-Datei ohne externe Laufzeit-Abhängigkeiten
// (Lit wird mit eingebündelt), damit sie als HA-Ressource per URL eingebunden werden kann.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/register.ts',
      formats: ['es'],
      fileName: () => 'solar-cards.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
