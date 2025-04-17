import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
// import wasm from 'vite-plugin-wasm'  // <-- KOMMENTER UT

// https://vite.dev/config/
export default defineConfig({
  base: '/', // Appen ligger i denne undermappen
  plugins: [
    vue(),
    vueDevTools(),
    // wasm(), // <-- KOMMENTER UT (Støtte for WebAssembly)

    /*
      Behold base: '/mc-simulations/' i vite.config.ts.
      Fjern vite-plugin-wasm ved å kommentere ut slik som ovenfor: // wasm().
      Bruk direkte init og funksjonskall i workerne optimizationWorker.ts og mcValidationWorker.ts.
      Kopier den bygde .wasm-filen ( mc_simulations_bg-*.wasm) fra frontend/dist/assets til frontend/public/mc_simulations_bg.wasm (uten hash).
      Kall init med den absolutte stien i workerne: await init('/mc-simulations/mc_simulations_bg.wasm');
      Bygg, Commit (inkl. Wasm i public), Push, Deploy.
    */
  ],
  // worker: {  <-- KOMMENTER UT DENNE WORKER-BLOKKEN
  //   format: 'es',
  //   plugins: () => [wasm()],
  // },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // --- ENDRE TIL /binance-proxy ---
      '/binance-proxy': { // <-- Bruk samme sti som Cloudflare Function
        target: 'https://api.binance.com', // Mål-APIet
        changeOrigin: true, // Nødvendig for virtuelle hostede sider
        rewrite: (path) => path.replace(/^\/binance-proxy/, '/api/v3'), // Fjern prefix og legg til Binance sin
        // secure: false, // Kan være nødvendig hvis det er SSL-problemer (vanligvis ikke)
      },
      // --- SLUTT ENDRING ---
      // Man kan legge til flere proxy-regler her om nødvendig
    },
  },
  // Optional, men kan hjelpe Wasm-lasting i noen nettlesere/servere:
  build: {
    target: 'esnext', // Sikrer moderne JS-output som støtter top-level await for Wasm
  },
  optimizeDeps: {
    // Kan være nødvendig hvis Wasm init feiler pga. top-level await
    // exclude: ['mc-simulations'] // Bruk navnet fra din rust/pkg/package.json
  },
})
