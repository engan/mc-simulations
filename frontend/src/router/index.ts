import { createRouter, createWebHistory } from 'vue-router'
import SimulationView from '../views/SimulationView.vue' // Importer den nye viewen
import SimpleStrategyTestView from '../views/SimpleStrategyTestView.vue' // <-- IMPORTER

// Legg til en rute i Vue-ruteren slik at man kan navigere 
// til den nye SimpleStrategyTestView.vue.

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [ // Legg til en rute for den nye test-visningen.
    {
      path: '/', // Ruten for hovedsiden
      name: 'simulation',
      component: SimulationView // Bruk den nye viewen som komponent
    },
    {
      path: '/simple-test',
      name: 'simple-test',
      component: SimpleStrategyTestView,
    }
  ]
})

export default router
