import { describe, it, expect } from 'vitest'
import {
  createSyncClient,
  filterSyncable,
  stageForSync,
  unstage,
  isStaged,
  resolveConflict,
  diffLedger,
  mergeLedger,
  entryKey,
  OfflineQueue,
  SyncEntrySchema,
  SyncStatusSchema,
  OfflineOpSchema,
  SyncConfigSchema,
} from '../src/index.js'

describe('sync exports from @nomark-ai/engine barrel', () => {
  it('exports createSyncClient as function', () => {
    expect(typeof createSyncClient).toBe('function')
  })

  it('exports filterSyncable as function', () => {
    expect(typeof filterSyncable).toBe('function')
  })

  it('exports protocol functions', () => {
    expect(typeof stageForSync).toBe('function')
    expect(typeof unstage).toBe('function')
    expect(typeof isStaged).toBe('function')
    expect(typeof resolveConflict).toBe('function')
  })

  it('exports merge functions', () => {
    expect(typeof diffLedger).toBe('function')
    expect(typeof mergeLedger).toBe('function')
    expect(typeof entryKey).toBe('function')
  })

  it('exports OfflineQueue as constructor', () => {
    expect(typeof OfflineQueue).toBe('function')
    const q = new OfflineQueue()
    expect(q.pendingCount).toBe(0)
  })

  it('exports Zod schemas', () => {
    expect(SyncEntrySchema).toBeDefined()
    expect(SyncStatusSchema).toBeDefined()
    expect(OfflineOpSchema).toBeDefined()
    expect(SyncConfigSchema).toBeDefined()
  })
})
