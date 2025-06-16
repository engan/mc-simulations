<template>
  <div class="test-view">
    <h1>SMA Crossover Backtest (Rust/WASM)</h1>
    
    <!-- FJERNET <div class="grid-container"> -->
    
    <!-- Seksjon 1: Parametere -->
    <div class="control-group">
      <h3>Parameters</h3>
      <label>Fast SMA Period:</label>
      <input type="number" v-model.number="fastPeriod" />
      <label>Slow SMA Period:</label>
      <input type="number" v-model.number="slowPeriod" />
      <label>Commission (%):</label>
      <input type="number" v-model.number="commissionPercent" step="0.01" />
      <label>Slippage (ticks):</label>
      <input type="number" v-model.number="slippageTicks" />      
      <button @click="runTest" :disabled="isLoading">Run Test</button>
     	<!-- <button @click="debugSmaValues" :disabled="isLoading">
      	Debug SMA Values
    	</button> -->
    </div>

    <!-- Seksjon 2: Nøkkeltall -->
    <div class="summary-container" v-if="results">
      <h3>Backtest Results</h3>
      <div class="summary-metrics">
        <div>
        <strong>Total P&L:</strong><br>
        <span :class="formattedTotalPnl.class">{{ formattedTotalPnl.text }}</span>
        </div>
        <div><strong>Max Drawdown:</strong><br>{{ results.summary.max_drawdown_percent.toFixed(2) }} %</div>
        <div><strong>Total Trades:</strong><br>{{ results.summary.total_trades }}</div>
        <div><strong>Profitable:</strong><br>{{ (results.summary.profitable_trades / results.summary.total_trades * 100).toFixed(2) }}% ({{ results.summary.profitable_trades }})</div>
        <div><strong>Profit Factor:</strong><br>{{ results.summary.profit_factor.toFixed(3) }}</div>
      </div>
    </div>

    <!-- Grid Item 3: Graf -->
     <div class="chart-wrapper" v-if="results">
        <h3>Equity Curve</h3>
        <EquityChart 
          :equity-curve="results.equity_curve" 
          :max-points="2000" 
        />
      </div>

    <!-- Seksjon 4: Tabell med handler -->
    <div class="trades-wrapper" v-if="results">
      <h3>Trades</h3>
        <table v-if="results.trades.length > 0">
          <thead>
            <tr>
              <th>Direction</th>
              <th>Entry Bar</th>
              <th>Entry Price</th>
              <th>Exit Bar</th>
              <th>Exit Price</th>
              <th>PnL</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(trade, index) in results.trades" :key="index">
              <td>{{ trade.direction }}</td>
              <td>{{ trade.entry_bar_index }}</td>
              <td>{{ trade.entry_price.toFixed(2) }} {{ quoteCurrency }}</td>
              <td>{{ trade.exit_bar_index }}</td>
              <td>{{ trade.exit_price?.toFixed(2) }} {{ quoteCurrency }}</td>
              <td :class="{ profit: trade.pnl !== undefined && trade.pnl > 0, loss: trade.pnl !== undefined && trade.pnl < 0 }">
                {{ trade.pnl?.toFixed(2) }} {{ quoteCurrency }}
              </td>
            </tr>
          </tbody>
        </table>
        <p v-else>No trades were executed.</p>
    </div>
    
    <!-- FJERNET </div> for grid-container -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSimpleStrategyTest } from '@/composables/useSimpleStrategyTest';
import type { BacktestResult } from '@/types/common_strategy_types';
import EquityChart from '@/components/EquityChart.vue'; 

const { isLoading, runSmaCrossoverBacktest, /* runSmaDebug */} = useSimpleStrategyTest();

const fastPeriod = ref(10);
const slowPeriod = ref(64);
const commissionPercent = ref(0.05);
const slippageTicks = ref(2);

// Nå lagrer vi hele resultat-objektet
const results = ref<BacktestResult | null>(null);
const initialCapital = 10000;
const quoteCurrency = ref('USDT');

const runTest = async () => {
  results.value = null;

  const symbol = 'SOLUSDT';
  const interval = '1h';
  const limit = 12777; // 5 år med 1 time intervaller?

  if (symbol.endsWith('USDT')) {
    quoteCurrency.value = 'USDT';
  } else if (symbol.endsWith('USD')) {
    quoteCurrency.value = 'USD';
  } else if (symbol.endsWith('EUR')) {
    quoteCurrency.value = 'EUR';
  } else if (symbol.endsWith('BTC')) {
    quoteCurrency.value = 'BTC';
  }

  // Anta tick size for SOLUSDT
  const tickSize = 0.01;  

  try {
    results.value = await runSmaCrossoverBacktest(
      symbol, interval, limit, initialCapital,
      fastPeriod.value, slowPeriod.value,
      // Send med de nye verdiene
      commissionPercent.value,
      slippageTicks.value,
      tickSize
    );
  } catch (error) {
    console.error("Failed to run backtest:", error);
    alert("An error occurred. Check the console for details.");
  }
};

const formattedTotalPnl = computed(() => {
  // Returner en standardverdi hvis vi ikke har resultater ennå
  if (!results.value) {
    return { text: '0.00 USDT', class: '' };
  }

  const pnl = results.value.summary.total_pnl;
  const percentage = (pnl / initialCapital) * 100;
  
  const sign = pnl >= 0 ? '+' : '';
  const pnlColorClass = pnl > 0 ? 'profit' : (pnl < 0 ? 'loss' : '');

  return {
    text: `${sign}${pnl.toFixed(2)} ${quoteCurrency.value} (${sign}${percentage.toFixed(2)}%)`,
    class: pnlColorClass
  };
});
/*
const debugSmaValues = async () => {
  try {
    const [smaFast, smaSlow] = await runSmaDebug('SOLUSDT', '1h', 50, fastPeriod.value, slowPeriod.value);
    console.clear();
    console.log("--- SMA DEBUG RESULTS (Rust/WASM) ---");
    
    const tableData = [];
    for (let i = 0; i < smaFast.length; i++) {
        tableData.push({
            "Bar Index": i,
            "SMA Fast (10)": smaFast[i]?.toFixed(4) ?? 'null',
            "SMA Slow (20)": smaSlow[i]?.toFixed(4) ?? 'null',
        });
    }
    console.table(tableData);
    alert("SMA debug data has been logged to the browser console (F12). Please compare with TradingView's Data Window.");
  } catch (error) {
    console.error("Failed to run SMA debug:", error);
    alert("An error occurred during debug. Check console.");
  }
}; */
</script>

<style scoped>
.test-view {
  padding: 1rem;
  /* Ingen max-width her, la den fylle tilgjengelig plass */
}

/* Felles stil for alle boksene */
.control-group,
.summary-container,
.chart-wrapper,
.trades-wrapper {
  border: 1px solid #444;
  padding: 0.5rem;
  border-radius: 8px;
  background-color: #2a2a2a;
  margin-bottom: 1.5rem; /* Mellomrom mellom hver seksjon */
}

/* Styling for nøkkeltallene */
.summary-metrics {
  display: flex;
  justify-content: space-around;
  padding-top: 1rem;
  text-align: center;
}
.summary-metrics div {
  text-align: center;
}

.profit {
  color: #4CAF50; /* En fin og lesbar grønnfarge */
  font-weight: 500;
}

.loss {
  color: #F44336; /* En klar, men ikke for skarp, rødfarge */
  font-weight: 500;
}

/* Generell styling */
h3 { margin-top: 0; border-bottom: 1px solid #555; padding-bottom: 0.5rem; }
table { width: 100%; border-collapse: collapse; margin-top: 1rem;}
th, td { border: 1px solid #444; padding: 8px; text-align: left; }
th { background-color: #333; color: #f0f0f0; font-weight: bold; }
input { margin: 0 1rem 0 0.5rem; width: 80px; }
button { vertical-align: middle; }
</style>