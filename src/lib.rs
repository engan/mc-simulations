use wasm_bindgen::prelude::*;
use web_sys::console; // <-- Importert for console::log_1

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
    pub total_profit: f64, // Brutto profitt (før exit commission)
    pub total_loss: f64,   // Brutto tap
    pub max_drawdown: f64, // Max Drawdown i prosent (basert på netto equity)
}

// --- RSI-BEREGNINGSFUNKSJON ---
fn calculate_rsi_rust(prices: &[f64], period: usize) -> Vec<Option<f64>> {
    if prices.len() <= period || period == 0 {
        return vec![None; prices.len()];
    }

    let mut rsi_values: Vec<Option<f64>> = vec![None; period];
    let mut gains: Vec<f64> = Vec::new();
    let mut losses: Vec<f64> = Vec::new();

    for i in 1..prices.len() {
        let change = prices[i] - prices[i - 1];
        if change > 0.0 {
            gains.push(change);
            losses.push(0.0);
        } else {
            gains.push(0.0);
            losses.push(change.abs());
        }
    }

    // Sjekk om vi har nok data for første gjennomsnitt
    if gains.len() < period {
         return vec![None; prices.len()]; // Ikke nok endringer beregnet
    }


    let mut avg_gain: f64 = gains[0..period].iter().sum::<f64>() / period as f64;
    let mut avg_loss: f64 = losses[0..period].iter().sum::<f64>() / period as f64;

    let rs = if avg_loss == 0.0 { f64::INFINITY } else { avg_gain / avg_loss };
    let rsi = 100.0 - (100.0 / (1.0 + rs));
    rsi_values.push(Some(rsi));

    for i in period..gains.len() {
        let current_gain = gains[i];
        let current_loss = losses[i];

        avg_gain = ((avg_gain * (period as f64 - 1.0)) + current_gain) / period as f64;
        avg_loss = ((avg_loss * (period as f64 - 1.0)) + current_loss) / period as f64;

        let rs = if avg_loss == 0.0 { f64::INFINITY } else { avg_gain / avg_loss };
        let rsi = 100.0 - (100.0 / (1.0 + rs));
        rsi_values.push(Some(rsi));
    }

     while rsi_values.len() < prices.len() {
         rsi_values.push(None);
     }

    rsi_values
}

// --- RSI BACKTEST FUNKSJON (Oppdatert) ---
#[wasm_bindgen]
pub fn run_backtest_rsi_wasm(
    close_prices: &[f64],
    period: usize,
    buy_level: f64,
    sell_level: f64,
    commission_pct: f64, // <-- NY
    slippage_amount: f64 // <-- NY
) -> BacktestResultWasm {
    // --- BRUK CONSOLE::LOG_1 ---
    let log_msg = format!("[WASM RSI CONSOLE] ENTERED FUNCTION: period={}, buy={}, sell={}, commission={}, slippage={}, prices_len={}", period, buy_level, sell_level, commission_pct, slippage_amount, close_prices.len());
    console::log_1(&JsValue::from_str(&log_msg));
    // --- SLUTT ---

    const ERROR_PF_VALUE: f64 = -1.0;
    const START_EQUITY: f64 = 10000.0;

    // --- Input Validering ---
     if close_prices.len() <= period || period == 0 || buy_level >= sell_level || commission_pct < 0.0 || slippage_amount < 0.0 { // <-- ENDRET: Inkluderer nye params
        println!("[WASM RSI] Input validation failed."); // <-- ENDRET: Korrekt melding
        return BacktestResultWasm {
            profit_factor: ERROR_PF_VALUE, trades: 0, total_profit: 0.0, total_loss: 0.0, max_drawdown: 100.0
        };
    }

    // --- Beregn RSI ---
    let rsi_values = calculate_rsi_rust(close_prices, period);
    println!("[WASM RSI] Calculated RSI values_len={}", rsi_values.len());

    // --- Initialiser Backtest Variabler ---
    let mut position: i32 = 0;
    let mut entry_price: f64 = 0.0; // Dette blir justert entry pris
    let mut total_profit_gross: f64 = 0.0; // <-- ENDRET: Brutto
    let mut total_loss_gross: f64 = 0.0;   // <-- ENDRET: Brutto
    let mut trades: i32 = 0;
    let mut equity: f64 = START_EQUITY;
    let mut peak_equity: f64 = START_EQUITY;
    let mut max_drawdown: f64 = 0.0;

    // --- Backtest Løkke ---
    println!("[WASM RSI] Starting loop from index {} up to {}", period + 1, close_prices.len());
    for i in (period + 1)..close_prices.len() {
        let current_price = close_prices[i];
        let current_rsi_opt = rsi_values[i];      // <-- KORRIGERT: Hentet verdier her
        let previous_rsi_opt = rsi_values[i - 1]; // <-- KORRIGERT: Hentet verdier her

        if current_rsi_opt.is_none() || previous_rsi_opt.is_none() {
            // println!("[WASM RSI] Skipping iter {} due to None RSI value.", i); // Kan fjernes for mindre støy
            continue;
        }
        let current_rsi = current_rsi_opt.unwrap();
        let previous_rsi = previous_rsi_opt.unwrap();
        // println!("[WASM RSI] Iter {}: Price={}, RSI={}, PrevRSI={}", i, current_price, current_rsi, previous_rsi); // Kan fjernes

        // --- Drawdown Beregning ---
        peak_equity = equity.max(peak_equity);
        // Forenklet drawdown basert på urealisert brutto P/L
        let potential_equity_now_gross = if position == 1 {
             START_EQUITY + total_profit_gross - total_loss_gross + (current_price - entry_price) // Bruker justert entry_price her
        } else {
             START_EQUITY + total_profit_gross - total_loss_gross
        };
        if peak_equity > 0.0 {
             let current_drawdown = (peak_equity - potential_equity_now_gross.min(peak_equity)).max(0.0) / peak_equity;
             max_drawdown = current_drawdown.max(max_drawdown);
        }

        // --- Trade Logikk MED KOSTNADER ---
        if position == 0 && current_rsi > buy_level && previous_rsi <= buy_level {
            position = 1;
            entry_price = current_price + slippage_amount; // <-- NY: Juster for slippage
            trades += 1;
            let entry_commission = entry_price * commission_pct; // <-- NY: Beregn kommisjon
            equity -= entry_commission; // <-- NY: Trekk fra kommisjon
            println!("[WASM RSI] Iter {}: LONG ENTRY @ {} (adj. for slippage), Comm: {}", i, entry_price, entry_commission); // Valgfri logg
        }
        else if position == 1 && current_rsi < sell_level && previous_rsi >= sell_level {
            let exit_price = current_price - slippage_amount; // <-- NY: Juster for slippage
            let gross_profit = exit_price - entry_price;
            let exit_commission = exit_price * commission_pct; // <-- NY: Beregn kommisjon
            let net_profit = gross_profit - exit_commission; // <-- NY: Netto resultat

            equity += net_profit; // <-- NY: Oppdater med netto

            if gross_profit > 0.0 {
                total_profit_gross += gross_profit; // <-- ENDRET: Lagre brutto
            } else {
                total_loss_gross += gross_profit.abs(); // <-- ENDRET: Lagre brutto
            }
            println!("[WASM RSI] Iter {}: EXIT @ {} (adj. for slippage), Gross P/L: {}, Exit Comm: {}, Net P/L: {}", i, exit_price, gross_profit, exit_commission, net_profit); // Valgfri logg

            position = 0;
            entry_price = 0.0;
        }
    }
    println!("[WASM RSI] Loop finished.");

    // --- Beregn Profit Factor basert på BRUTTO ---
    let profit_factor: f64 = if total_loss_gross == 0.0 { // <-- ENDRET: Bruker brutto
        if total_profit_gross > 0.0 { 9999.0 } else { 1.0 } // <-- ENDRET: Bruker brutto
    } else {
        total_profit_gross / total_loss_gross // <-- ENDRET: Bruker brutto
    };

    // --- Returner Resultat ---
     BacktestResultWasm {
        profit_factor: if profit_factor.is_nan() { 1.0 } else { profit_factor }, // Håndterer NaN
        trades,
        total_profit: total_profit_gross, // <-- ENDRET: Returnerer brutto
        total_loss: total_loss_gross,     // <-- ENDRET: Returnerer brutto
        max_drawdown: max_drawdown * 100.0,
    }
}

// --- SMA Crossover BACKTEST FUNKSJON (Oppdatert) ---
#[wasm_bindgen]
pub fn run_backtest_sma_cross_wasm(
    close_prices: &[f64],
    short_period: usize,
    long_period: usize,
    commission_pct: f64, // <-- NY
    slippage_amount: f64 // <-- NY
) -> BacktestResultWasm {
    // --- BRUK CONSOLE::LOG_1 ---
    let log_msg = format!("[WASM SMA CONSOLE] ENTERED FUNCTION: short={}, long={}, commission={}, slippage={}, prices_len={}", short_period, long_period, commission_pct, slippage_amount, close_prices.len());
    console::log_1(&JsValue::from_str(&log_msg));
    // --- SLUTT ---

    const ERROR_PF_VALUE: f64 = -1.0;
    const START_EQUITY: f64 = 10000.0;

    // --- Input Validering ---
     if close_prices.len() <= long_period || short_period == 0 || long_period == 0 || short_period >= long_period || commission_pct < 0.0 || slippage_amount < 0.0 { // <-- ENDRET: Inkluderer nye params
        println!("[WASM SMA] Input validation failed.");
        return BacktestResultWasm { profit_factor: ERROR_PF_VALUE, trades: 0, total_profit: 0.0, total_loss: 0.0, max_drawdown: 100.0 };
    }

    // --- Beregn SMAs ---
    let short_sma: Vec<f64> = calculate_sma_rust(close_prices, short_period); // <-- KORRIGERT: Fjernet /*...*/
    let long_sma: Vec<f64> = calculate_sma_rust(close_prices, long_period);  // <-- KORRIGERT: Fjernet /*...*/
    println!("[WASM SMA] Calculated SMAs: short_len={}, long_len={}", short_sma.len(), long_sma.len());

    // --- Juster startindeks + Sjekk data ---
    let sma_align_offset = long_period - short_period;
    let loop_start_index = sma_align_offset + 1;
     if short_sma.len() <= loop_start_index || long_sma.len() <= 1 {
         println!("[WASM SMA] Not enough SMA data points. Short SMA len: {}, Long SMA len: {}, Loop start: {}", short_sma.len(), long_sma.len(), loop_start_index); // <-- ENDRET: Korrekt melding
         return BacktestResultWasm { profit_factor: ERROR_PF_VALUE, trades: 0, total_profit: 0.0, total_loss: 0.0, max_drawdown: 100.0 };
     }

    // --- Initialiser variabler ---
    let mut position: i32 = 0;
    let mut entry_price: f64 = 0.0; // Justert pris
    let mut total_profit_gross: f64 = 0.0; // <-- ENDRET: Brutto
    let mut total_loss_gross: f64 = 0.0;   // <-- ENDRET: Brutto
    let mut trades: i32 = 0;
    let mut equity: f64 = START_EQUITY;
    let mut peak_equity: f64 = START_EQUITY;
    let mut max_drawdown: f64 = 0.0;

    // --- Backtest-løkke ---
    println!("[WASM SMA] Starting loop from index {} up to {}", loop_start_index, short_sma.len());
    for i in loop_start_index..short_sma.len() {
        let short_sma_current = short_sma[i];
        let short_sma_previous = short_sma[i - 1];

        let long_sma_index = i - sma_align_offset;
        // --- Indeks SJEKK før bruk av long_sma ---
        if long_sma_index == 0 || long_sma_index >= long_sma.len() {
             println!("[WASM SMA] ERROR: long_sma_index out of bounds or zero! index={}, len={}", long_sma_index, long_sma.len());
             continue;
        }
        let long_sma_current = long_sma[long_sma_index];
        let long_sma_previous = long_sma[long_sma_index - 1]; // Nå trygt

        let price_index = short_period - 1 + i;
        // --- Indeks SJEKK før bruk av close_prices ---
        if price_index >= close_prices.len() {
            println!("[WASM SMA] ERROR: price_index out of bounds! index={}, len={}", price_index, close_prices.len());
             // Vi kan ikke fortsette hvis prisen mangler
             // Returnerer feil her for å unngå videre problemer i denne iterasjonen
             return BacktestResultWasm { // <-- KORRIGERT: La inn full struct
                 profit_factor: ERROR_PF_VALUE,
                 trades: trades,
                 total_profit: total_profit_gross, // Returner brutto hittil
                 total_loss: total_loss_gross,     // Returner brutto hittil
                 max_drawdown: 100.0
             };
        }
        let current_price = close_prices[price_index];

        // --- Drawdown Beregning ---
         peak_equity = equity.max(peak_equity);
         let potential_equity_now_gross = if position == 1 {
              START_EQUITY + total_profit_gross - total_loss_gross + (current_price - entry_price)
         } else {
              START_EQUITY + total_profit_gross - total_loss_gross
         };
         if peak_equity > 0.0 {
              let current_drawdown = (peak_equity - potential_equity_now_gross.min(peak_equity)).max(0.0) / peak_equity;
              max_drawdown = current_drawdown.max(max_drawdown);
         }

       // --- Trade Logikk MED KOSTNADER ---
       if position == 0 && short_sma_current > long_sma_current && short_sma_previous <= long_sma_previous {
           position = 1;
           entry_price = current_price + slippage_amount; // <-- NY
           trades += 1;
           let entry_commission = entry_price * commission_pct; // <-- NY
           equity -= entry_commission; // <-- NY
           println!("[WASM SMA] Iter {}: LONG ENTRY @ {} (adj. for slippage), Comm: {}", i, entry_price, entry_commission); // Valgfri
       } else if position == 1 && short_sma_current < long_sma_current && short_sma_previous >= long_sma_previous {
           let exit_price = current_price - slippage_amount; // <-- NY
           let gross_profit = exit_price - entry_price;
           let exit_commission = exit_price * commission_pct; // <-- NY
           let net_profit = gross_profit - exit_commission; // <-- NY
           equity += net_profit; // <-- Equity oppdateres med netto

          // --- HER OPPDATERES BRUTTO ---
          if gross_profit > 0.0 {
            total_profit_gross += gross_profit;
            } else {
                total_loss_gross += gross_profit.abs();
            }
            // --- SLUTT OPPDATERING BRUTTO ---
           println!("[WASM SMA] Iter {}: EXIT @ {} (adj. for slippage), Gross P/L: {}, Exit Comm: {}, Net P/L: {}", i, exit_price, gross_profit, exit_commission, net_profit); // Valgfri

           position = 0;
           entry_price = 0.0;
       }
    }
    // --- KORRIGERT LOGG ---
    println!("[WASM SMA] Loop finished."); // Skal være SMA her

    // --- Beregn Profit Factor (basert på brutto) ---
    println!("[WASM SMA] Calculating PF: ProfitGross={}, LossGross={}", total_profit_gross, total_loss_gross); // <-- LEGG TIL DENNE LOGGEN
    let profit_factor: f64 = if total_loss_gross < 1e-9 { // <-- ENDRET: Bruk en liten terskel for "null" tap
        if total_profit_gross > 1e-9 { 9999.0 } else { 1.0 } // <-- ENDRET: Bruk terskel
    } else {
        total_profit_gross / total_loss_gross
    };
    println!("[WASM SMA] Calculated PF: {}", profit_factor); // <-- LEGG TIL DENNE LOGGEN

    // --- Returner resultat ---
    BacktestResultWasm {
        profit_factor: if profit_factor.is_nan() { 1.0 } else { profit_factor },
        trades,
        total_profit: total_profit_gross, 
        total_loss: total_loss_gross, 
        max_drawdown: max_drawdown * 100.0,
    }
}

// --- add funksjon (uendret) ---
pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

// --- tester (uendret) ---
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }
}