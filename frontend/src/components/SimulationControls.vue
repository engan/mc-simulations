<script setup lang="ts">
import { ref } from 'vue';
import { useKlines } from '../composables/useKlines';
// --- IMPORTER SENTRALE TYPER ---
import type {
    TopResultItem,
    OptimizationStrategyInfo, 
    SmaOptimizationParams, 
    RsiOptimizationParams,
    ParameterRange 
} from '../types/simulation'; // <-- Importer fra ny fil

// --- OPPDATER Lokal type for emit ---
type StartMcTriggerPayload = {
  mcSettings: { iterations: number; barsPerSim: number };
  dataSource: { symbol: string; timeframe: string; limit: number; };
  costs: { commissionPct: number, slippageAmount: number }; // <-- LEGG TIL COSTS
}

// --- OPPDATER defineEmits ---
const emit = defineEmits<{
    (e: 'update-progress', message: string): void;
    (e: 'optimization-complete', results: TopResultItem[] | null): void;
    (e: 'mc-validation-complete', results: any): void;
    (e: 'start-mc-validation', payload: StartMcTriggerPayload): void; // <-- Bruker oppdatert type
}>()

// --- Input fra brukeren ---
const symbol = ref('SOLUSDT');
const timeframe = ref('1h');
const dataLimitForFetch = ref(1000);
const mcIterations = ref(1000);
const mcBarsPerSim = ref(500);
const optimizationResultsAvailable = ref(false);

// --- NYTT: Valgt strategi ---
const selectedStrategy = ref<'smaCross' | 'rsi'>('smaCross'); // Default til SMA

// --- NYE: Kostnads-parametre ---
const commissionPercent = ref(0.05); // Standard 0.05%
const slippageAmount = ref(0.01);   // Standard 0.01 i pris-enheter

// SMA Parametere
const shortSmaPeriodMin = ref(5);
const shortSmaPeriodMax = ref(20);
const shortSmaPeriodStep = ref(1);
const longSmaPeriodMin = ref(30);
const longSmaPeriodMax = ref(100);
const longSmaPeriodStep = ref(5);

// --- NYTT: RSI Parametere ---
const rsiPeriodMin = ref(5);
const rsiPeriodMax = ref(30);
const rsiPeriodStep = ref(1);
const rsiBuyLevel = ref(30); // Fastsatt verdi for nå
const rsiSellLevel = ref(70); // Fastsatt verdi for nå

// Tilstander
const isOptimizing = ref(false);
const isMcValidating = ref(false);

// Data Composable
const { loadKlines, klines, isLoading: isLoadingKlines, error: klinesError } = useKlines();

// --- Web Worker Refs ---
let optimizationWorker: Worker | null = null;

// --- Funksjoner ---

// Håndterer resultatlisten fra Steg 1
function handleOptimizationCompleteLocal(resultsList: TopResultItem[] | null) { 
  optimizationResultsAvailable.value = !!(resultsList && resultsList.length > 0);
  emit('optimization-complete', resultsList); // Sender nå korrekt type
  isOptimizing.value = false;
}

// Starter Steg 1: Optimalisering
function startOptimization() {
  if (isOptimizing.value || isLoadingKlines.value || isMcValidating.value) return;
  isOptimizing.value = true;
  optimizationResultsAvailable.value = false;
  emit('optimization-complete', null);
  emit('mc-validation-complete', null);
  emit('update-progress', `Starter optimalisering for ${selectedStrategy.value}... Henter data...`);

  loadKlines(symbol.value, timeframe.value, dataLimitForFetch.value)
    .then(() => {
       // Datavalidering (kan gjøres mer robust basert på strategi)
       const minBarsNeeded = selectedStrategy.value === 'smaCross' ? longSmaPeriodMax.value : rsiPeriodMax.value * 2; // Grovt estimat for RSI
       if (klinesError.value || klines.value.length < minBarsNeeded) {
         const errorMsg = klinesError.value || `Fikk bare ${klines.value.length} datapunkter, trenger minst ${minBarsNeeded} for ${selectedStrategy.value}`;
         emit('update-progress', `Feil ved henting/validering av data: ${errorMsg}`);
         isOptimizing.value = false;
         return;
       }
       emit('update-progress', `Data hentet (${klines.value.length} barer). Starter Opt Worker for ${selectedStrategy.value}...`);

       if (!optimizationWorker) {
         // Initialize worker (som før, men onmessage håndterer nå TopResultItem[])
         optimizationWorker = new Worker(new URL('../workers/optimizationWorker.ts', import.meta.url), { type: 'module' });
         optimizationWorker.onmessage = (event: MessageEvent<{ type: string; payload: any }>) => {
            const { type, payload } = event.data;
            if (type === 'progress') {
                emit('update-progress', payload.message);
            } else if (type === 'result') {
                // Mottar nå payload.topResults (en liste av TopResultItem)
                console.log('Controls: Received result list from worker:', payload.topResults);
                const resultsList = payload.topResults && payload.topResults.length > 0 ? payload.topResults : null;
                handleOptimizationCompleteLocal(resultsList); // Kall med TopResultItem[]
            } else if (type === 'error') {
                emit('update-progress', `Opt Worker Error: ${payload.message}`);
                isOptimizing.value = false;
                optimizationResultsAvailable.value = false;
            }
         };
         optimizationWorker.onerror = (event: Event | string) => {
            const message = event instanceof Event ? (event as ErrorEvent).message : String(event);
            console.error("Opt Worker Error:", event);
            emit('update-progress', `Opt Worker Feil: ${message}`);
            isOptimizing.value = false;
         };
       }
       // --- Bygg riktig parameter-payload MED kostnader ---
       let strategyParamsPayload: OptimizationStrategyInfo;
       // Hent basis-parametere
       const baseParams = {
           commissionPct: commissionPercent.value / 100.0, // Konverter % til desimal
           slippageAmount: slippageAmount.value
       };

       if (selectedStrategy.value === 'smaCross') {
           strategyParamsPayload = {
               strategy: 'smaCross',
               params: { // SmaOptimizationParams
                   shortSma: { min: shortSmaPeriodMin.value, max: shortSmaPeriodMax.value, step: shortSmaPeriodStep.value },
                   longSma: { min: longSmaPeriodMin.value, max: longSmaPeriodMax.value, step: longSmaPeriodStep.value },
                   ...baseParams // Legg til kostnader
               }
           };
       } else { // rsi
           strategyParamsPayload = {
               strategy: 'rsi',
               params: { // RsiOptimizationParams
                   period: { min: rsiPeriodMin.value, max: rsiPeriodMax.value, step: rsiPeriodStep.value },
                   buyLevel: rsiBuyLevel.value,
                   sellLevel: rsiSellLevel.value,
                   ...baseParams // Legg til kostnader
               }
           };
       }

       // Send payload til worker
       optimizationWorker.postMessage({
          type: 'startOptimization',
          payload: {
            historicalKlines: JSON.parse(JSON.stringify(klines.value)),
            strategyInfo: strategyParamsPayload // Inneholder nå kostnader
          }
       });
    })
    .catch(err => {
       emit('update-progress', `Uventet feil under datahenting: ${err.message}`);
       isOptimizing.value = false;
       optimizationResultsAvailable.value = false;
    });
}

// --- OPPDATER triggerMcValidationStart ---
function triggerMcValidationStart() {
  if (!optimizationResultsAvailable.value) { /* ... */ return; }
  if (isOptimizing.value || isMcValidating.value) return;

  // Bygg payloaden som matcher den oppdaterte StartMcTriggerPayload
  const payload: StartMcTriggerPayload = {
      mcSettings: {
          iterations: mcIterations.value,
          barsPerSim: mcBarsPerSim.value
      },
      dataSource: {
          symbol: symbol.value,
          timeframe: timeframe.value,
          limit: dataLimitForFetch.value
      },
      costs: { // <-- Legg til costs her
          commissionPct: commissionPercent.value / 100.0, // Send som desimal
          slippageAmount: slippageAmount.value
      }
  };

  console.log("CONTROLS: Emitting 'start-mc-validation' with basic settings and costs:", payload);
  emit('start-mc-validation', payload); // Send payload med costs
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

    <!-- NYTT: Strategi Velger -->
    <fieldset>
        <legend>Strategy Selection</legend>
        <div>
            <label for="strategy">Strategy:</label>
            <select id="strategy" v-model="selectedStrategy">
                <option value="smaCross">SMA Crossover</option>
                <option value="rsi">RSI</option>
            </select>
        </div>
    </fieldset>

    <!-- SMA Parametere (Vises kun hvis SMA er valgt) -->
    <fieldset v-if="selectedStrategy === 'smaCross'">
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

    <!-- RSI Parametere (Vises kun hvis RSI er valgt) -->
    <fieldset v-if="selectedStrategy === 'rsi'">
        <legend>RSI Parameters</legend>
          <div>
            <label>Period:</label>
            Min: <input type="number" v-model.number="rsiPeriodMin" style="width: 50px;">
            Max: <input type="number" v-model.number="rsiPeriodMax" style="width: 50px;">
            Step: <input type="number" v-model.number="rsiPeriodStep" style="width: 50px;">
          </div>
          <div>
            <label for="rsiBuyLevel">Buy Level:</label>
            <input type="number" id="rsiBuyLevel" v-model.number="rsiBuyLevel" style="width: 50px;" disabled> <!-- Fastsatt, så disabled -->
          </div>
           <div>
            <label for="rsiSellLevel">Sell Level:</label>
            <input type="number" id="rsiSellLevel" v-model.number="rsiSellLevel" style="width: 50px;" disabled> <!-- Fastsatt, så disabled -->
          </div>
    </fieldset>

    <!-- *** NYTT: Felt for kostnader *** -->
    <fieldset>
        <legend>Backtest Costs</legend>
        <div>
            <label for="commission">Commission (%):</label>
            <input type="number" id="commission" step="0.01" v-model.number="commissionPercent" style="width: 70px;">
        </div>
        <div>
            <label for="slippage">Slippage (Amount):</label>
            <input type="number" id="slippage" step="0.01" v-model.number="slippageAmount" style="width: 70px;">
            <span style="font-size: 0.8em; margin-left: 5px;">(Absolute price units)</span>
        </div>
    </fieldset>
     <!-- *** SLUTT NYTT FELT *** -->

    <button @click="startOptimization" :disabled="isOptimizing || isMcValidating || isLoadingKlines">
      {{ isOptimizing ? `Optimizing ${selectedStrategy}...` : (isLoadingKlines ? 'Loading Data...' : 'Start Optimization (Step 1)') }}
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
     <button @click="triggerMcValidationStart" :disabled="isOptimizing || isMcValidating || !optimizationResultsAvailable">
      {{ isMcValidating ? 'Validating...' : 'Run MC Validation (Step 2)' }}
    </button>
  </div>
</template>

<style scoped>
  fieldset { margin-bottom: 1rem; border: 1px solid #555; padding: 1rem; border-radius: 4px; }
  legend { font-weight: bold; padding: 0 0.5rem; margin-left: 0.5rem; color: #ddd;}
  label { display: inline-block; min-width: 80px; margin-right: 5px; }
  input[type=number] { width: 100px; } /* Juster bredde på tall-input */
  input:disabled { background-color: #444; cursor: not-allowed; } /* Style for disabled inputs */
  button { margin-top: 0.5rem; padding: 8px 15px; cursor: pointer; }
  button:disabled { cursor: not-allowed; opacity: 0.6; }
  hr { border: none; border-top: 1px solid #444; margin: 1.5rem 0; }
</style>