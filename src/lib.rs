use wasm_bindgen::prelude::*;

// --- Enkel SMA-funksjon (Rust) ---
fn calculate_sma_rust(prices: &[f64], period: usize) -> Vec<f64> {
    let mut sma_values: Vec<f64> = Vec::new();
    if prices.len() < period || period == 0 { return sma_values; }
    let mut current_sum: f64 = prices[0..period].iter().sum();
    sma_values.push(current_sum / period as f64);
    for i in period..prices.len() {
        current_sum += prices[i] - prices[i - period];
        sma_values.push(current_sum / period as f64);
    }
    sma_values
}

// --- Backtest Resultat Struktur (med max_drawdown) ---
#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct BacktestResultWasm {
    pub profit_factor: f64,
    pub trades: i32,
    pub total_profit: f64,
    pub total_loss: f64,
    pub max_drawdown: f64, // Max Drawdown i prosent
}

// --- Backtest funksjon (med korrekt Max Drawdown) ---
#[wasm_bindgen]
pub fn run_backtest_sma_cross_wasm(close_prices: &[f64], short_period: usize, long_period: usize) -> BacktestResultWasm {
    const ERROR_PF_VALUE: f64 = -1.0; // Spesiell verdi for feil
    const START_EQUITY: f64 = 10000.0; // Startkapital for drawdown-beregning

    // --- Innledende sjekker ---
    if close_prices.len() <= long_period || short_period == 0 || long_period == 0 {
        return BacktestResultWasm { profit_factor: ERROR_PF_VALUE, trades: 0, total_profit: 0.0, total_loss: 0.0, max_drawdown: 100.0 };
    }
    if short_period >= long_period {
        return BacktestResultWasm { profit_factor: ERROR_PF_VALUE, trades: 0, total_profit: 0.0, total_loss: 0.0, max_drawdown: 100.0 };
    }

    // --- Beregn SMAs ---
    let short_sma: Vec<f64> = calculate_sma_rust(close_prices, short_period);
    let long_sma: Vec<f64> = calculate_sma_rust(close_prices, long_period);
    let loop_start_index_short = (long_period - short_period) + 1;

    if short_sma.len() <= loop_start_index_short {
        return BacktestResultWasm { profit_factor: ERROR_PF_VALUE, trades: 0, total_profit: 0.0, total_loss: 0.0, max_drawdown: 100.0 };
    }

    // --- Initialiser variabler ---
    let mut position: i32 = 0;
    let mut entry_price: f64 = 0.0;
    let mut total_profit: f64 = 0.0;
    let mut total_loss: f64 = 0.0;
    let mut trades: i32 = 0;

    // Variabler for drawdown
    let mut equity: f64 = START_EQUITY;
    let mut peak_equity: f64 = START_EQUITY;
    let mut max_drawdown: f64 = 0.0; // Lagres som desimal

    // --- Backtest-løkke ---
    for i in loop_start_index_short..short_sma.len() {
        let j = i + short_period - long_period;
        let price_index = short_period - 1 + i;
        let current_price = close_prices[price_index];

        let current_short_sma = short_sma[i];
        let current_long_sma = long_sma[j];
        let previous_short_sma = short_sma[i - 1];
        let previous_long_sma = long_sma[j - 1];

        // --- Drawdown-beregning ---
        // Oppdater peak FØR vi evt. endrer equity ved en exit denne baren
        peak_equity = equity.max(peak_equity);
        // Beregn potensiell equity basert på nåværende pris HVIS vi er i en posisjon
        let potential_equity_now = if position == 1 {
            // Forenklet beregning basert på P/L siden inngang (antar 1 enhet)
            // For mer nøyaktighet bør dette baseres på prosentvis endring av equity
            equity + (current_price - entry_price)
        } else {
            equity // Hvis flat, er potensiell equity lik nåværende equity
        };
        // Beregn drawdown fra peak til potensiell nåværende verdi
        if peak_equity > 0.0 {
            let current_drawdown = (peak_equity - potential_equity_now).max(0.0) / peak_equity;
            max_drawdown = current_drawdown.max(max_drawdown);
        }

        // --- Trade-logikk ---
        if position == 0 && current_short_sma > current_long_sma && previous_short_sma <= previous_long_sma {
            position = 1;
            entry_price = current_price;
            trades += 1;
        } else if position == 1 && current_short_sma < current_long_sma && previous_short_sma >= previous_long_sma {
            let exit_price = current_price;
            let profit = exit_price - entry_price; // Forenklet P/L per trade
            equity += profit; // Oppdater equity NÅR traden lukkes
            if profit > 0.0 {
                total_profit += profit;
            } else {
                total_loss += profit.abs();
            }
            position = 0;
            entry_price = 0.0;
        }
    }

    // --- Beregn Profit Factor ---
    let profit_factor: f64 = if total_loss == 0.0 {
        if total_profit > 0.0 { f64::INFINITY } else { 1.0 }
    } else {
        total_profit / total_loss
    };

    // --- Returner resultat ---
    BacktestResultWasm {
        profit_factor: if profit_factor.is_nan() || profit_factor.is_infinite() { 0.0 } else { profit_factor },
        trades,
        total_profit,
        total_loss,
        max_drawdown: max_drawdown * 100.0, // Konverter til prosent
    }
}

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}
