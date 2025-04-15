chieftec@Chieftec-PC:~/trading/mc-simulations/frontend$ tree -L 4 -I 'node_modules|target|dist'
.
├── README.md
├── env.d.ts
├── eslint.config.ts
├── index.html
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── public
│   └── favicon.ico
├── src
│   ├── App.vue
│   ├── assets
│   │   ├── base.css
│   │   └── main.css
│   ├── components
│   │   ├── SimulationControls.vue
│   │   ├── SimulationResults.vue
│   │   └── __tests__
│   ├── composables
│   │   └── useKlines.ts
│   ├── main.ts
│   ├── router
│   │   └── index.ts
│   ├── rust
│   │   └── pkg
│   │       ├── README.md
│   │       ├── mc_simulations.d.ts
│   │       ├── mc_simulations.js
│   │       ├── mc_simulations_bg.wasm
│   │       ├── mc_simulations_bg.wasm.d.ts
│   │       └── package.json
│   ├── services
│   │   └── binanceAPI.ts
│   ├── stores
│   │   └── counter.ts
│   ├── types
│   │   └── simulation.ts
│   ├── views
│   │   └── SimulationView.vue
│   └── workers
│       ├── mcValidationWorker.ts
│       └── optimizationWorker.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.vitest.json
├── vite.config.ts
└── vitest.config.ts