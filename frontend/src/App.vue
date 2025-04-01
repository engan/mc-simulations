<script setup lang="ts">
import { RouterView } from 'vue-router'
// import TestWasm from './components/TestWasm.vue'
</script>

<template>
  <div id="app-container">
    <!-- RouterView vil rendre SimulationView -->
    <RouterView />
  </div>
</template>

<style scoped>
#app-container {
  max-width: 1280px; /* Eller ønsket maks bredde */
  margin: 0 auto;
  padding: 2rem;
  font-weight: normal;
}

/* Du kan legge til global layout-styling her om nødvendig */
</style>