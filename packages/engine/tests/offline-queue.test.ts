import { describe, it, expect } from 'vitest'
import { OfflineQueue } from '../src/sync/offline-queue.js'
import type { SyncEntry } from '../src/sync/types.js'

const makeEntry = (dim: string): SyncEntry => ({
  type: 'pref',
  data: { dim, target: 'direct', w: 0.9, n: 20, src: { code: 12 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
  sync_version: 1,
  user_id: 'usr_abc',
  updated_at: '2026-04-06T10:00:00Z',
})

describe('OfflineQueue', () => {
  it('enqueues and flushes operations in FIFO order', () => {
    const queue = new OfflineQueue()
    queue.enqueue('push', [makeEntry('tone')])
    queue.enqueue('push', [makeEntry('length')])
    const ops = queue.flush()
    expect(ops).toHaveLength(2)
    expect((ops[0].entries[0].data as { dim: string }).dim).toBe('tone')
    expect((ops[1].entries[0].data as { dim: string }).dim).toBe('length')
  })

  it('flush clears the queue', () => {
    const queue = new OfflineQueue()
    queue.enqueue('push', [makeEntry('tone')])
    queue.flush()
    expect(queue.flush()).toHaveLength(0)
  })

  it('deduplicates by entry key (type + dim + scope)', () => {
    const queue = new OfflineQueue()
    queue.enqueue('push', [makeEntry('tone')])
    queue.enqueue('push', [makeEntry('tone')])
    const ops = queue.flush()
    expect(ops).toHaveLength(1)
  })

  it('does not deduplicate different dims', () => {
    const queue = new OfflineQueue()
    queue.enqueue('push', [makeEntry('tone')])
    queue.enqueue('push', [makeEntry('length')])
    expect(queue.flush()).toHaveLength(2)
  })

  it('reports pending count', () => {
    const queue = new OfflineQueue()
    expect(queue.pendingCount).toBe(0)
    queue.enqueue('push', [makeEntry('tone')])
    expect(queue.pendingCount).toBe(1)
    queue.enqueue('push', [makeEntry('length')])
    expect(queue.pendingCount).toBe(2)
  })

  it('handles pull operations', () => {
    const queue = new OfflineQueue()
    queue.enqueue('pull', [])
    const ops = queue.flush()
    expect(ops).toHaveLength(1)
    expect(ops[0].kind).toBe('pull')
  })
})
