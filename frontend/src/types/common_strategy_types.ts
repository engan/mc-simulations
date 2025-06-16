// Definerer felles datastrukturer (Kline, Trade, EquityPoint) for både Rust og Frontend.

// Tilsvarende src/types.rs, men i TypeScript. 
// Dette sikrer at datastrukturene som sendes mellom frontend og Wasm er konsistente.

export interface Kline {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  entry_bar_index: number;
  exit_bar_index?: number;
  entry_price: number;
  exit_price?: number;
  direction: 'long' | 'short';
  qty: number;
  pnl?: number;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

// NYTT INTERFACE FOR OPPSUMMERING
export interface BacktestSummary {
    final_equity: number;
    total_pnl: number;
    max_drawdown_percent: number;
    profit_factor: number;
    total_trades: number;
    profitable_trades: number;
}

// OPPDATERT RESULTAT-TYPE
export interface BacktestResult {
    trades: Trade[];
    equity_curve: EquityPoint[];
    summary: BacktestSummary;
}