/* tslint:disable */
/* eslint-disable */
export function run_backtest_rsi_wasm(close_prices: Float64Array, period: number, buy_level: number, sell_level: number, commission_pct: number, slippage_amount: number): BacktestResultWasm;
export function run_backtest_sma_cross_wasm(close_prices: Float64Array, short_period: number, long_period: number, commission_pct: number, slippage_amount: number): BacktestResultWasm;
export function add(left: bigint, right: bigint): bigint;
export class BacktestResultWasm {
  private constructor();
  free(): void;
  profit_factor: number;
  trades: number;
  total_profit: number;
  total_loss: number;
  max_drawdown: number;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_backtestresultwasm_free: (a: number, b: number) => void;
  readonly __wbg_get_backtestresultwasm_profit_factor: (a: number) => number;
  readonly __wbg_set_backtestresultwasm_profit_factor: (a: number, b: number) => void;
  readonly __wbg_get_backtestresultwasm_trades: (a: number) => number;
  readonly __wbg_set_backtestresultwasm_trades: (a: number, b: number) => void;
  readonly __wbg_get_backtestresultwasm_total_profit: (a: number) => number;
  readonly __wbg_set_backtestresultwasm_total_profit: (a: number, b: number) => void;
  readonly __wbg_get_backtestresultwasm_total_loss: (a: number) => number;
  readonly __wbg_set_backtestresultwasm_total_loss: (a: number, b: number) => void;
  readonly __wbg_get_backtestresultwasm_max_drawdown: (a: number) => number;
  readonly __wbg_set_backtestresultwasm_max_drawdown: (a: number, b: number) => void;
  readonly run_backtest_rsi_wasm: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
  readonly run_backtest_sma_cross_wasm: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
  readonly add: (a: bigint, b: bigint) => bigint;
  readonly __wbindgen_export_0: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
