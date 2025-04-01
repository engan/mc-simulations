<script setup lang="ts">
import { ref } from 'vue';
import SimulationControls from '../components/SimulationControls.vue';
import SimulationResults from '../components/SimulationResults.vue';
import { useKlines } from '../composables/useKlines'; 

// Type for det vi forventer fra optimization worker
interface BestParams { short: number; long: number; score: number; trades: number; }

// --- Interface for den mottatte payloaden (samme som i Controls) ---
interface StartMcPayload {
  mcSettings: {
    iterations: number;
    barsPerSim: number;
  };
  dataSource: {
    symbol: string;
    timeframe: string;
    limit: number;
  };
}

// --- Interface for dataInfo (NY) ---
interface DataInfo {
  symbol: string;
  timeframe: string;
  count: number;
  startTime: number;
  endTime: number;
}

// --- Interface for MC resultater som kan inkludere dataInfo ---
interface McResultsWithData {
    allPnLs_pct: number[];
    allMaxDrawdowns: number[];
    summaryStats: Record<string, number>;
    dataInfo?: DataInfo; // Gjør den valgfri
}

// Ref for å holde listen over topp resultater fra Steg 1
const optimizationTopResults = ref<BestParams[] | null>(null);
// Ref for å holde statusmeldinger
const currentStatusMessage = ref('Idle');
// Ref for å holde parametrene VALGT av brukeren for Steg 2
const selectedParamsForMc = ref<BestParams | null>(null);
// Ref for å holde resultatene fra Steg 2
const mcValidationResults = ref<McResultsWithData | null>(null);
// Ref til MC worker
let mcValidationWorker: Worker | null = null;
// Bruk useKlines her for å ha tilgang til klines og lastefunksjon
const { klines, loadKlines, isLoading: isLoadingKlines, error: klinesError } = useKlines();

// --- NYE Refs for å holde symbol/timeframe brukt for data ---
const currentSymbolForData = ref('');
const currentTimeframeForData = ref('');

// --- Event Handlers ---

function handleProgressUpdate(message: string) {
    currentStatusMessage.value = message;
    // Nullstill resultater når ny prosess starter
    if (message.startsWith("Starter")) {
        // optimizationTopResults.value = null; // Behold gjerne Steg 1 resultatene synlig?
        selectedParamsForMc.value = null;
        mcValidationResults.value = null;
    }
}

// Mottar LISTEN over topp resultater fra Steg 1
function handleOptimizationComplete(resultsList: BestParams[] | null) {
    optimizationTopResults.value = resultsList; // Lagre listen
    selectedParamsForMc.value = null; // Nullstill valgte params
    mcValidationResults.value = null; // Nullstill MC-resultater
    currentStatusMessage.value = (resultsList && resultsList.length > 0)
      ? `Optimalisering (Steg 1) ferdig! Fant ${resultsList.length} topp-resultater.`
      : "Optimalisering (Steg 1) fullført (ingen resultater funnet).";
}

// Mottar det ENE valgte parametersettet fra SimulationResults
function handleParamsSelectedForMc(params: BestParams) {
    // console.log("VIEW: handleParamsSelectedForMc called with:", params); // <-- Ny logg
    selectedParamsForMc.value = params;
    // console.log("VIEW: selectedParamsForMc.value is now:", JSON.stringify(selectedParamsForMc.value)); // <-- Ny logg
    currentStatusMessage.value = `Params ${params.short}/${params.long} selected for MC Validation.`;
    mcValidationResults.value = null; // Nullstill evt. gamle MC-resultater
}

// Mottar nå 'settings' payload fra SimulationControls
function handleStartMcValidationRequest(payload: StartMcPayload) {
  const { mcSettings, dataSource } = payload; // Pakk ut payloaden

  console.log("VIEW: handleStartMcValidationRequest triggered. selectedParamsForMc:", JSON.stringify(selectedParamsForMc.value), "Payload:", payload);

    if (!selectedParamsForMc.value) {
        currentStatusMessage.value = "Feil: Ingen parametere er valgt for MC validering.";
        return;
    }

    // --- Bruk dataSource fra payload ---
    const symbolToLoad = dataSource.symbol;
    const timeframeToLoad = dataSource.timeframe;
    const dataLimitToLoad = dataSource.limit;

    currentStatusMessage.value = `Starter MC for ${selectedParamsForMc.value.short}/${selectedParamsForMc.value.long} (${mcSettings.iterations} it, ${mcSettings.barsPerSim} bars). Henter data (${symbolToLoad} ${timeframeToLoad}, limit ${dataLimitToLoad})...`;
    mcValidationResults.value = null;

    // Kall loadKlines med verdiene fra dataSource
    loadKlines(symbolToLoad, timeframeToLoad, dataLimitToLoad)
        .then(() => {
          if (klinesError.value || klines.value.length < 2) {
                 currentStatusMessage.value = `MC Feil: Kunne ikke hente data (${symbolToLoad} ${timeframeToLoad}): ${klinesError.value || 'Ingen data'}`;
                 // Nullstill lagrede verdier ved feil?
                 currentSymbolForData.value = '';
                 currentTimeframeForData.value = '';
                 return;
             }

            // --- VIKTIG: Lagre symbol/timeframe NÅR data er hentet ---
            currentSymbolForData.value = symbolToLoad;
            currentTimeframeForData.value = timeframeToLoad;
            currentStatusMessage.value = `MC Data klar (${klines.value.length} barer for ${currentSymbolForData.value} ${currentTimeframeForData.value}). Starter MC Worker...`;

            if (!mcValidationWorker) {
                mcValidationWorker = new Worker(new URL('../workers/mcValidationWorker.ts', import.meta.url), { type: 'module' });
                 mcValidationWorker.onmessage = (event) => {
                    const { type, payload } = event.data;
                    if (type === 'mcProgress') { handleProgressUpdate(`MC: ${payload.message}`); }
                    else if (type === 'mcResult') { handleMcValidationComplete(payload); }
                    else if (type === 'mcError') { handleProgressUpdate(`MC Worker Feil: ${payload.message}`); }
                 };
                 mcValidationWorker.onerror = (event) => { handleProgressUpdate(`MC Worker Feil: ${event.message}`); };
            }

            // Send melding til MC worker - bruk mcSettings fra payload
            mcValidationWorker.postMessage({
                type: 'startMcValidation',
                payload: {
                    historicalKlines: JSON.parse(JSON.stringify(klines.value)),
                    parameters: JSON.parse(JSON.stringify(selectedParamsForMc.value)),
                    // Bruk mottatte verdier fra mcSettings:
                    numIterations: mcSettings.iterations,
                    numBarsPerSim: mcSettings.barsPerSim,
                    strategy: 'smaCross'
                }
            });
        })
        .catch(err => {
             // Sjekk om feilen er den kjente kloningsfeilen, eller noe annet
             const errorMessage = err.message.includes('could not be cloned')
               ? "Internal error preparing data for MC worker." // Mer brukervennlig melding
               : err.message;
             currentStatusMessage.value = `MC Feil under datahenting/start: ${errorMessage}`;
             console.error("Error during MC prep/start:", err); // Logg hele feilen
        });
}

// Mottar det endelige MC-resultatet
function handleMcValidationComplete(results: any) { // Mottar fortsatt 'any' fra worker
  console.log("SimulationView: Received mcResult payload:", results);

  // Lag et nytt objekt med riktig type
  const finalMcResults: McResultsWithData = {
      allPnLs_pct: results.allPnLs_pct || [],
      allMaxDrawdowns: results.allMaxDrawdowns || [],
      summaryStats: results.summaryStats || {},
      // Legg til dataInfo hvis klines finnes, bruk de lagrede refs
      dataInfo: (klines.value && klines.value.length > 0)
          ? {
                symbol: currentSymbolForData.value, // <-- Bruk ref
                timeframe: currentTimeframeForData.value, // <-- Bruk ref
                count: klines.value.length,
                startTime: klines.value[0].timestamp,
                endTime: klines.value[klines.value.length - 1].timestamp
            }
          : undefined // Ellers er dataInfo undefined
  };

  mcValidationResults.value = finalMcResults; // Sett ref til det typede objektet
  console.log("SimulationView: mcValidationResults ref set to:", mcValidationResults.value);
  currentStatusMessage.value = "MC Validering ferdig.";
}

</script>

<template>
  <main class="simulation-view">
    <h1>Monte Carlo Simulation Dashboard</h1>
    <div class="content-layout">
      <section class="controls-section">
        <SimulationControls
          @update-progress="handleProgressUpdate"
          @optimization-complete="handleOptimizationComplete"
          @start-mc-validation="handleStartMcValidationRequest"
        />
      </section>
      <section class="results-section">
        <SimulationResults
          :status-message="currentStatusMessage"
          :top-results="optimizationTopResults"
          :mc-results="mcValidationResults" 
          :selected-params-for-mc="selectedParamsForMc"
          @select-params-for-mc="handleParamsSelectedForMc"
        />
      </section>
    </div>
  </main>
</template>

<style scoped> /* (som før) */ </style>