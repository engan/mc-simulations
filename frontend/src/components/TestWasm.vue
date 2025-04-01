<script setup lang="ts">
import { ref, onMounted } from 'vue'
import init, { calculate_sma } from '../rust/pkg/mc_simulations.js'

const smaValues = ref<number[]>([])
const errorMsg = ref<string | null>(null) // For å vise feil i UI

onMounted(async () => {
  try {
    console.log('Forsøker å initialisere Wasm...');
    await init();
    console.log('Wasm initialisert vellykket.');

    const prices = Float64Array.from([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 108, 110]);
    const smaPeriod = 3;

    console.log('Kaller calculate_sma med periode:', smaPeriod);
    const result = calculate_sma(prices, smaPeriod);
    console.log('Resultat mottatt fra calculate_sma:', result);

    smaValues.value = Array.from(result);
    console.log('smaValues oppdatert:', smaValues.value);
    errorMsg.value = null; // Nullstill feilmelding ved suksess

  } catch (err) {
    console.error('Feil under Wasm-initialisering eller kall:', err);
    errorMsg.value = `Feil: ${err}`; // Vis feilmelding i UI
  }
})
</script>

<template>
    <div style="background: white; color: black; padding: 2rem">
      <h3>Simple Moving Average (SMA) fra Rust/Wasm:</h3>
      <p v-if="errorMsg" style="color: red;">{{ errorMsg }}</p>
      <ul v-else-if="smaValues.length > 0">
        <li v-for="(sma, index) in smaValues" :key="index">
          <!-- Juster indexen for visning siden SMA starter senere -->
          SMA[{{ index + (3 - 1) }}]: {{ sma.toFixed(2) }}
        </li>
      </ul>
      <p v-else>Laster SMA-verdier eller ingen data...</p>
    </div>
  </template>
