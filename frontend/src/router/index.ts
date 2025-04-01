import { createRouter, createWebHistory } from 'vue-router'
import SimulationView from '../views/SimulationView.vue' // Importer den nye viewen

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/', // Ruten for hovedsiden
      name: 'simulation',
      component: SimulationView // Bruk den nye viewen som komponent
    }
    // Fjern /about ruten og andre unødvendige ruter
  ]
})

export default router
