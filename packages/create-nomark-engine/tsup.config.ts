import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  target: 'es2022',
  outDir: 'dist',
  banner: { js: '#!/usr/bin/env node' },
})
