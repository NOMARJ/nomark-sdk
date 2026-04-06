import { defineConfig } from 'tsup'

const BSL_HEADER = `/**
 * @nomark-ai/pro — Business Source License 1.1
 * Licensed under the BSL 1.1. See LICENSE for details.
 * Change Date: 2029-04-06
 * Change License: Apache License 2.0
 */`

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
  external: ['@nomark-ai/engine'],
  banner: { js: BSL_HEADER },
})
