// Importer Wasm-funksjoner og init
import init, {
  run_backtest_sma_cross_wasm,
  run_backtest_rsi_wasm,
} from '../rust/pkg/mc_simulations'

// --- IMPORTER SENTRALE TYPER ---
import type {
  Kline, // Behøver Kline-typen
  StartMcValidationPayload, // Den fulle payloaden vi mottar
  SmaBestParams, // For å hente params
  RsiBestParams, // For å hente params
  McResultData, // Det vi skal sende tilbake (uten dataInfo)
  McSummaryStats,
} from '../types/simulation'

// --- VIKTIG: Importer type for Wasm resultat ---
import type { BacktestResultWasm } from '../rust/pkg/mc_simulations' // Importer type for Wasm resultat

console.log('MC Validation Worker (TypeScript) Loaded')

// --- Type-definisjoner ---
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

declare const self: DedicatedWorkerGlobalScope

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
        // console.log('MC Worker (TS): Initializing Wasm...')
        await init()
        wasmInitializedMc = true
        console.log('MC Worker (TS): Wasm initialized.')
      } catch (err) {
        console.error('MC Worker (TS): Wasm initialization failed:', err)
        self.postMessage({ type: 'mcError', payload: { message: `Wasm init failed: ${err}` } })
        return
      }
    }

    // --- Type Payload ---
    const mcPayload = payload as StartMcValidationPayload // Bruker riktig type
    const {
      mcSettings,
      selectedStrategyParams,
      strategy,
      historicalKlines,
      costs, // <-- NY: Hent ut kostnader
    } = mcPayload
    const { commissionPct, slippageAmount } = costs // Pakk ut kostnader
    const { iterations: numIterations, barsPerSim: numBarsPerSim } = mcSettings

    console.log('MC Worker Received Strategy:', strategy)
    // console.log('MC Worker Received Params:', JSON.stringify(selectedStrategyParams))
    console.log('MC Worker Historical Klines Length:', historicalKlines?.length)

    // --- Data Validering for Bootstrapping ---
    if (!historicalKlines || historicalKlines.length < 2) {
      self.postMessage({
        type: 'mcError',
        payload: { message: 'Not enough historical data for bootstrapping.' },
      })
      return
    }

    self.postMessage({
      type: 'mcProgress',
      payload: { message: `Starting ${numIterations} MC iterations for ${strategy}...` },
    })

    const historicalClosePrices: number[] = historicalKlines.map((k) => k.close)
    const priceChanges = calculatePercentageChanges(historicalClosePrices)
    const startPrice = historicalClosePrices[historicalClosePrices.length - 1] || 100 // Fallback startpris

    const allPnLs_pct: number[] = []
    const allMaxDrawdowns: number[] = []

    for (let i = 0; i < numIterations; i++) {
      const simulatedPath = generateSimulatedPricePath(priceChanges, numBarsPerSim, startPrice)
      const simulatedPathTyped = new Float64Array(simulatedPath)

      let backtestResult: BacktestResultWasm | null = null
      try {
        // --- KALL RIKTIG WASM FUNKSJON BASERT PÅ STRATEGI ---
        if (strategy === 'smaCross') {
          const params = selectedStrategyParams as SmaBestParams
          // --- LEGG TIL KOSTNADER I WASM-KALL ---
          backtestResult = run_backtest_sma_cross_wasm(
            simulatedPathTyped,
            params.short,
            params.long,
            commissionPct, // <-- Ny
            slippageAmount, // <-- Ny
          )
        } else if (strategy === 'rsi') {
          // Hent RSI parametere (periode + faste nivåer for nå)
          const params = selectedStrategyParams as RsiBestParams // Type assertion
          const rsiPeriod = params.period
          const buyLevel = 30.0 // Hent fra payload hvis de blir variable
          const sellLevel = 70.0 // Hent fra payload hvis de blir variable
          // --- LEGG TIL KOSTNADER I WASM-KALL ---
          backtestResult = run_backtest_rsi_wasm(
            simulatedPathTyped,
            rsiPeriod,
            buyLevel,
            sellLevel,
            commissionPct, // <-- Ny
            slippageAmount, // <-- Ny
          )
        } else {
          // Ukjent strategi - send feil og hopp over iterasjon
          // console.error(`MC Iteration ${i + 1}: Unsupported strategy: ${strategy}`)
          allPnLs_pct.push(0)
          allMaxDrawdowns.push(100)
          continue // Gå til neste iterasjon
        }

        // --- Behandle resultat (som før) ---
        if (!backtestResult || backtestResult.profit_factor === ERROR_PF_VALUE) {
          // console.warn(`MC Iteration ${i + 1}: Backtest skipped or failed for ${strategy}.`)
          allPnLs_pct.push(0)
          allMaxDrawdowns.push(100)
          continue
        }
        // console.log(`MC Iter ${i+1} Result (raw):`, backtestResult);

        const netProfit = backtestResult.total_profit - backtestResult.total_loss
        const iterationPL_pct = (netProfit / START_EQUITY) * 100.0
        allPnLs_pct.push(iterationPL_pct)

        const iterationMaxDD = backtestResult.max_drawdown
        allMaxDrawdowns.push(iterationMaxDD)
      } catch (wasmError) {
        /* ... (feilhåndtering som før) */
        allPnLs_pct.push(0)
        allMaxDrawdowns.push(100)
      } finally {
        if (backtestResult) {
          backtestResult.free()
        }
      }
    }

    // --- Beregn Sammendragsstatistikk (som før, men bruk McSummaryStats type) ---
    const summaryStats: McSummaryStats = {
      // Bruk importert type
      numIterations: numIterations,
      numBarsPerSim: numBarsPerSim,
      // Initialiser resten som undefined for å unngå feil hvis beregning feiler
      averagePL_pct: undefined,
      medianPL_pct: undefined,
      pnl_05_percentile_pct: undefined,
      pnl_10_percentile_pct: undefined,
      averageMaxDD: undefined,
      medianMaxDD: undefined,
      maxDD_95_percentile: undefined,
    }

    if (allPnLs_pct.length > 0) {
      const sortedPnLs = [...allPnLs_pct].sort((a, b) => a - b)
      summaryStats.averagePL_pct = allPnLs_pct.reduce((a, b) => a + b, 0) / allPnLs_pct.length
      summaryStats.medianPL_pct = sortedPnLs[Math.floor(allPnLs_pct.length / 2)]
      summaryStats.pnl_05_percentile_pct = sortedPnLs[Math.floor(allPnLs_pct.length * 0.05)]
      summaryStats.pnl_10_percentile_pct = sortedPnLs[Math.floor(allPnLs_pct.length * 0.1)]
    }

    if (allMaxDrawdowns.length > 0) {
      // Filtrer bort feilverdier (100%) før beregning/sortering av DD stats
      const validDrawdowns = allMaxDrawdowns.filter((dd) => dd < 100)
      if (validDrawdowns.length > 0) {
        const sortedDDs = [...validDrawdowns].sort((a, b) => a - b)
        summaryStats.averageMaxDD =
          validDrawdowns.reduce((a, b) => a + b, 0) / validDrawdowns.length
        summaryStats.medianMaxDD = sortedDDs[Math.floor(sortedDDs.length / 2)]
        summaryStats.maxDD_95_percentile = sortedDDs[Math.floor(sortedDDs.length * 0.95)]
      } else {
        // Hvis alle iterasjoner feilet, sett DD til 100
        summaryStats.averageMaxDD = 100
        summaryStats.medianMaxDD = 100
        summaryStats.maxDD_95_percentile = 100
      }
    }

    console.log('MC Worker: Sending final result payload:', {
      allPnLs_pct,
      allMaxDrawdowns,
      summaryStats,
    })
    // Send tilbake et objekt som matcher McResultData (uten dataInfo)
    const resultPayload: Omit<McResultData, 'dataInfo'> = {
      allPnLs_pct,
      allMaxDrawdowns,
      summaryStats,
    }
    self.postMessage({
      type: 'mcResult',
      payload: resultPayload,
    })
  }
}

export type {}