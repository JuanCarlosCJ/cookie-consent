import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))

export default defineConfig({
  define: { __VERSION__: JSON.stringify(version) },
  build: {
    // ES2017 keeps the script working in older browsers that still visit small business sites.
    target: 'es2017',
    lib: {
      entry: 'src/index.ts',
      name: 'CookieConsentBundle',
      formats: ['iife'],
      fileName: () => 'cookie-consent.min.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
})
