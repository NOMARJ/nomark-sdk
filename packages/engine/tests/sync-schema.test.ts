import { describe, it, expect } from 'vitest'
import {
  SyncEntrySchema,
  SyncStatusSchema,
  OfflineOpSchema,
  SyncConfigSchema,
  type SyncEntry,
  type SyncStatus,
  type OfflineOp,
  type SyncConfig,
  type ConflictStrategy,
} from '../src/sync/types.js'

describe('SyncEntrySchema', () => {
  const validPref: SyncEntry = {
    type: 'pref',
    data: {
      dim: 'tone',
      target: 'direct',
      w: 0.9,
      n: 20,
      src: { code: 12, chat: 8 },
      ctd: 1,
      scope: '*',
      decay: 0.97,
      last: '2026-04-06',
    },
    sync_version: 1,
    user_id: 'usr_abc123',
    updated_at: '2026-04-06T10:00:00Z',
  }

  it('accepts valid sync entry with pref type', () => {
    expect(SyncEntrySchema.safeParse(validPref).success).toBe(true)
  })

  it('accepts valid sync entry with map type', () => {
    const entry: SyncEntry = {
      type: 'map',
      data: {
        trigger: 'make it shorter',
        pattern_type: 'rewrite_request',
        intent: ['reduce_length_40pct'],
        n: 8,
        scope: '*',
        last: '2026-04-06',
        conf: 0.85,
      },
      sync_version: 2,
      user_id: 'usr_abc123',
      updated_at: '2026-04-06T10:00:00Z',
    }
    expect(SyncEntrySchema.safeParse(entry).success).toBe(true)
  })

  it('accepts valid sync entry with asn type', () => {
    const entry: SyncEntry = {
      type: 'asn',
      data: {
        field: 'audience',
        default: 'developers',
        accuracy: 0.92,
        total: 25,
        correct: 23,
        last: '2026-04-05',
      },
      sync_version: 1,
      user_id: 'usr_abc123',
      updated_at: '2026-04-06T10:00:00Z',
    }
    expect(SyncEntrySchema.safeParse(entry).success).toBe(true)
  })

  it('accepts valid sync entry with meta type', () => {
    const entry: SyncEntry = {
      type: 'meta',
      data: {
        profile: { tone: 'direct' },
        signals: 47,
        by_ctx: { code: 30, chat: 17 },
        by_out: { accepted: 40, rejected: 7 },
        avg_conf: 0.82,
        avg_q: 3.2,
        updated: '2026-04-06',
      },
      sync_version: 3,
      user_id: 'usr_abc123',
      updated_at: '2026-04-06T10:00:00Z',
    }
    expect(SyncEntrySchema.safeParse(entry).success).toBe(true)
  })

  it('rejects rub type entries (not syncable)', () => {
    const rubEntry = {
      type: 'rub',
      data: {
        id: 'rub-1',
        fmt: 'email',
        stage: 'pending',
        uses: 5,
        accepts: 3,
        avg_ed: 0.2,
        dims: { tone: 0.8 },
        min: 0.5,
        last: '2026-04-06',
      },
      sync_version: 1,
      user_id: 'usr_abc123',
      updated_at: '2026-04-06T10:00:00Z',
    }
    expect(SyncEntrySchema.safeParse(rubEntry).success).toBe(false)
  })

  it('rejects entries missing user_id', () => {
    const { user_id: _, ...noUser } = validPref
    expect(SyncEntrySchema.safeParse(noUser).success).toBe(false)
  })

  it('rejects entries missing sync_version', () => {
    const { sync_version: _, ...noVersion } = validPref
    expect(SyncEntrySchema.safeParse(noVersion).success).toBe(false)
  })

  it('rejects entries missing updated_at', () => {
    const { updated_at: _, ...noUpdated } = validPref
    expect(SyncEntrySchema.safeParse(noUpdated).success).toBe(false)
  })
})

describe('SyncStatusSchema', () => {
  it('accepts valid sync status', () => {
    const status: SyncStatus = {
      connected: true,
      last_push: '2026-04-06T10:00:00Z',
      last_pull: '2026-04-06T09:55:00Z',
      pending_ops: 0,
      sync_version: 5,
    }
    expect(SyncStatusSchema.safeParse(status).success).toBe(true)
  })

  it('accepts disconnected status with null timestamps', () => {
    const status: SyncStatus = {
      connected: false,
      last_push: null,
      last_pull: null,
      pending_ops: 3,
      sync_version: 0,
    }
    expect(SyncStatusSchema.safeParse(status).success).toBe(true)
  })
})

describe('OfflineOpSchema', () => {
  it('accepts valid push operation', () => {
    const op: OfflineOp = {
      id: 'op-1',
      kind: 'push',
      entries: [
        {
          type: 'pref',
          data: {
            dim: 'tone',
            target: 'direct',
            w: 0.9,
            n: 20,
            src: { code: 12 },
            ctd: 0,
            scope: '*',
            decay: 0.97,
            last: '2026-04-06',
          },
          sync_version: 1,
          user_id: 'usr_abc',
          updated_at: '2026-04-06T10:00:00Z',
        },
      ],
      created_at: '2026-04-06T10:00:00Z',
    }
    expect(OfflineOpSchema.safeParse(op).success).toBe(true)
  })

  it('accepts valid pull operation (no entries)', () => {
    const op: OfflineOp = {
      id: 'op-2',
      kind: 'pull',
      entries: [],
      created_at: '2026-04-06T10:05:00Z',
    }
    expect(OfflineOpSchema.safeParse(op).success).toBe(true)
  })
})

describe('SyncConfigSchema', () => {
  it('accepts valid config', () => {
    const config: SyncConfig = {
      supabaseUrl: 'https://abc.supabase.co',
      supabaseKey: 'eyJ...',
      userId: 'usr_abc123',
    }
    expect(SyncConfigSchema.safeParse(config).success).toBe(true)
  })

  it('rejects config without supabaseUrl', () => {
    expect(
      SyncConfigSchema.safeParse({ supabaseKey: 'key', userId: 'usr' }).success
    ).toBe(false)
  })

  it('rejects config without userId', () => {
    expect(
      SyncConfigSchema.safeParse({ supabaseUrl: 'url', supabaseKey: 'key' })
        .success
    ).toBe(false)
  })
})

describe('ConflictStrategy type', () => {
  it('archive-wins is assignable', () => {
    const s: ConflictStrategy = 'archive-wins'
    expect(s).toBe('archive-wins')
  })

  it('local-wins is assignable', () => {
    const s: ConflictStrategy = 'local-wins'
    expect(s).toBe('local-wins')
  })
})
