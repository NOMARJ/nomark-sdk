import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRealtimeSubscription, type RealtimeConfig } from '../src/sync/realtime.js'

describe('createRealtimeSubscription', () => {
  const mockUnsubscribe = vi.fn()
  const mockRemoveChannel = vi.fn()
  let onCallback: ((payload: unknown) => void) | null = null

  const mockChannel = {
    on: vi.fn().mockImplementation((_event: string, _config: unknown, cb: (payload: unknown) => void) => {
      onCallback = cb
      return { subscribe: () => ({ unsubscribe: mockUnsubscribe }) }
    }),
  }

  const mockDb = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: mockRemoveChannel,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    onCallback = null
  })

  it('subscribe invokes callback on INSERT events', () => {
    const callback = vi.fn()
    const config: RealtimeConfig = { db: mockDb as unknown, userId: 'usr_test' }
    createRealtimeSubscription(config, callback)

    // Simulate a Realtime INSERT event
    onCallback?.({
      new: { signal_type: 'pref', data: { dim: 'tone', target: 'direct' } },
    })

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith([
      { type: 'pref', data: { dim: 'tone', target: 'direct' } },
    ])
  })

  it('returns unsubscribe function', () => {
    const config: RealtimeConfig = { db: mockDb as unknown, userId: 'usr_test' }
    const unsub = createRealtimeSubscription(config, vi.fn())
    expect(typeof unsub).toBe('function')
  })

  it('unsubscribe removes channel', () => {
    const config: RealtimeConfig = { db: mockDb as unknown, userId: 'usr_test' }
    const unsub = createRealtimeSubscription(config, vi.fn())
    unsub()
    expect(mockRemoveChannel).toHaveBeenCalled()
  })
})
