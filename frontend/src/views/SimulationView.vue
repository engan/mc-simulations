<script setup lang="ts">
import { ref } from 'vue';
import SimulationControls from '../components/SimulationControls.vue';
import SimulationResults from '../components/SimulationResults.vue';
import { useKlines } from '../composables/useKlines';

// --- IMPORTER SENTRALE TYPER ---
import type {
    TopResultItem,
    StartMcValidationPayload, // Payload som skal sendes til MC worker
    McResultData,             // Type for MC resultater mottatt
    SmaBestParams,            // For type checking i handlers
    RsiBestParams,            // For type checking i handlers
    DataInfo                  // For å bygge dataInfo-delen
} from '../types/simulation'; // <-- Importer fra ny fil


// Ref for å holde listen over topp resultater fra Steg 1
const optimizationTopResults = ref<TopResultItem[] | null>(null); 
// Ref for å holde statusmeldinger
const currentStatusMessage = ref('Idle');
// Ref for å holde parametrene VALGT av brukeren for Steg 2
const selectedParamsForMc = ref<TopResultItem | null>(null);
// Ref for å holde resultatene fra Steg 2
const mcValidationResults = ref<McResultData | null>(null);
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
        selectedParamsForMc.value = null;
        mcValidationResults.value = null;
    }
}


// Mottar LISTEN over topp resultater fra Steg 1
function handleOptimizationComplete(resultsList: TopResultItem[] | null) { // Bruker importert TopResultItem
    optimizationTopResults.value = resultsList;
    selectedParamsForMc.value = null;
    mcValidationResults.value = null;
    currentStatusMessage.value = (resultsList && resultsList.length > 0)
      ? `Optimalisering (${resultsList[0]?.type ?? 'N/A'}) ferdig! Fant ${resultsList.length} topp-resultater.`
      : "Optimalisering fullført (ingen resultater funnet).";
}

// Mottar det ENE valgte parametersettet fra SimulationResults
function handleParamsSelectedForMc(params: TopResultItem) { // Bruker importert TopResultItem
    console.log("VIEW: handleParamsSelectedForMc called with:", params);
    selectedParamsForMc.value = params;
    console.log("VIEW: selectedParamsForMc.value is now:", JSON.stringify(selectedParamsForMc.value));
    let paramString = '';
    // Bruk type guards eller assertions her hvis nødvendig
    if (params.type === 'smaCross') {
        // Nå vet TS at params er SmaBestParams her
        paramString = `${params.short}/${params.long}`;
    } else if (params.type === 'rsi') {
        // Nå vet TS at params er RsiBestParams her
        paramString = `Period ${params.period}`;
    }
    currentStatusMessage.value = `Params ${paramString} (${params.type}) selected for MC Validation.`;
    mcValidationResults.value = null;
}

// Definer typen for den enkle payloaden fra Controls lokalt her,
// siden den bare brukes i denne ene funksjonen for mottak.
type StartMcTriggerPayload = {
  mcSettings: { iterations: number; barsPerSim: number };
  dataSource: { symbol: string; timeframe: string; limit: number; };
}

// Funksjonen mottar fortsatt den *enkle* payloaden fra Controls for nå
function handleStartMcValidationRequest(triggerPayload: StartMcTriggerPayload) { // Bruker lokal type
  console.log("VIEW: handleStartMcValidationRequest triggered. triggerPayload:", triggerPayload);

  type StartMcTriggerPayload = {
      mcSettings: { iterations: number; barsPerSim: number };
      dataSource: { symbol: string; timeframe: string; limit: number; };
      costs: { commissionPct: number, slippageAmount: number }; // <-- Inkluderer nå costs
    }

    const receivedPayload = triggerPayload as StartMcTriggerPayload; // Type assertion for klarhet

    console.log("VIEW: handleStartMcValidationRequest triggered. Received Payload:", receivedPayload);
  
    if (!selectedParamsForMc.value) {
        currentStatusMessage.value = "Feil: Ingen parametere er valgt for MC validering.";
        return;
    }

    // Pakk ut alt fra mottatt payload
    const { mcSettings, dataSource, costs } = receivedPayload;
    const selectedParams = selectedParamsForMc.value;
    const strategyToRun = selectedParams.type;

    let paramString = '';
    // Type assertions for å få tilgang til spesifikke felter
    if (strategyToRun === 'smaCross') { paramString = `${(selectedParams as SmaBestParams).short}/${(selectedParams as SmaBestParams).long}`; }
    else if (strategyToRun === 'rsi') { paramString = `Period ${(selectedParams as RsiBestParams).period}`; }

    currentStatusMessage.value = `Starter MC for ${strategyToRun} ${paramString} (${mcSettings.iterations} it, ${mcSettings.barsPerSim} bars). Henter data (${dataSource.symbol} ${dataSource.timeframe})...`;
    mcValidationResults.value = null;

    loadKlines(dataSource.symbol, dataSource.timeframe, dataSource.limit)
        .then(() => {
          if (klinesError.value || klines.value.length < 2) {
                 currentStatusMessage.value = `MC Feil: Kunne ikke hente data eller for lite data (${klines.value?.length ?? 0} barer) for bootstrapping.`;
                 return;
             }
            currentSymbolForData.value = dataSource.symbol;
            currentTimeframeForData.value = dataSource.timeframe;
            currentStatusMessage.value = `MC Data klar (${klines.value.length} barer). Starter MC Worker...`;

            if (!mcValidationWorker) {
                mcValidationWorker = new Worker(new URL('../workers/mcValidationWorker.ts', import.meta.url), { type: 'module' });
                mcValidationWorker.onmessage = (event) => { handleMcWorkerMessage(event); }; // Bruk en dedikert handler
                mcValidationWorker.onerror = (event) => { handleMcWorkerError(event); }; // Bruk en dedikert handler
            }

            // --- Bygg den *fulle* payloaden for MC worker MED costs ---
            const mcWorkerPayload: StartMcValidationPayload = { // Bruker importert type
                mcSettings: mcSettings,
                dataSource: dataSource,
                selectedStrategyParams: JSON.parse(JSON.stringify(selectedParams)),
                strategy: strategyToRun,
                historicalKlines: JSON.parse(JSON.stringify(klines.value)),
                costs: costs // <-- Legg til costs fra mottatt payload
            };

            console.log("VIEW: Posting message to MC worker:", mcWorkerPayload);
            mcValidationWorker.postMessage({
                type: 'startMcValidation',
                payload: mcWorkerPayload
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

// Dedikerte handlers for worker meldinger/feil
function handleMcWorkerMessage(event: MessageEvent) {
    const { type, payload } = event.data;
    if (type === 'mcProgress') { handleProgressUpdate(`MC: ${payload.message}`); }
    else if (type === 'mcResult') { handleMcValidationComplete(payload); } // Kall eksisterende slutt-handler
    else if (type === 'mcError') { handleProgressUpdate(`MC Worker Feil: ${payload.message}`); }
}
function handleMcWorkerError(event: Event | string) {
    const message = event instanceof Event ? (event as ErrorEvent).message : String(event);
    handleProgressUpdate(`MC Worker Feil: ${message}`);
}

// Mottar det endelige MC-resultatet
function handleMcValidationComplete(results: McResultData) { // Mottar nå McResultData direkte (eller any hvis worker ikke er typet)
  console.log("SimulationView: Received mcResult payload:", results);

   // Bygg dataInfo (som før)
  let dataInfoPart: { dataInfo?: DataInfo } = {}; // Bruker importert DataInfo
   if (klines.value && klines.value.length > 0) {
       dataInfoPart.dataInfo = {
           symbol: currentSymbolForData.value,
           timeframe: currentTimeframeForData.value,
           count: klines.value.length,
           startTime: klines.value[0].timestamp,
           endTime: klines.value[klines.value.length - 1].timestamp
       };
   }

  // Anta at results *er* McResultData (kan trenge type guard fra worker senere)
  mcValidationResults.value = { ...results, ...dataInfoPart };

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
         <!-- SimulationResults må også oppdateres til å håndtere TopResultItem -->
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