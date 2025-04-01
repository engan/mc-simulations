// Importer Wasm-funksjoner og init
import init, { run_backtest_sma_cross_wasm } from '../rust/pkg/mc_simulations.js'

// --- VIKTIG: Importer type for Wasm resultat ---
import type { BacktestResultWasm } from '../rust/pkg/mc_simulations.js' // Importer type for Wasm resultat

console.log('MC Validation Worker (TypeScript) Loaded')

// --- Type-definisjoner ---
interface Kline {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}
interface BestParams {
  short: number
  long: number
  score: number
  trades: number
} // Parametere vi mottar
interface McValidationPayload {
  historicalKlines: Kline[]
  parameters: BestParams // Mottar det beste settet
  numIterations: number
  numBarsPerSim: number
  strategy: string // For fremtidig bruk
}
interface McResultData {
  allPnLs_pct: number[]
  allMaxDrawdowns: number[] // MÅ LEGGES TIL I BacktestResultWasm!
  summaryStats: Record<string, number> // F.eks. gjennomsnitt, median etc.
}
declare const self: DedicatedWorkerGlobalScope

// --- MANUELT DEFINERT Interface for Wasm-resultat ---
// !!! VIKTIG: Må oppdateres for å inkludere max_drawdown !!!
interface BacktestResultWasmManual {
  readonly profit_factor: number
  readonly trades: number
  readonly total_profit: number
  readonly total_loss: number
  readonly max_drawdown: number
  free(): void
}

// --- Bootstrapping Funksjoner (fra tidligere svar) ---
function calculatePercentageChanges(prices: number[]): number[] {
  if (prices.length < 2) return []
  const changes: number[] = []
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) changes.push(prices[i] / prices[i - 1] - 1.0)
    else changes.push(0.0)
  }
  return changes
}

function generateSimulatedPricePath(
  historicalChanges: number[],
  numBars: number,
  startPrice: number,
): number[] {
  if (historicalChanges.length === 0 || numBars <= 0) return [startPrice]
  const simulatedPath: number[] = [startPrice]
  let currentPrice = startPrice
  for (let i = 0; i < numBars; i++) {
    const randomIndex = Math.floor(Math.random() * historicalChanges.length)
    const randomChange = historicalChanges[randomIndex]
    currentPrice = Math.max(0, currentPrice * (1.0 + randomChange))
    simulatedPath.push(currentPrice)
  }
  return simulatedPath
}

// --- Wasm Init Flagg ---
let wasmInitializedMc = false
const ERROR_PF_VALUE = -1.0 // Må matche Rust
const START_EQUITY = 10000.0 // Definer startkapital for %-beregning

// --- Hoved Worker Logikk ---
self.onmessage = async (event: MessageEvent<{ type: string; payload: any }>) => {
  const { type, payload } = event.data

  if (type === 'startMcValidation') {
    console.log('MC Worker (TS) received startMcValidation:', payload)

    // --- Initialiser Wasm ---
    if (!wasmInitializedMc) {
      try {
        console.log('MC Worker (TS): Initializing Wasm...')
        await init()
        wasmInitializedMc = true
        console.log('MC Worker (TS): Wasm initialized.')
      } catch (err) {
        console.error('MC Worker (TS): Wasm initialization failed:', err)
        self.postMessage({ type: 'mcError', payload: { message: `Wasm init failed: ${err}` } })
        return
      }
    }

    const mcPayload = payload as McValidationPayload
    const { historicalKlines, parameters, numIterations, numBarsPerSim, strategy } = mcPayload

    if (strategy !== 'smaCross') {
      self.postMessage({
        type: 'mcError',
        payload: { message: 'Only smaCross strategy supported' },
      })
      return
    }
    if (!historicalKlines || historicalKlines.length < 2) {
      self.postMessage({
        type: 'mcError',
        payload: { message: 'Not enough historical data for bootstrapping.' },
      })
      return
    }

    self.postMessage({
      type: 'mcProgress',
      payload: { message: `Starting ${numIterations} MC iterations...` },
    })

    const historicalClosePrices: number[] = historicalKlines.map((k) => k.close)
    const priceChanges = calculatePercentageChanges(historicalClosePrices)
    const startPrice = historicalClosePrices[historicalClosePrices.length - 1]

    const allPnLs_pct: number[] = [] // Endret navn for klarhet
    const allMaxDrawdowns: number[] = []

    for (let i = 0; i < numIterations; i++) {
      const simulatedPath = generateSimulatedPricePath(priceChanges, numBarsPerSim, startPrice)
      const simulatedPathTyped = new Float64Array(simulatedPath)

      let backtestResult: BacktestResultWasm | null = null
      try {
        backtestResult = run_backtest_sma_cross_wasm(
          simulatedPathTyped,
          parameters.short,
          parameters.long,
        )

        if (!backtestResult || backtestResult.profit_factor === ERROR_PF_VALUE) {
          console.warn(`MC Iteration ${i + 1}: Backtest skipped or failed.`)
          // Vurder om du skal lagre 0, na, eller hoppe over denne iterasjonen
          allPnLs_pct.push(0) // Lagrer 0 P/L ved feil/skip
          allMaxDrawdowns.push(100) // Lagrer 100% DD ved feil/skip (konservativt)
          continue
        }

        // --- BEREGN PROSENTVIS P/L ---
        const netProfit = backtestResult.total_profit - backtestResult.total_loss
        const iterationPL_pct = (netProfit / START_EQUITY) * 100.0 // Prosentvis P/L
        allPnLs_pct.push(iterationPL_pct) // Legg til prosentvis P/L

        // Hent Max Drawdown fra Wasm
        const iterationMaxDD = backtestResult.max_drawdown
        allMaxDrawdowns.push(iterationMaxDD)
      } catch (wasmError) {
        const errorMessage = wasmError instanceof Error ? wasmError.message : String(wasmError) // Hent meldingen
        console.error(`MC Iteration ${i + 1}: Wasm backtest call failed:`, errorMessage)
        // Lagre feilresultat
        allPnLs_pct.push(0)
        allMaxDrawdowns.push(100)
      } finally {
        if (backtestResult) {
          backtestResult.free()
        }
      }

      // Send progress
      if ((i + 1) % Math.floor(numIterations / 10 || 1) === 0 || i === numIterations - 1) {
        self.postMessage({
          type: 'mcProgress',
          payload: { message: `Completed ${i + 1} / ${numIterations} iterations.` },
        })
      }
    }

    // --- Beregn Sammendragsstatistikk (enkelt eksempel) ---
    const summaryStats: Record<string, number> = {}

    // --- LEGG TIL ITERATIONS OG BARS ---
    summaryStats.numIterations = numIterations // Lagre faktisk brukt antall
    summaryStats.numBarsPerSim = numBarsPerSim // Lagre faktisk brukt antall

    if (allPnLs_pct.length > 0) {
      const sortedPnLs = [...allPnLs_pct].sort((a, b) => a - b)
      summaryStats.averagePL_pct = allPnLs_pct.reduce((a, b) => a + b, 0) / allPnLs_pct.length // Gjennomsnitt
      summaryStats.medianPL_pct = sortedPnLs[Math.floor(allPnLs_pct.length / 2)] // Median
      summaryStats.pnl_05_percentile_pct = sortedPnLs[Math.floor(allPnLs_pct.length * 0.05)] // VaR 95% (ca.)
      summaryStats.pnl_10_percentile_pct = sortedPnLs[Math.floor(allPnLs_pct.length * 0.1)] // VaR 90% (ca.)
      // ... beregn flere stats for P/L og MaxDrawdown ...
    }

    // Beregn stats for Max Drawdown også
    if (allMaxDrawdowns.length > 0) {
      const sortedDDs = [...allMaxDrawdowns].filter((dd) => dd !== 100).sort((a, b) => a - b) // Filtrer bort feilverdier før sortering
      if (sortedDDs.length > 0) {
        summaryStats.averageMaxDD = sortedDDs.reduce((a, b) => a + b, 0) / sortedDDs.length
        summaryStats.medianMaxDD = sortedDDs[Math.floor(sortedDDs.length / 2)]
        summaryStats.maxDD_95_percentile = sortedDDs[Math.floor(sortedDDs.length * 0.95)] // 95% persentil
      } else {
        summaryStats.averageMaxDD = 100 // Hvis alle feilet
        summaryStats.medianMaxDD = 100
        summaryStats.maxDD_95_percentile = 100
      }
    }

    console.log('MC Worker: Sending final result payload:', {
      allPnLs_pct,
      allMaxDrawdowns,
      summaryStats, // Inkluderer nå numIterations og numBarsPerSim
    })
    self.postMessage({
      type: 'mcResult',
      payload: { allPnLs_pct, allMaxDrawdowns, summaryStats } as McResultData,
    })
  }
}

export type {}
