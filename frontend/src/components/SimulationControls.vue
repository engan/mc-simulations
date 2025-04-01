<script setup lang="ts">
import { ref } from 'vue';
import { useKlines } from '../composables/useKlines';

// --- Definer typer lokalt ---
interface BestParams {
  short: number;
  long: number;
  score: number;
  trades: number;
}

// --- Interface for den KOMBINERTE payloaden ---
interface StartMcPayload {
  mcSettings: {
    iterations: number;
    barsPerSim: number;
  };
  dataSource: {
    symbol: string;
    timeframe: string;
    limit: number; // Bruk limit fra dataLimitForFetch
  };
}
// --- Slutt type-definisjoner ---

// Definer ALLE events - spesifiser den nye payload-typen
const emit = defineEmits<{
    (e: 'update-progress', message: string): void;
    (e: 'optimization-complete', results: BestParams[] | null): void;
    (e: 'mc-validation-complete', results: any): void;
    (e: 'start-mc-validation', payload: StartMcPayload): void; // <-- Ny payload type
}>()

// --- Input fra brukeren ---
const symbol = ref('SOLUSDT');
const timeframe = ref('1h');
const dataLimitForFetch = ref(1000);
const mcIterations = ref(1000);
const mcBarsPerSim = ref(500);
const bestParamsAvailable = ref(false); // Styres nå av om lastBestParams har verdi

// SMA Parametere
const shortSmaPeriodMin = ref(5);
const shortSmaPeriodMax = ref(20);
const shortSmaPeriodStep = ref(1);
const longSmaPeriodMin = ref(30);
const longSmaPeriodMax = ref(100);
const longSmaPeriodStep = ref(5);

// Tilstander
const isOptimizing = ref(false);
const isMcValidating = ref(false);
let lastBestParams: BestParams | null = null; // Lagrer det *eneste* beste resultatet fra Steg 1

// Data Composable
const { loadKlines, klines, isLoading: isLoadingKlines, error: klinesError } = useKlines();

// --- Web Worker Refs ---
let optimizationWorker: Worker | null = null;
let mcValidationWorker: Worker | null = null;

// --- Funksjoner ---

// Håndterer resultatlisten fra Steg 1
function handleOptimizationCompleteLocal(resultsList: BestParams[] | null) { // <-- Aksepterer listen igjen
  // Sett flagget basert på om listen har innhold
  bestParamsAvailable.value = !!(resultsList && resultsList.length > 0);
  // Lagre det FØRSTE (beste) resultatet lokalt for bruk i Steg 2
  lastBestParams = (resultsList && resultsList.length > 0) ? resultsList[0] : null;
  // Send HELE listen videre til SimulationView
  emit('optimization-complete', resultsList);
  isOptimizing.value = false;
}

// Starter Steg 1: Optimalisering
function startOptimization() {
  if (isOptimizing.value || isLoadingKlines.value || isMcValidating.value) return;
  isOptimizing.value = true;
  bestParamsAvailable.value = false;
  lastBestParams = null; // Nullstill også denne
  emit('optimization-complete', null); // Nullstill forrige resultat i viewet
  emit('mc-validation-complete', null); // Nullstill også MC-resultater
  emit('update-progress', 'Starter optimalisering... Henter data...');

  loadKlines(symbol.value, timeframe.value, dataLimitForFetch.value)
    .then(() => {
       if (klinesError.value || klines.value.length === 0 || klines.value.length < longSmaPeriodMax.value) {
         const errorMsg = klinesError.value || (klines.value.length === 0 ? 'Ingen data mottatt' : `Fikk bare ${klines.value.length} datapunkter, trenger minst ${longSmaPeriodMax.value}`);
         emit('update-progress', `Feil ved henting/validering av data: ${errorMsg}`);
         isOptimizing.value = false;
         return;
       }
       emit('update-progress', `Data hentet (${klines.value.length} barer). Starter Opt Worker...`);

       if (!optimizationWorker) {
         optimizationWorker = new Worker(new URL('../workers/optimizationWorker.ts', import.meta.url), { type: 'module' });
         optimizationWorker.onmessage = (event: MessageEvent<{ type: string; payload: any }>) => {
            const { type, payload } = event.data;
            if (type === 'progress') {
                emit('update-progress', payload.message);
            } else if (type === 'result') {
                // Mottar nå payload.topResults (en liste)
                console.log('Controls: Received result list from worker:', payload.topResults);
                const resultsList = payload.topResults && payload.topResults.length > 0 ? payload.topResults : null;
                handleOptimizationCompleteLocal(resultsList);
            } else if (type === 'error') {
                emit('update-progress', `Opt Worker Error: ${payload.message}`);
                isOptimizing.value = false;
                bestParamsAvailable.value = false;
            }
         };
         optimizationWorker.onerror = (event: Event | string) => {
            const message = event instanceof Event ? (event as ErrorEvent).message : String(event);
            console.error("Opt Worker Error:", event);
            emit('update-progress', `Opt Worker Feil: ${message}`);
            isOptimizing.value = false;
            bestParamsAvailable.value = false;
         };
       }
       // Send data til optimizationWorker
       optimizationWorker.postMessage({
          type: 'startOptimization',
          payload: {
            historicalKlines: JSON.parse(JSON.stringify(klines.value)),
            parameters: {
              shortSma: { min: shortSmaPeriodMin.value, max: shortSmaPeriodMax.value, step: shortSmaPeriodStep.value },
              longSma: { min: longSmaPeriodMin.value, max: longSmaPeriodMax.value, step: longSmaPeriodStep.value },
            },
            strategy: 'smaCross'
          }
       });
    })
    .catch(err => {
       emit('update-progress', `Uventet feil under datahenting: ${err.message}`);
       isOptimizing.value = false;
       bestParamsAvailable.value = false;
    });
}

// Denne kalles av knappen og sender kun en hendelse oppover
function triggerMcValidationStart() {
  if (!bestParamsAvailable.value) {
      emit('update-progress', "Kjør Steg 1 først for å finne parametere å validere.");
       return;
  }
  if (isOptimizing.value || isMcValidating.value) return;

  const payload: StartMcPayload = {
      mcSettings: {
          iterations: mcIterations.value,
          barsPerSim: mcBarsPerSim.value
      },
      dataSource: {
          symbol: symbol.value,
          timeframe: timeframe.value,
          limit: dataLimitForFetch.value // Send den faktiske limit brukeren har satt
      }
  };

  console.log("CONTROLS: Emitting 'start-mc-validation' with payload:", payload);

  emit('start-mc-validation', payload);
}

</script>

<template>
  <div class="controls-panel">
    <h2>Simulation Controls</h2>

    <fieldset>
        <legend>Data Source</legend>
        <div>
            <label for="symbol">Symbol:</label>
            <input type="text" id="symbol" v-model="symbol">
        </div>
        <div>
            <label for="timeframe">Timeframe:</label>
            <input type="text" id="timeframe" v-model="timeframe">
        </div>
        <div>
            <label for="limit">Data Limit:</label>
            <input type="number" id="limit" v-model.number="dataLimitForFetch">
        </div>
         <div v-if="klinesError" style="color: red; font-size: 0.9em; margin-top: 5px;">
            Data Fetch Error: {{ klinesError }}
         </div>
    </fieldset>

    <fieldset>
        <legend>SMA Crossover Parameters</legend>
          <div>
            <label>Short Period:</label>
            Min: <input type="number" v-model.number="shortSmaPeriodMin" style="width: 50px;">
            Max: <input type="number" v-model.number="shortSmaPeriodMax" style="width: 50px;">
            Step: <input type="number" v-model.number="shortSmaPeriodStep" style="width: 50px;">
            </div>
            <div>
            <label>Long Period:</label>
            Min: <input type="number" v-model.number="longSmaPeriodMin" style="width: 50px;">
            Max: <input type="number" v-model.number="longSmaPeriodMax" style="width: 50px;">
            Step: <input type="number" v-model.number="longSmaPeriodStep" style="width: 50px;">
            </div>
    </fieldset>

    <button @click="startOptimization" :disabled="isOptimizing || isMcValidating || isLoadingKlines">
      {{ isOptimizing ? 'Optimizing...' : (isLoadingKlines ? 'Loading Data...' : 'Start Optimization (Step 1)') }}
    </button>

     <hr>

    <fieldset>
    <legend>Monte Carlo Settings (Step 2)</legend>
    <div>
          <label for="mcIterations">Iterations:</label>
          <!-- Sikre at input er bundet til ref -->
          <input type="number" id="mcIterations" v-model.number="mcIterations" style="width: 80px;">
      </div>
      <div>
          <label for="mcBars">Bars per Sim:</label>
          <input type="number" id="mcBars" v-model.number="mcBarsPerSim" style="width: 80px;">
      </div>
    </fieldset>

     <!-- Knapp for å starte Steg 2 -->
     <button @click="triggerMcValidationStart" :disabled="isOptimizing || isMcValidating || !bestParamsAvailable">
      {{ isMcValidating ? 'Validating...' : 'Run MC Validation (Step 2)' }}
    </button>
  </div>
</template>

<style scoped>
  fieldset { margin-bottom: 1rem; border: 1px solid #555; padding: 1rem; border-radius: 4px; }
  legend { font-weight: bold; padding: 0 0.5rem; margin-left: 0.5rem; color: #ddd;}
  label { display: inline-block; min-width: 80px; margin-right: 5px; }
  input[type=number] { width: 100px; } /* Juster bredde på tall-input */
  button { margin-top: 0.5rem; padding: 8px 15px; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: 0.6; }
  hr { border: none; border-top: 1px solid #444; margin: 1.5rem 0; }
</style>