<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchBinanceKlines, type Kline } from '../services/binanceAPI';

const klines = ref<Kline[]>([]);
const klinesStringified = ref<string>(''); // Ny ref for strengifisert data
const isLoading = ref(false);
const error = ref<string | null>(null);
const symbol = ref('SOLUSDT');
const interval = ref('1h');
const dataLimit = ref(1000); // Start med 100, kan økes til 1000

async function loadData() {
  isLoading.value = true;
  error.value = null;
  klines.value = [];
  klinesStringified.value = ''; // Nullstill strengen

  try {
    const fetchedKlines = await fetchBinanceKlines(symbol.value, interval.value, dataLimit.value);
    klines.value = fetchedKlines; // Oppdater den faktiske data-refen

    // Strengifiser kun de første 5 for visning i <pre>
    klinesStringified.value = JSON.stringify(klines.value.slice(0, 5), null, 2);

    console.log(`Hentet ${klines.value.length} klines for ${symbol.value} ${interval.value}`);

  } catch (err: any) {
    error.value = err.message || 'En ukjent feil oppstod under henting av data.';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div>
    <h2>Binance Data Fetcher</h2>
    <div>
      <label>Symbol:</label> <input v-model="symbol" type="text" />
      <label>Interval:</label> <input v-model="interval" type="text" /><br />
      <label>Limit:</label> <input v-model.number="dataLimit" type="number" />
      <button @click="loadData" :disabled="isLoading">
        {{ isLoading ? 'Laster...' : 'Hent Data' }}
      </button>
    </div>

    <div v-if="isLoading">Laster data...</div>
    <div v-if="error" style="color: red;">Feil: {{ error }}</div>
    <div v-if="!isLoading && !error && klines.length > 0">
      <h3>Vellykket henting av {{ klines.length }} candlesticks:</h3>
      <!-- Bruk den strengifiserte refen her -->
      <pre style="max-height: 300px; overflow-y: auto; background: #eee; padding: 10px; border-radius: 5px;">{{ klinesStringified }}
... (viser kun de 5 første)</pre>
    </div>
     <div v-if="!isLoading && !error && klines.length === 0 && !isLoading">
        Ingen data funnet for gitte parametere.
     </div>
  </div>
</template>

<style scoped>
label {
  margin: 0 0.5rem 0 1rem;
}
button {
  margin-left: 1rem;
}
pre {
  text-align: left;
  font-size: 0.8em;
  color: #333; /* Gjør teksten synlig mot lys bakgrunn */
}
</style>