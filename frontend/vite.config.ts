import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  // --- LEGG TIL ELLER MODIFISER DENNE SEKSJONEN ---
  server: {
    proxy: {
      // Forespørsler fra din app til '/binance-api' vil bli sendt til Binance
      '/binance-api': {
        target: 'https://api.binance.com', // Mål-APIet
        changeOrigin: true, // Nødvendig for virtuelle hostede sider
        rewrite: (path) => path.replace(/^\/binance-api/, '/api/v3') // Fjern prefix og legg til Binance sin
        // secure: false, // Kan være nødvendig hvis det er SSL-problemer (vanligvis ikke)
      }
      // Du kan legge til flere proxy-regler her om nødvendig
    }
  }
  // --- SLUTT PÅ SERVER SEKSJON ---  
})
