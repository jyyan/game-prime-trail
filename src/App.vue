<script setup lang="ts">
import { RouterView } from 'vue-router';
import BsConfirmHost from './components/ui/BsConfirmHost.vue';
import BsToastHost from './components/ui/BsToastHost.vue';
</script>

<template>
  <main class="container-fluid px-2 px-md-3">
    <RouterView />
  </main>
  <BsToastHost />
  <BsConfirmHost />
</template>
