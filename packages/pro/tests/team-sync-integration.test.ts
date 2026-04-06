import { describe, it, expect, vi } from 'vitest'
import { createTeamSync } from '../src/team-sync.js'
import { createTeam, inviteMember, setTeamPreference } from '../src/team-admin.js'
import type { LedgerEntry } from '@nomark/engine'

vi.mock('@nomark/engine', async (importOriginal) => {
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

const teamPrefs: Record<string, unknown[]> = {}

const mockDb = {
  from: (table: string) => ({
    insert: (rows: unknown[]) => {
      const withIds = rows.map((r, i) => ({ ...(r as Record<string, unknown>), id: `id-${Date.now()}-${i}` }))
      return { data: withIds, error: null }
    },
    upsert: (rows: unknown[]) => {
      teamPrefs[table] = teamPrefs[table] ?? []
      teamPrefs[table].push(...(rows as unknown[]))
      return { data: rows, error: null }
    },
    select: () => ({
      eq: (_col: string, _val: string) => ({
        data: (teamPrefs[table] ?? []).length > 0
          ? teamPrefs[table]
          : [{ role: 'admin' }],
        error: null,
      }),
    }),
    delete: () => ({
      eq: () => ({ eq: () => ({ data: null, error: null }) }),
    }),
  }),
}

const mkPref = (dim: string, target: string, w: number): LedgerEntry => ({
  type: 'pref',
  data: { dim, target, w, n: 10, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
})

describe('Team sync hierarchy integration', () => {
  it('individual tone=casual overrides team tone=formal overrides platform tone=neutral', () => {
    const teamSync = createTeamSync({
      teamId: 'team_abc',
      userId: 'usr_test',
      role: 'admin',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      db: mockDb,
    })

    const platformDefaults = [mkPref('tone', 'neutral', 0.5)]
    const teamBaseline = [mkPref('tone', 'formal', 0.8)]
    const individual = [mkPref('tone', 'casual', 0.9)]

    const resolved = teamSync.resolveHierarchy(platformDefaults, teamBaseline, individual)

    expect(resolved).toHaveLength(1)
    const tonePref = resolved[0]
    expect((tonePref.data as { target: string }).target).toBe('casual')
  })

  it('team overrides platform when no individual entry exists', () => {
    const teamSync = createTeamSync({
      teamId: 'team_abc',
      userId: 'usr_test',
      role: 'admin',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      db: mockDb,
    })

    const platformDefaults = [mkPref('tone', 'neutral', 0.5)]
    const teamBaseline = [mkPref('tone', 'formal', 0.8)]

    const resolved = teamSync.resolveHierarchy(platformDefaults, teamBaseline, [])

    const tonePref = resolved[0]
    expect((tonePref.data as { target: string }).target).toBe('formal')
  })

  it('platform default wins when no team or individual entry exists', () => {
    const teamSync = createTeamSync({
      teamId: 'team_abc',
      userId: 'usr_test',
      role: 'admin',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      db: mockDb,
    })

    const platformDefaults = [mkPref('tone', 'neutral', 0.5)]

    const resolved = teamSync.resolveHierarchy(platformDefaults, [], [])

    const tonePref = resolved[0]
    expect((tonePref.data as { target: string }).target).toBe('neutral')
  })

  it('entries unique to each level all appear in resolved output', () => {
    const teamSync = createTeamSync({
      teamId: 'team_abc',
      userId: 'usr_test',
      role: 'admin',
      supabaseUrl: 'https://test.supabase.co',
      supabaseKey: 'test-key',
      db: mockDb,
    })

    const platformDefaults = [mkPref('verbosity', 'short', 0.5)]
    const teamBaseline = [mkPref('format', 'bullets', 0.7)]
    const individual = [mkPref('audience', 'devs', 0.9)]

    const resolved = teamSync.resolveHierarchy(platformDefaults, teamBaseline, individual)

    expect(resolved).toHaveLength(3)
    const dims = resolved.map(e => (e.data as { dim: string }).dim).sort()
    expect(dims).toEqual(['audience', 'format', 'verbosity'])
  })

  it('admin can create team and set team preference', async () => {
    const adminConfig = { userId: 'usr_admin', db: mockDb }
    const result = await createTeam(adminConfig, 'Test Team')
    expect(result.teamId).toBeDefined()

    const prefResult = await setTeamPreference(
      adminConfig,
      result.teamId,
      mkPref('tone', 'formal', 0.8)
    )
    expect(prefResult.error).toBeNull()
  })

  it('team admin workflow: create → invite → set preference', async () => {
    const adminConfig = { userId: 'usr_admin', db: mockDb }

    const { teamId } = await createTeam(adminConfig, 'Engineering')
    const inviteResult = await inviteMember(adminConfig, teamId, 'usr_dev', 'member')
    expect(inviteResult.error).toBeNull()

    const prefResult = await setTeamPreference(
      adminConfig,
      teamId,
      mkPref('tone', 'direct', 0.85)
    )
    expect(prefResult.error).toBeNull()
  })
})
