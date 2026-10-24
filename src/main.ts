import { createApp } from 'vue';
import App from './App.vue';
import { useLevelStore } from './composables/useLevelStore';
import { installE2eHooks } from './e2e-hooks';
import router from './router';
import './styles/main.scss';

installE2eHooks(useLevelStore());

createApp(App).use(router).mount('#app');
