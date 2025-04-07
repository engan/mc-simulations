<script setup lang="ts">
import { ref, watch, computed, type Ref } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type {
    TopResultItem,
    SmaBestParams,
    RsiBestParams,
    McResultData
} from '../types/simulation';

// Props definisjon (som før)
const props = defineProps<{
  statusMessage?: string;
  topResults?: TopResultItem[] | null;
  mcResults?: McResultData | null;
  selectedParamsForMc?: TopResultItem | null;
}>();

// Definerer event for å sende valgte params oppover
const emit = defineEmits(['select-params-for-mc']);

// Refs for ApexCharts
const pnlChartOptions: Ref<ApexOptions> = ref({});
const pnlChartSeries: Ref<ChartSeries> = ref([]);
const ddChartOptions: Ref<ApexOptions> = ref({});
const ddChartSeries: Ref<ChartSeries> = ref([]);

  // --- NY Hjelpefunksjon for unik nøkkel i v-for ---
function generateResultKey(result: TopResultItem): string {
    if (result.type === 'smaCross') {
        return `sma-${result.short}-${result.long}`;
    } else if (result.type === 'rsi') {
        return `rsi-${result.period}`;
    }
    // Fallback (bør ikke skje)
    return `unknown-${Math.random()}`;
}

// Definer ChartSeries type hvis den ikke er importert
type ChartSeries = { name: string; data: number[] }[];

// --- Fungerende createHistogramBins funksjon ---
function createHistogramBins(values: number[] | undefined | null, numBins: number = 20): { categories: string[], data: number[] } {
  if (!values || values.length === 0) return { categories: [], data: [] };
  const numericValues = values.filter(v => typeof v === 'number' && isFinite(v));
  if (numericValues.length === 0) return { categories: [], data: [] };
  const minVal = Math.min(...numericValues);
  let maxVal = Math.max(...numericValues);
  if (minVal === maxVal) return { categories: [minVal.toFixed(2)], data: [numericValues.length] };
  maxVal = maxVal + (maxVal - minVal) * 0.001;
  const binSize = (maxVal - minVal) / numBins;
  const categories: string[] = [];
  const data: number[] = Array(numBins).fill(0);
  for (let i = 0; i < numBins; i++) {
    const lowerBound = minVal + i * binSize;
    const upperBound = minVal + (i + 1) * binSize;
    categories.push(`${lowerBound.toFixed(2)} til ${upperBound.toFixed(2)}`);
  }
  for (const value of numericValues) {
    if (typeof value !== 'number' || !isFinite(value)) continue;
    let binIndex = Math.floor((value - minVal) / binSize);
    if (value >= maxVal) binIndex = numBins - 1;
    else if (value === minVal) binIndex = 0;
    binIndex = Math.max(0, Math.min(binIndex, numBins - 1));
    data[binIndex]++;
  }
  return { categories, data };
}

// --- Watcher for å oppdatere charts ---
watch(() => props.mcResults, (newResults) => {
  console.log("Watcher trigget for mcResults:", newResults);
  if (newResults && newResults.allPnLs_pct  &&  newResults.allMaxDrawdowns) {
    try {
      // P/L Histogram
      const pnlHist = createHistogramBins(newResults.allPnLs_pct, 20);
      console.log("PNL Hist Data:", pnlHist); // Logg resultatet fra binning
      if (pnlHist.data.length > 0) {
         pnlChartOptions.value = {
            chart: { id: 'pnlHist', type: 'bar', height: 350, foreColor: '#ccc' },
            xaxis: { categories: pnlHist.categories, title: { text: 'Profit/Loss % Range', style: { color: '#ccc' } }, labels: { style: { colors: '#ccc' }, trim: true, rotate: -45, hideOverlappingLabels: false } },
            yaxis: { title: { text: 'Frequency', style: { color: '#ccc' } }, labels: { style: { colors: '#ccc' } } },
            title: { text: 'P/L % Distribution', align: 'left', style: { color: '#eee' } },
            theme: { mode: 'dark' }, grid: { borderColor: '#555' }, tooltip: { theme: 'dark' }
         };
         pnlChartSeries.value = [{ name: 'Frequency', data: pnlHist.data }];
         console.log("P/L % Chart updated");
      } else { pnlChartSeries.value = []; }

      // Drawdown Histogram
      const ddHist = createHistogramBins(newResults.allMaxDrawdowns, 20);
      if (ddHist.data.length > 0) {
         ddChartOptions.value = {
             chart: { id: 'ddHist', type: 'bar', height: 350, foreColor: '#ccc' },
             xaxis: { categories: ddHist.categories, title: { text: 'Max Drawdown Range', style: { color: '#ccc' } }, labels: { style: { colors: '#ccc' }, trim: true, rotate: -45, hideOverlappingLabels: false } },
             yaxis: { title: { text: 'Frequency', style: { color: '#ccc' } }, labels: { style: { colors: '#ccc' } } },
             title: { text: 'Max Drawdown Distribution', align: 'left', style: { color: '#eee' } },
             theme: { mode: 'dark' }, grid: { borderColor: '#555' }, tooltip: { theme: 'dark' }
         };
         ddChartSeries.value = [{ name: 'Frequency', data: ddHist.data }]; 
          console.log("DD Chart updated");
      } else { ddChartSeries.value = []; } 

    } catch (e) { console.error("Feil under oppdatering av charts:", e); pnlChartSeries.value = []; ddChartSeries.value = [];}
  } else { 
    pnlChartSeries.value = []; 
    ddChartSeries.value = []; 
    console.log("mcResults er null, tømmer charts."); }
}, { deep: true, immediate: false });

</script>

<template>
  <div class="results-display">
    <h2>Simulation Results</h2>
    <div class="status-line">
      <strong>Status:</strong> {{ statusMessage || 'Idle' }}
    </div>

    <!-- Vis LISTE med resultater fra Steg 1 -->
    <!-- Vises når topResults finnes OG mcResults IKKE har data -->
    <div v-if="topResults && topResults.length > 0 && !mcResults" class="result-block">
      <h4>Top Parameters (Step 1 - Grid Search):</h4>
      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Params</th>
            <th>PF (Score)</th>
            <th>Trades</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          <!-- Bruk v-if inne i løkken for å vise riktige params -->
          <tr v-for="(result) in topResults" :key="generateResultKey(result)">
            <td>{{ result.type }}</td>
            <td>
              <!-- Vis SMA Params -->
              <span v-if="result.type === 'smaCross'">
                {{ (result as SmaBestParams).short }} / {{ (result as SmaBestParams).long }}
              </span>
              <!-- Vis RSI Params -->
              <span v-else-if="result.type === 'rsi'">
                Period: {{ (result as RsiBestParams).period }}
              </span>
            </td>
            <td>{{ result.score.toFixed(3) }}</td>
            <td>{{ result.trades }}</td>
            <td>
              <button @click="$emit('select-params-for-mc', result)">Select</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Vis resultater fra Steg 2 (MC) -->
    <div v-if="mcResults" class="result-block">
      <h4>Monte Carlo Validation Results</h4>
      <details open style="margin-bottom: 1rem;">
        <summary>Context</summary>
        <table>
          <tbody>
            <!-- Parameters - Vis basert på type -->
            <template v-if="selectedParamsForMc">
                <!-- Alltid vis strategitype -->
                <tr><td>Strategy</td><td>{{ selectedParamsForMc.type }}</td></tr>

                <!-- Vis SMA Params hvis det er valgt -->
                <template v-if="selectedParamsForMc.type === 'smaCross'">
                    <tr><td>Short SMA</td><td>{{ (selectedParamsForMc as SmaBestParams).short }}</td></tr>
                    <tr><td>Long SMA</td><td>{{ (selectedParamsForMc as SmaBestParams).long }}</td></tr>
                </template>
                <!-- Vis RSI Params hvis det er valgt -->
                <template v-else-if="selectedParamsForMc.type === 'rsi'">
                    <tr><td>RSI Period</td><td>{{ (selectedParamsForMc as RsiBestParams).period }}</td></tr>
                    <!-- Kan legge til Buy/Sell Level hvis de lagres i RsiBestParams -->
                    <!-- <tr><td>RSI Buy Level</td><td>...</td></tr> -->
                    <!-- <tr><td>RSI Sell Level</td><td>...</td></tr> -->
                </template>
            </template>

            <!-- MC Settings (som før) -->
            <tr v-if="mcResults.summaryStats?.numIterations !== undefined"><td>Iterations</td><td>{{ mcResults.summaryStats.numIterations }}</td></tr>
            <tr v-if="mcResults.summaryStats?.numBarsPerSim !== undefined"><td>Bars per Sim</td><td>{{ mcResults.summaryStats.numBarsPerSim }}</td></tr>

            <!-- Data Info (som før) -->
            <template v-if="mcResults.dataInfo">
                <tr><td colspan="2" style="height: 10px; border: none; background: none;"></td></tr> <!-- Separator -->
                <tr><td>Symbol</td><td>{{ mcResults.dataInfo.symbol }}</td></tr>
                <tr><td>Timeframe</td><td>{{ mcResults.dataInfo.timeframe }}</td></tr>
                <tr><td>Historical Bars</td><td>{{ mcResults.dataInfo.count }}</td></tr>
                <tr><td>Data Start</td><td>{{ new Date(mcResults.dataInfo.startTime).toLocaleString() }}</td></tr>
                <tr><td>Data End</td><td>{{ new Date(mcResults.dataInfo.endTime).toLocaleString() }}</td></tr>
            </template>
          </tbody>
        </table>
      </details>

      <!-- *** NY TABELL FOR SUMMARY STATS *** -->
      <div v-if="mcResults.summaryStats && Object.keys(mcResults.summaryStats).length > 2"> 
           <h5>Summary Statistics:</h5>
           <table class="summary-stats-table">
               <tbody>
                   <!-- Formaterte P/L Stats -->
                   <tr v-if="mcResults.summaryStats.averagePL_pct !== undefined">
                       <td>Avg. P/L %</td>
                       <td>{{ mcResults.summaryStats.averagePL_pct.toFixed(2) }}%</td>
                   </tr>
                   <tr v-if="mcResults.summaryStats.medianPL_pct !== undefined">
                       <td>Median P/L %</td>
                       <td>{{ mcResults.summaryStats.medianPL_pct.toFixed(2) }}%</td>
                   </tr>
                   <tr v-if="mcResults.summaryStats.pnl_05_percentile_pct !== undefined">
                       <td>5th Percentile P/L % (VaR 95%)</td>
                       <td>{{ mcResults.summaryStats.pnl_05_percentile_pct.toFixed(2) }}%</td>
                   </tr>
                   <tr v-if="mcResults.summaryStats.pnl_10_percentile_pct !== undefined">
                        <td>10th Percentile P/L % (VaR 90%)</td>
                        <td>{{ mcResults.summaryStats.pnl_10_percentile_pct.toFixed(2) }}%</td>
                    </tr>

                   <!-- Separator -->
                   <tr><td colspan="2" style="height: 10px; border: none;"></td></tr>

                   <!-- Formaterte Max Drawdown Stats -->
                   <tr v-if="mcResults.summaryStats.averageMaxDD !== undefined">
                       <td>Avg. Max Drawdown %</td>
                       <td>{{ mcResults.summaryStats.averageMaxDD.toFixed(2) }}%</td>
                   </tr>
                   <tr v-if="mcResults.summaryStats.medianMaxDD !== undefined">
                       <td>Median Max Drawdown %</td>
                       <td>{{ mcResults.summaryStats.medianMaxDD.toFixed(2) }}%</td>
                   </tr>
                   <tr v-if="mcResults.summaryStats.maxDD_95_percentile !== undefined">
                       <td>95th Percentile Max Drawdown %</td>
                       <td>{{ mcResults.summaryStats.maxDD_95_percentile.toFixed(2) }}%</td>
                   </tr>

                   <!-- Iterations/Bars per sim (kan også vises her hvis ikke over) -->
                   <!--
                   <tr v-if="mcResults.summaryStats.numIterations !== undefined">
                       <td>Iterations Ran</td>
                       <td>{{ mcResults.summaryStats.numIterations }}</td>
                   </tr>
                   <tr v-if="mcResults.summaryStats.numBarsPerSim !== undefined">
                       <td>Bars per Simulation</td>
                       <td>{{ mcResults.summaryStats.numBarsPerSim }}</td>
                   </tr>
                   -->
               </tbody>
           </table>
       </div>
       <p v-else>Summary statistics not available.</p>
       <!-- *** SLUTT NY TABELL *** -->

       <div class="charts-container">
         <div v-if="pnlChartSeries.length > 0">
             <p>P/L Distribution:</p>
           <VueApexCharts type="bar" height="350" :options="pnlChartOptions" :series="pnlChartSeries"></VueApexCharts>
         </div>
         <!-- Melding hvis P/L-grafen ikke har data, men MC-resultater ellers finnes -->
         <p v-else-if="mcResults">Processing P/L data or no valid P/L data found...</p>

         <div v-if="ddChartSeries.length > 0">
             <p>Max Drawdown Distribution:</p>
           <VueApexCharts type="bar" height="350" :options="ddChartOptions" :series="ddChartSeries"></VueApexCharts>
         </div>
         <!-- Melding hvis DD-grafen ikke har data, men MC-resultater ellers finnes -->
         <p v-else-if="mcResults">Processing Drawdown data or no valid Drawdown data found...</p>

       </div>
     </div>

     <!-- Viser melding hvis ingen resultater er klare ennå, men prosess er startet -->
     <div v-else-if="!topResults && (statusMessage && statusMessage !== 'Idle' && !statusMessage.includes('Feil'))">
        <p>Processing...</p>
     </div>

     <!-- Viser melding hvis ingen prosess er startet -->
     <div v-else-if="statusMessage === 'Idle'">
        <p>Ready to start optimization.</p>
     </div>
     <!-- Feilmeldinger håndteres nå primært av statusMessage, men kan legge til en spesifikk her -->
     <div v-else-if="statusMessage?.includes('Feil')">
         <p style="color: red;">An error occurred. Check status message above or console.</p>
     </div>

  </div>
</template>

<style scoped>
.results-display {
  min-height: 200px;
}
.status-line {
  background-color: #3a3a3a;
  padding: 8px 12px;
  border-radius: 4px;
  margin-bottom: 1rem;
  font-style: italic;
}
.result-block {
  margin-top: 1rem;
  border-top: 1px solid #444;
  padding-top: 1rem;
}
table {
  width: 100%;
  margin-top: 0.5rem;
  border-collapse: collapse;
}
th, td {
  border: 1px solid #444;
  padding: 6px 8px;
  text-align: left;
}
th {
  background-color: #3f3f3f;
}
/* Styling for the new summary table */
.summary-stats-table {
  width: auto; /* La den tilpasse seg innholdet */
  min-width: 300px; /* Gi den litt minimumsbredde */
  margin-top: 0.5rem;
  margin-bottom: 1.5rem;
  border-collapse: collapse;
}
.summary-stats-table td {
  border: 1px solid #444;
  padding: 5px 8px;
  text-align: left;
}
.summary-stats-table td:first-child {
  font-weight: bold;
  background-color: #3a3a3a; /* Litt mørkere bakgrunn for labels */
  min-width: 200px; /* Sørg for at labels har nok plass */
}
.summary-stats-table td:last-child {
  text-align: right; /* Høyrejuster tallene */
   min-width: 80px;
}
pre { background: #222; color: #ccc; padding: 10px; border-radius: 5px; font-size: 0.9em; max-height: 300px; overflow: auto; }
</style>