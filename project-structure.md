chieftec@Chieftec-PC:~/trading/mc-simulations$ tree -L 4 -I 'node_modules|target|dist'
.
├── Cargo.lock
├── Cargo.toml
├── README.md
├── frontend
│   ├── README.md
│   ├── env.d.ts
│   ├── eslint.config.ts
│   ├── index.html
│   ├── package.json
│   ├── pnpm-lock.yaml
│   ├── pnpm-workspace.yaml
│   ├── public
│   │   ├── _routes.json
│   │   └── favicon.ico
│   ├── src
│   │   ├── App.vue
│   │   ├── assets
│   │   │   ├── base.css
│   │   │   └── main.css
│   │   ├── components
│   │   │   ├── SimulationControls.vue
│   │   │   ├── SimulationResults.vue
│   │   │   └── __tests__
│   │   ├── composables
│   │   │   └── useKlines.ts
│   │   ├── main.ts
│   │   ├── router
│   │   │   └── index.ts
│   │   ├── rust
│   │   │   └── pkg
│   │   ├── services
│   │   │   └── binanceAPI.ts
│   │   ├── stores
│   │   │   └── counter.ts
│   │   ├── types
│   │   │   └── simulation.ts
│   │   ├── views
│   │   │   └── SimulationView.vue
│   │   └── workers
│   │       ├── mcValidationWorker.ts
│   │       └── optimizationWorker.ts
│   ├── tsconfig.app.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tsconfig.vitest.json
│   ├── vite.config.ts
│   └── vitest.config.ts
├── functions
│   ├── binance-proxy.ts
│   └── tsconfig.json
├── notes.txt
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── project-structure.md
└── src
    └── lib.rs