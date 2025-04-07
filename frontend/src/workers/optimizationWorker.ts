import init, {
  run_backtest_sma_cross_wasm,
  run_backtest_rsi_wasm,
} from '../rust/pkg/mc_simulations.js' // Importer kun funksjonen

// --- IMPORTER SENTRALE TYPER ---
import type {
  OptimizationStrategyInfo, // Info mottatt fra Controls
  SmaOptimizationParams,
  RsiOptimizationParams,
  TopResultItem, // Resultat som sendes tilbake
  SmaBestParams,
  RsiBestParams,
} from '../types/simulation' // <-- Importer fra den sentrale filen

import type { BacktestResultWasm } from '../rust/pkg/mc_simulations' // Fra Wasm

console.log('Optimization Worker (TypeScript) Loaded')

// --- Type-definisjoner ---
interface Kline {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// Oppdatert incoming payload type (bruker importerte typer)
interface WorkerIncomingPayload {
  historicalKlines: Kline[] // Bruker lokal Kline-type
  strategyInfo: OptimizationStrategyInfo // Bruker importert type
}

declare const self: DedicatedWorkerGlobalScope

let wasmInitialized = false
const ERROR_PF_VALUE = -1.0 // Må matche Rust
const TOP_N_RESULTS = 5 // Antall toppresultater - topp 5

// --- Hoved Worker Logikk ---
self.onmessage = async (event: MessageEvent<{ type: string; payload: any }>) => {
  const { type, payload } = event.data

  if (type === 'startOptimization') {
    console.log('Worker (TS) received startOptimization:', payload)

    // --- Wasm Init (som før) ---
    if (!wasmInitialized) {
      try {
        console.log('Worker (TS): Initializing Wasm...')
        await init()
        wasmInitialized = true
        console.log('Worker (TS): Wasm initialized.')
      } catch (err) {
        /* ... (feilhåndtering som før) */
      }
    }

    const optimizationPayload = payload as WorkerIncomingPayload
    // --- Hent ut data og strategyInfo ---
    const { historicalKlines, strategyInfo } = optimizationPayload
    const { strategy, params } = strategyInfo // params inneholder nå kostnader

    // --- Hent ut kostnader ---
    const commissionPct = params.commissionPct
    const slippageAmount = params.slippageAmount

    const closePrices: number[] = historicalKlines.map((k) => k.close)
    const closePricesTyped = new Float64Array(closePrices)

    // --- Initialiser resultatlister ---
    let topResults: TopResultItem[] = [] // Bruker nå union type
    let combinationsTested: number = 0
    let totalCombinations: number = 0 // Beregnes basert på strategi

    // --- Start optimalisering basert på strategi ---
    if (strategy === 'smaCross') {
      // --- SMA Crossover Logikk ---
      const smaParams = params as SmaOptimizationParams // Type assertion
      const paramShort = smaParams.shortSma
      const paramLong = smaParams.longSma
      totalCombinations =
        Math.max(1, Math.floor((paramShort.max - paramShort.min) / paramShort.step) + 1) *
        Math.max(1, Math.floor((paramLong.max - paramLong.min) / paramLong.step) + 1)

      self.postMessage({
        type: 'progress',
        payload: {
          message: `Starting SMA Grid Search. Total combinations: ~${Math.round(totalCombinations)}`,
        },
      })

      for (let shortP = paramShort.min; shortP <= paramShort.max; shortP += paramShort.step) {
        for (let longP = paramLong.min; longP <= paramLong.max; longP += paramLong.step) {
          if (shortP >= longP) continue
          let backtestResult: BacktestResultWasm | null = null
          try {
            // --- LEGG TIL KOSTNADER I WASM-KALL ---
            backtestResult = run_backtest_sma_cross_wasm(
              closePricesTyped,
              shortP,
              longP,
              commissionPct, // <-- Ny
              slippageAmount, // <-- Ny
            )

            if (!backtestResult || backtestResult.profit_factor === ERROR_PF_VALUE) {
              continue
            }

            const currentResult: SmaBestParams = {
              type: 'smaCross', // Viktig for mottaker
              short: shortP,
              long: longP,
              score: backtestResult.profit_factor,
              trades: backtestResult.trades,
            }

            // --- Oppdatert topp N logikk (bruker nå TopResultItem) ---
            updateTopResults(topResults, currentResult)
          } catch (wasmError) {
            /* ... (feilhåndtering som før) */
          } finally {
            if (backtestResult) backtestResult.free()
          }

          combinationsTested++
          if (
            combinationsTested % (Math.floor(totalCombinations / 50) + 1) === 0 ||
            combinationsTested >= totalCombinations
          ) {
            const bestScoreSoFar = topResults.length > 0 ? topResults[0].score : -Infinity
            self.postMessage({
              type: 'progress',
              payload: {
                message: `SMA Tested ${combinationsTested} / ~${Math.round(totalCombinations)}. Best score: ${bestScoreSoFar.toFixed(3)}`,
              },
            })
          }
        }
      }
    } else if (strategy === 'rsi') {
      // --- RSI Logikk ---
      const rsiParams = params as RsiOptimizationParams // Type assertion
      const paramPeriod = rsiParams.period
      // Hent faste nivåer
      const buyLevel = rsiParams.buyLevel
      const sellLevel = rsiParams.sellLevel
      totalCombinations = Math.max(
        1,
        Math.floor((paramPeriod.max - paramPeriod.min) / paramPeriod.step) + 1,
      )

      self.postMessage({
        type: 'progress',
        payload: {
          message: `Starting RSI Grid Search. Total combinations: ~${Math.round(totalCombinations)}`,
        },
      })

      for (let rsiP = paramPeriod.min; rsiP <= paramPeriod.max; rsiP += paramPeriod.step) {
        let backtestResult: BacktestResultWasm | null = null
        try {
          // --- LEGG TIL KOSTNADER I WASM-KALL ---
          backtestResult = run_backtest_rsi_wasm(
            closePricesTyped, // <-- BRUK HISTORISKE DATA HER
            rsiP,
            buyLevel,
            sellLevel,
            commissionPct,
            slippageAmount
        );

          if (!backtestResult || backtestResult.profit_factor === ERROR_PF_VALUE) {
            continue
          }

          const currentResult: RsiBestParams = {
            type: 'rsi', // Viktig for mottaker
            period: rsiP,
            // buyLevel, // Kan legges til hvis de returneres/lagres
            // sellLevel,
            score: backtestResult.profit_factor,
            trades: backtestResult.trades,
          }

          // --- Oppdatert topp N logikk (bruker nå TopResultItem) ---
          updateTopResults(topResults, currentResult)
        } catch (wasmError) {
          /* ... (feilhåndtering som før) */
        } finally {
          if (backtestResult) backtestResult.free()
        }

        combinationsTested++
        if (
          combinationsTested % (Math.floor(totalCombinations / 20) + 1) === 0 ||
          combinationsTested >= totalCombinations
        ) {
          const bestScoreSoFar = topResults.length > 0 ? topResults[0].score : -Infinity
          self.postMessage({
            type: 'progress',
            payload: {
              message: `RSI Tested ${combinationsTested} / ~${Math.round(totalCombinations)}. Best score: ${bestScoreSoFar.toFixed(3)}`,
            },
          })
        }
      }
    } else {
      // Ukjent strategi
      self.postMessage({ type: 'error', payload: { message: `Unsupported strategy: ${strategy}` } })
      return // Avslutt worker
    }

    console.log(
      `Worker (TS) finished ${strategy} optimization. Top ${topResults.length} results:`,
      topResults,
    )
    // Send HELE listen med toppresultater (nå TopResultItem[])
    self.postMessage({ type: 'result', payload: { topResults } })
  }
}

// --- Hjelpefunksjon for å oppdatere topp N ---
function updateTopResults(topResults: TopResultItem[], currentResult: TopResultItem) {
  if (topResults.length < TOP_N_RESULTS) {
    topResults.push(currentResult)
    topResults.sort((a, b) => b.score - a.score) // Sort descending by score
  } else if (currentResult.score > topResults[TOP_N_RESULTS - 1].score) {
    topResults[TOP_N_RESULTS - 1] = currentResult
    topResults.sort((a, b) => b.score - a.score) // Sort descending by score
  }
}

export type {} // For å sikre at filen behandles som en modul
