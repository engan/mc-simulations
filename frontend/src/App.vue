<script setup lang="ts">
// import { RouterView } from 'vue-router'
import { defineAsyncComponent, ref } from 'vue';

// Importer SimulationView asynkront
const AsyncSimulationView = defineAsyncComponent(() =>
  import('./views/SimulationView.vue')
);

const isReady = ref(true); // Vi kan evt. legge inn en sjekk her senere

</script>

<template>
  <div id="app-container">
  <!-- Vis SimulationView KUN når den er lastet (eller basert på isReady) -->
  <Suspense v-if="isReady">
      <AsyncSimulationView />
      <template #fallback>
        <div>Loading Application...</div> <!-- Vises mens komponenten laster -->
      </template>
    </Suspense>
     <div v-else>Preparing...</div>    
    <!-- <RouterView /> -->
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
/* Legg til styling for fallback? */
</style>