# Monte Carlo Trading Strategy Simulation Dashboard

[![Rust Build](https://github.com/actions/workflows/rust.yml/badge.svg)](https://github.com/actions/workflows/rust.yml) <!-- Optional: Add CI badge if you set it up -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) <!-- Optional: Choose and add a license -->

A web-based dashboard for backtesting trading strategies and evaluating their robustness using Monte Carlo simulations. Built with Vue 3 (TypeScript) for the frontend and Rust compiled to WebAssembly (Wasm) for high-performance calculations.

## Overview

The primary goal of this project is to provide a tool for traders and quantitative analysts to:
1.  Quickly optimize strategy parameters against historical market data (Grid Search).
2.  Thoroughly validate the performance and risk profile of selected parameters using Monte Carlo simulations based on historical price dynamics (Bootstrapping).

This helps in assessing whether a strategy's historical performance is likely due to genuine edge or simply curve-fitting.

## Features ✨

*   **Data Fetching:** Loads historical K-line (candlestick) data from the Binance API.
*   **Step 1: Grid Search Optimization:**
    *   Finds top-performing parameter sets for a given strategy based on historical data.
    *   Currently implemented: SMA (Simple Moving Average) Crossover strategy.
    *   Calculates metrics like Profit Factor and Trade Count.
*   **Step 2: Monte Carlo Validation:**
    *   Runs thousands of simulated price paths based on historical percentage changes (Bootstrapping).
    *   Performs backtests on each simulated path using the selected parameters.
    *   Generates distributions for key metrics:
        *   Profit/Loss (%)
        *   Maximum Drawdown (%)
    *   Calculates summary statistics (Average, Median, Percentiles/VaR).
*   **Web Worker Integration:** Offloads computationally intensive tasks (Optimization, MC Simulations) to Web Workers, keeping the UI responsive.
*   **Interactive Dashboard:** Built with Vue 3 and TypeScript for a modern user experience.
*   **Visualization:** Uses ApexCharts to display P/L and Max Drawdown histograms.
*   **Configurable Parameters:** Allows users to set data source (Symbol, Timeframe, Data Limit), strategy parameters, and Monte Carlo settings (Iterations, Bars per Simulation).
*   **Transparency:** Displays context for simulations, including data range and parameters used.

## Technology Stack 🛠️

*   **Frontend:**
    *   [Vue 3](https://vuejs.org/) (Composition API with `<script setup>`)
    *   [TypeScript](https://www.typescriptlang.org/)
    *   [Vite](https://vitejs.dev/) (Build Tool & Dev Server)
    *   [Vue3 ApexCharts](https://github.com/apexcharts/vue3-apexcharts) (Charting Library)
    *   [pnpm](https://pnpm.io/) (Package Manager)
*   **Backend / Computation Logic:**
    *   [Rust](https://www.rust-lang.org/) (High-performance calculations)
    *   [WebAssembly (Wasm)](https://webassembly.org/) (Target for Rust compilation)
    *   [wasm-pack](https://rustwasm.github.io/wasm-pack/) (Build tool for Wasm package)
    *   [Cargo](https://doc.rust-lang.org/cargo/) (Rust Package Manager)
*   **Data Source:**
    *   [Binance API](https://binance-docs.github.io/apidocs/spot/en/) (for historical K-line data)

## Project Structure 📁

```text
mc-simulations/
├── frontend/ # Vue.js Frontend Application
│ ├── public/
│ ├── src/
│ │ ├── assets/
│ │ ├── components/ # Vue components (Controls, Results)
│ │ ├── composables/ # Vue composables (e.g., useKlines)
│ │ ├── services/ # API interaction (e.g., binanceAPI.ts)
│ │ ├── views/ # Main view (SimulationView.vue)
│ │ ├── workers/ # Web Workers (optimization, mcValidation)
│ │ ├── rust/ # Link to the built Wasm package (usually in pkg/)
│ │ │ └── pkg/ # Generated Wasm, JS bindings, TS types by wasm-pack
│ │ ├── App.vue
│ │ └── main.ts
│ ├── index.html
│ ├── package.json
│ ├── pnpm-lock.yaml
│ ├── tsconfig.json
│ └── vite.config.ts
│
├── src/ # Rust Library Source Code
│ └── lib.rs # Main Rust code for calculations & Wasm bindings
│
├── .gitignore
├── Cargo.toml # Rust dependencies and package info
├── Cargo.lock
├── package.json # Root package.json (potentially for workspace commands)
├── pnpm-workspace.yaml # Defines pnpm workspace
└── README.md # This file
```

*(Note: The exact location of the `pkg` directory might depend on `wasm-pack` output configuration, often placed inside `frontend/src/rust/` or directly at the root/`frontend` level for easier import.)*

## Getting Started 🚀

### Prerequisites

*   [Node.js](https://nodejs.org/) (LTS version recommended) and [pnpm](https://pnpm.io/installation)
*   [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
*   [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/):
    ```bash
    cargo install wasm-pack
    ```

### Installation & Running

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd mc-simulations
    ```

2.  **Build the Rust/Wasm package:**
    *   Navigate to the Rust project root (where `Cargo.toml` is located - likely the project root `mc-simulations/`).
    *   Run the build command. This compiles Rust to Wasm and generates JavaScript bindings, placing them typically in a `pkg/` directory (check your setup). The `--target web` flag is crucial for browser compatibility.
    ```bash
    wasm-pack build --target web
    ```
    *(Ensure the output path aligns with where the frontend expects to import it from, e.g., `frontend/src/rust/pkg/`)*

3.  **Set up the Frontend:**
    *   Navigate to the frontend directory:
        ```bash
        cd frontend
        ```
    *   Install dependencies:
        ```bash
        pnpm install
        ```

4.  **Run the Development Server:**
    *   From the `frontend` directory:
        ```bash
        pnpm run dev
        ```
    *   Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173` or similar).

## Usage Guide 📖

1.  **Configure Data Source:**
    *   Enter the desired trading `Symbol` (e.g., `SOLUSDT`).
    *   Set the `Timeframe` (e.g., `1h`, `4h`, `1d`).
    *   Specify the `Data Limit` (max number of historical bars to fetch - Note: Binance API might cap this, often at 1000 per request).
2.  **Configure Strategy Parameters (Step 1):**
    *   (Currently SMA Crossover) Set the ranges (`Min`, `Max`, `Step`) for `Short Period` and `Long Period`.
3.  **Run Optimization (Step 1):**
    *   Click `Start Optimization (Step 1)`.
    *   The application will fetch data and the optimization worker will perform a grid search using the Rust/Wasm backend.
    *   Status updates will be shown.
    *   A table with the top N performing parameter sets (based on Profit Factor) will appear under "Simulation Results".
4.  **Select Parameters for Validation:**
    *   Click the `Select` button next to the desired parameter set in the results table.
    *   The status will confirm your selection.
5.  **Configure Monte Carlo Settings (Step 2):**
    *   Set the number of `Iterations` (simulated paths).
    *   Set the number of `Bars per Sim` (length of each simulated path).
6.  **Run Monte Carlo Validation (Step 2):**
    *   Click `Run MC Validation (Step 2)`.
    *   The MC worker will generate simulated paths and run backtests using Rust/Wasm.
    *   Status updates will be shown during the process.
7.  **Analyze MC Results:**
    *   Once finished, the "Simulation Results" section will display:
        *   **Context:** Parameters, MC settings, and data period used.
        *   **Summary Statistics:** Key metrics like average/median P/L and Max Drawdown, percentiles (VaR).
        *   **Histograms:** Visual distributions of P/L (%) and Max Drawdown (%).

## Current Status & Roadmap 🏗️

*   **Status:** Under active development. Core framework for data fetching, optimization (SMA Cross), MC validation, and visualization is functional.
*   **Known Limitations:**
    *   Binance API limit restricts single data fetches (typically to 1000 bars). Fetching longer history requires implementing multi-request logic.
    *   Backtesting logic is simplified (execution at close, no commissions/slippage).
*   **Next Steps:**
    *   Implement RSI strategy.
    *   Refactor parameter handling for multiple strategies.
    *   Improve UI/UX (e.g., clearer loading indicators, error handling).
    *   Explore adding more complex metrics and backtest features.
    *   Consider implementing multi-request data fetching for longer history.

## License 📄

This project is currently unlicensed. Please add a LICENSE file (e.g., MIT, Apache 2.0) to define how others can use it.

---

*Feel free to contribute or report issues!*