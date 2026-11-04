import '@fontsource-variable/hanken-grotesk/wght.css'
import './assets/main.css'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'

createApp(App).use(router).mount('#app')
