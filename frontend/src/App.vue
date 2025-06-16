<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div id="app-container">
    <RouterView />
  </div>
</template>

<style scoped>
#app-container {
  max-width: 90vw;  
  margin: 0 auto;
  padding: 2rem;
  font-weight: normal;
}
</style>