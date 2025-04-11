import './assets/main.css'

import { createApp } from 'vue'
// import { createPinia } from 'pinia'  << -- Skal være med om pinia benyttes

import App from './App.vue'
// import router from './router'        << -- Skal være med om router benyttes

const app = createApp(App)
// app.use(createPinia())               << -- Skal være med om pinia benyttes

// app.use(router)                      << -- Skal være med om router benyttes

app.mount('#app')