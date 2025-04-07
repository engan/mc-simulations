// -------------------
// Resultat Typer (fra Optimization Worker / for Results List)
// -------------------
export interface Kline {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface BestParamsBase {
  score: number // e.g., Profit Factor
  trades: number
}

export interface SmaBestParams extends BestParamsBase {
  type: 'smaCross' // Strategy Discriminator
  short: number
  long: number
}

export interface RsiBestParams extends BestParamsBase {
  type: 'rsi' // Strategy Discriminator
  period: number
  // Optional: Add buy/sell levels if they become part of the result later
  // buyLevel?: number;
  // sellLevel?: number;
}

// Union type for et element i toppresultatlisten
export type TopResultItem = SmaBestParams | RsiBestParams

// -------------------
// Parameter Typer (for Optimization Worker)
// -------------------
export interface ParameterRange {
  min: number
  max: number
  step: number
}

// --- Oppdater parameter-typer til å inkludere kostnader ---
interface CostParams {
    commissionPct: number; // Som desimal
    slippageAmount: number;
}

export interface SmaOptimizationParams extends CostParams { // <-- Arver kostnader
  shortSma: ParameterRange;
  longSma: ParameterRange;
}

export interface RsiOptimizationParams extends CostParams { // <-- Arver kostnader
  period: ParameterRange;
  buyLevel: number;
  sellLevel: number;
}

// Discriminated union for strategy parameters sent TO optimization worker
export type OptimizationStrategyInfo =
  | { strategy: 'smaCross'; params: SmaOptimizationParams }
  | { strategy: 'rsi'; params: RsiOptimizationParams };

// -------------------
// Payload for å starte MC Validation (fra View til MC Worker)
// -------------------
interface McSettings {
  iterations: number
  barsPerSim: number
}

interface DataSourceInfo {
  symbol: string
  timeframe: string
  limit: number
}

export interface StartMcValidationPayload {
    mcSettings: McSettings;
    dataSource: DataSourceInfo;
    selectedStrategyParams: TopResultItem;
    strategy: 'smaCross' | 'rsi';
    historicalKlines: Kline[];
    costs: CostParams; // <-- Legg til kostnader her
  }
  
// -------------------
// Data Context & MC Resultater (fra MC Worker / for Results View)
// -------------------
export interface DataInfo {
  symbol: string
  timeframe: string
  count: number // Actual bars fetched
  startTime: number
  endTime: number
}

// FJERN 'extends Record<string, number>'
export interface McSummaryStats {
  // Definer ALLE kjente nøkler eksplisitt
  numIterations: number
  numBarsPerSim: number
  averagePL_pct?: number // Behold som valgfri hvis den kan mangle
  medianPL_pct?: number
  pnl_05_percentile_pct?: number
  pnl_10_percentile_pct?: number
  averageMaxDD?: number
  medianMaxDD?: number
  maxDD_95_percentile?: number
  // Hvis du *vet* at MC workeren *alltid* beregner disse (unntatt ved feil),
  // kan du fjerne '?' for å gjøre dem påkrevde, men valgfri er tryggere.

  // Hvis du MÅ tillate andre dynamiske nøkler (mindre sannsynlig):
  // [key: string]: number | undefined; // Men dette svekker typesikkerheten
}

export interface McResultData {
  allPnLs_pct: number[]
  allMaxDrawdowns: number[]
  summaryStats: McSummaryStats
  dataInfo?: DataInfo // Optional data context
}
