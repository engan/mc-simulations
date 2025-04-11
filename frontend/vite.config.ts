import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import wasm from 'vite-plugin-wasm'

// https://vite.dev/config/
export default defineConfig({
  base: '/mc-simulations/', // Appen ligger i denne undermappen
  plugins: [
    vue(),
    vueDevTools(),
    wasm(), // Støtte for WebAssembly
  ],
  worker: {
    format: 'es',
    plugins: () => [wasm()],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Forespørsler fra din app til '/binance-api' vil bli sendt til Binance
      '/binance-api': {
        target: 'https://api.binance.com', // Mål-APIet
        changeOrigin: true, // Nødvendig for virtuelle hostede sider
        rewrite: (path) => path.replace(/^\/binance-api/, '/api/v3'), // Fjern prefix og legg til Binance sin
        // secure: false, // Kan være nødvendig hvis det er SSL-problemer (vanligvis ikke)
      },
      // Du kan legge til flere proxy-regler her om nødvendig
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
