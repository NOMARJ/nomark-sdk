import { describe } from 'vitest'
import { FIXTURE_LABELS, testBackend } from './harness.js'

describe('resolver backends (byte-equality)', () => {
  for (const label of FIXTURE_LABELS) {
    testBackend(label)
  }
})
