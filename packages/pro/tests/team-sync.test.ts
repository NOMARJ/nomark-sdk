import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTeamSync, type TeamSync, type TeamSyncConfig } from '../src/team-sync.js'

vi.mock('@nomark-ai/engine', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    createSyncClient: () => ({
      push: vi.fn().mockResolvedValue({ synced: 1, filtered: 0, queued: false, entries: [] }),
      pull: vi.fn().mockResolvedValue([]),
      subscribe: vi.fn().mockReturnValue(() => {}),
      disconnect: vi.fn(),
      reconnect: vi.fn(),
      status: () => ({ connected: true, last_push: null, last_pull: null, pending_ops: 0, sync_version: 0 }),
      on: vi.fn(),
    }),
  }
})

const mockDb = {
  from: (table: string) => ({
    select: () => ({
      eq: (_col: string, _val: string) => ({
        data: table === 'team_preferences'
          ? [{ signal_type: 'pref', dim_key: 'tone', scope: '*', data: { dim: 'tone', target: 'formal', w: 0.8, n: 5, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } }]
          : [],
        error: null,
      }),
    }),
    upsert: (rows: unknown[]) => ({ data: rows, error: null }),
    insert: (rows: unknown[]) => ({ data: rows, error: null }),
    delete: () => ({ eq: () => ({ data: null, error: null }) }),
  }),
}

describe('createTeamSync', () => {
  let teamSync: TeamSync

  beforeEach(() => {
    const config: TeamSyncConfig = {
      teamId: 'team_abc',
      userId: 'usr_test',
      role: 'admin',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      db: mockDb as unknown,
    }
    teamSync = createTeamSync(config)
  })

  it('returns object with pushTeamPreferences and pullTeamPreferences', () => {
    expect(typeof teamSync.pushTeamPreferences).toBe('function')
    expect(typeof teamSync.pullTeamPreferences).toBe('function')
  })

  it('returns resolveHierarchy function', () => {
    expect(typeof teamSync.resolveHierarchy).toBe('function')
  })

  it('hierarchy resolution: individual overrides team', () => {
    const platformDefaults = [
      { type: 'pref' as const, data: { dim: 'tone', target: 'neutral', w: 0.5, n: 0, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]
    const teamBaseline = [
      { type: 'pref' as const, data: { dim: 'tone', target: 'formal', w: 0.8, n: 5, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]
    const individual = [
      { type: 'pref' as const, data: { dim: 'tone', target: 'casual', w: 0.9, n: 10, src: { code: 5 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]

    const resolved = teamSync.resolveHierarchy(platformDefaults, teamBaseline, individual)
    const tonePref = resolved.find(e => e.type === 'pref' && (e.data as { dim: string }).dim === 'tone')
    expect((tonePref?.data as { target: string }).target).toBe('casual')
  })

  it('hierarchy resolution: team overrides platform when no individual', () => {
    const platformDefaults = [
      { type: 'pref' as const, data: { dim: 'tone', target: 'neutral', w: 0.5, n: 0, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]
    const teamBaseline = [
      { type: 'pref' as const, data: { dim: 'tone', target: 'formal', w: 0.8, n: 5, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]

    const resolved = teamSync.resolveHierarchy(platformDefaults, teamBaseline, [])
    const tonePref = resolved.find(e => e.type === 'pref' && (e.data as { dim: string }).dim === 'tone')
    expect((tonePref?.data as { target: string }).target).toBe('formal')
  })

  it('hierarchy includes entries unique to each level', () => {
    const platform = [
      { type: 'pref' as const, data: { dim: 'verbosity', target: 'short', w: 0.5, n: 0, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]
    const team = [
      { type: 'pref' as const, data: { dim: 'format', target: 'bullets', w: 0.7, n: 3, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]
    const individual = [
      { type: 'pref' as const, data: { dim: 'audience', target: 'devs', w: 0.9, n: 8, src: { code: 8 }, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' } },
    ]

    const resolved = teamSync.resolveHierarchy(platform, team, individual)
    expect(resolved).toHaveLength(3)
  })

  it('pullTeamPreferences returns team entries', async () => {
    const entries = await teamSync.pullTeamPreferences()
    expect(Array.isArray(entries)).toBe(true)
  })
})
