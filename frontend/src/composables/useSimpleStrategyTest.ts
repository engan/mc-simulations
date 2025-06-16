// Composables for å håndtere logikk rundt den enkle strategitesten
// (datahenting, kall til Wasm, resultatbehandling).

// Dette er et Vue composable som vil orkestrere testingen.
// Det vil hente kline-data, kalle den Wasm-eksponerte run_simple_strategy-funksjonen,
// og administrere tilstanden for å vise resultater.

import { ref } from 'vue'
import { useKlines } from '@/composables/useKlines'
import type { BacktestResult } from '@/types/common_strategy_types'

let wasm: typeof import('@/rust/pkg/mc_simulations_proprietary')

export function useSimpleStrategyTest() {
  const isLoading = ref(false)
  // Henter den eksisterende composable
  const { klines, isLoading: klinesAreLoading, error, loadKlines } = useKlines()

  const initWasm = async () => {
    if (!wasm) {
      wasm = await import('@/rust/pkg/mc_simulations_proprietary.js')
      await wasm.default()
    }
    return wasm
  }

  const runSmaCrossoverBacktest = async (
    symbol: string,
    interval: string,
    limit: number,
    initialCapital: number,
    fastPeriod: number,
    slowPeriod: number,
    commissionPercent: number,
    slippageTicks: number,
    tickSize: number,
  ): Promise<BacktestResult> => {
    isLoading.value = true
    try {
      const wasmInstance = await initWasm()
      // Gi greet() et argument, som den nå forventer
      wasmInstance.greet('Vue Frontend')

      // Hent kline-data ved å bruke din eksisterende 'loadKlines'-funksjon
      await loadKlines(symbol, interval, limit)

      // Vent til klines er lastet og ikke er tomme
      if (klinesAreLoading.value || !klines.value || klines.value.length === 0 || error.value) {
        throw new Error('Could not fetch klines from Binance API or an error occurred.')
      }

      // Kall den nye Wasm-funksjonen med de nye parameterne
      const results = wasmInstance.run_sma_crossover_backtest(
        klines.value,
        initialCapital,
        fastPeriod,
        slowPeriod,
        commissionPercent,
        slippageTicks,
        tickSize
      );
      return results as BacktestResult; 
    } catch (e) {
      console.error('Error in runBacktest:', e);
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  const runSmaDebug = async (
    symbol: string,
    interval: string,
    limit: number,
    fast: number,
    slow: number,
  ): Promise<[(number | null)[], (number | null)[]]> => {
    isLoading.value = true
    try {
      const wasmInstance = await initWasm()
      await loadKlines(symbol, interval, limit)

      if (!klines.value || klines.value.length === 0) {
        throw new Error('No klines for debug')
      }

      const results = wasmInstance.calculate_smas_for_debug(klines.value, fast, slow)
      return results as [(number | null)[], (number | null)[]]
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    runSmaCrossoverBacktest,
    runSmaDebug,
  }
}
