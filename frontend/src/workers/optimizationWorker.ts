import init, { run_backtest_sma_cross_wasm } from '../rust/pkg/mc_simulations.js' // Importer kun funksjonen

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
interface ParameterRange {
  min: number
  max: number
  step: number
}
interface OptimizationParameters {
  shortSma: ParameterRange
  longSma: ParameterRange
}
interface BestParams {
  short: number
  long: number
  score: number
  trades: number
}
interface WorkerIncomingPayload {
  historicalKlines: Kline[]
  parameters: OptimizationParameters
  strategy: string
}
declare const self: DedicatedWorkerGlobalScope

// --- MANUELT DEFINERT Interface for Wasm-resultat ---
// MÅ matche Rust struct (uten error-feltet) + free()
interface BacktestResultWasm {
  readonly profit_factor: number
  readonly trades: number
  readonly total_profit: number
  readonly total_loss: number
  readonly max_drawdown: number;
  free(): void
}

let wasmInitialized = false
const ERROR_PF_VALUE = -1.0 // Må matche Rust
const TOP_N_RESULTS = 5 // Antall toppresultater - topp 5

// --- Hoved Worker Logikk ---
self.onmessage = async (event: MessageEvent<{ type: string; payload: any }>) => {
  const { type, payload } = event.data

  if (type === 'startOptimization') {
    console.log('Worker (TS) received startOptimization:', payload)

    // --- Initialiser Wasm ---
    if (!wasmInitialized) {
      try {
        console.log('Worker (TS): Initializing Wasm...')
        await init()
        wasmInitialized = true
        console.log('Worker (TS): Wasm initialized.')
      } catch (err) {
        console.error('Worker (TS): Wasm initialization failed:', err)
        self.postMessage({ type: 'error', payload: { message: `Wasm init failed: ${err}` } })
        return
      }
    }

    const optimizationPayload = payload as WorkerIncomingPayload
    const { historicalKlines, parameters, strategy } = optimizationPayload

    if (strategy !== 'smaCross') {
      self.postMessage({ type: 'error', payload: { message: 'Only smaCross strategy supported' } })
      return
    }

    const closePrices: number[] = historicalKlines.map((k) => k.close)
    const closePricesTyped = new Float64Array(closePrices) // Effektiv for Wasm
    const paramShort: ParameterRange = parameters.shortSma
    const paramLong: ParameterRange = parameters.longSma

    let bestParams: BestParams | null = null
    let bestScore: number = -Infinity
    let topResults: BestParams[] = []
    let combinationsTested: number = 0
    const totalCombinations: number =
      Math.max(1, (paramShort.max - paramShort.min) / paramShort.step + 1) *
      Math.max(1, (paramLong.max - paramLong.min) / paramLong.step + 1)

    self.postMessage({
      type: 'progress',
      payload: {
        message: `Starting Grid Search (using Wasm). Total combinations: ~${Math.round(totalCombinations)}`,
      },
    })

    // Grid Search
    for (let shortP = paramShort.min; shortP <= paramShort.max; shortP += paramShort.step) {
      for (let longP = paramLong.min; longP <= paramLong.max; longP += paramLong.step) {
        if (shortP >= longP) continue
        let backtestResult: BacktestResultWasm | null = null
        try {
          // --- Logg FØR kall ---
          console.log(`Calling Wasm for: ${shortP}/${longP}`)

          backtestResult = run_backtest_sma_cross_wasm(closePricesTyped, shortP, longP)

          // --- Logg RETT ETTER kall (uansett resultat) ---
          console.log(`Wasm returned for ${shortP}/${longP}:`, backtestResult)

          if (!backtestResult || backtestResult.profit_factor === ERROR_PF_VALUE) {
            continue
          }

          // --- Logg resultatet FØR feilsjekk ---
          console.log(
            `Params: ${shortP}/${longP}, Result PF: ${backtestResult.profit_factor}, Trades: ${backtestResult.trades}`,
          )

          // --- Sjekk for null OG SPESIELL FEILVERDI ---
          if (!backtestResult) {
            console.warn(`Wasm call returned null/undefined for ${shortP}/${longP}`)
            continue
          }

          // Sjekk om profit_factor indikerer en feil fra Rust
          if (backtestResult.profit_factor === ERROR_PF_VALUE) {
            console.warn(
              `Backtest skipped for ${shortP}/${longP} due to internal Wasm error indicator.`,
            )
            continue // Hopp over denne kombinasjonen
          }

          // --- Nå er det trygt å bruke backtestResult ---
          const score: number = backtestResult.profit_factor

          const currentResult: BestParams = {
            short: shortP,
            long: longP,
            score: backtestResult.profit_factor,
            trades: backtestResult.trades,
          }

          // --- Logikk for å holde topp N sortert ---
          if (topResults.length < TOP_N_RESULTS) {
            topResults.push(currentResult)
            // Sorter synkende etter score når vi legger til nye
            topResults.sort((a, b) => b.score - a.score)
          } else if (currentResult.score > topResults[TOP_N_RESULTS - 1].score) {
            // Hvis bedre enn den dårligste i topp N, erstatt den dårligste
            topResults[TOP_N_RESULTS - 1] = currentResult
            // Sorter synkende igjen
            topResults.sort((a, b) => b.score - a.score)
          }
          // --- Slutt topp N logikk ---

          if (score > bestScore) {
            bestScore = score
            bestParams = { short: shortP, long: longP, score: score, trades: backtestResult.trades }
            console.log(`New best found: ${JSON.stringify(bestParams)}`)
          }
        } catch (wasmError) {
          const errorMessage = wasmError instanceof Error ? wasmError.message : String(wasmError); // Hent meldingen
          console.error(`Wasm backtest call failed for ${shortP}/${longP}:`, wasmError)
          self.postMessage({
            type: 'error',
            payload: { message: `Wasm backtest call failed: ${errorMessage}` },
          })
          return // Avbryt ved alvorlig Wasm-feil
        } finally {
          // --- VIKTIG: Frigjør minne uansett ---
          if (backtestResult) {
            backtestResult.free()
          }
        }

        combinationsTested++
        // Progress-melding (bruk score fra beste i listen)
        if (
          combinationsTested % (Math.floor(totalCombinations / 50) + 1) === 0 ||
          combinationsTested === totalCombinations
        ) {
          const bestScoreSoFar = topResults.length > 0 ? topResults[0].score : -Infinity
          self.postMessage({
            type: 'progress',
            payload: {
              message: `Tested ${combinationsTested} / ~${Math.round(totalCombinations)}. Best score: ${bestScoreSoFar.toFixed(2)}`,
            },
          })
        }
      }
    }
    console.log(`Worker (TS) finished. Top ${topResults.length} results:`, topResults)
    // Send HELE listen med toppresultater
    self.postMessage({ type: 'result', payload: { topResults } }) // Endret fra bestParams til topResults
  }
}

export type {} // For å sikre at filen behandles som en modul
