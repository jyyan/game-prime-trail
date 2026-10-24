import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/data/__slow__/**/*.test.ts'],
    testTimeout: 600_000,
  },
});
