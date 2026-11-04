import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Bind-mounted volumes on Windows and macOS do not always emit file events.
    watch: {
      usePolling: process.env.VITE_USE_POLLING === 'true',
      ignored: ['**/storybook-static/**', '**/coverage/**', '**/reports/**'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.spec.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'cobertura', 'html'],
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/tests/**', 'src/stories/**', 'src/main.ts', 'src/**/*.d.ts'],
    },
  },
})
