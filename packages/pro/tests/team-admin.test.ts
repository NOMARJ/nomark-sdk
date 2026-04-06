import { describe, it, expect, vi } from 'vitest'
import {
  createTeam,
  inviteMember,
  removeMember,
  setTeamPreference,
  type TeamAdminConfig,
} from '../src/team-admin.js'
import type { LedgerEntry } from '@nomark-ai/engine'

const mockInsertData: unknown[] = []
const mockDb = {
  from: (table: string) => ({
    insert: (rows: unknown[]) => {
      mockInsertData.push(...(rows as unknown[]))
      return { data: rows.map((r, i) => ({ ...(r as Record<string, unknown>), id: `id-${i}` })), error: null }
    },
    delete: () => ({
      eq: (_col: string, _val: string) => ({
        eq: () => ({ data: null, error: null }),
      }),
    }),
    upsert: (rows: unknown[]) => ({ data: rows, error: null }),
    select: () => ({
      eq: () => ({
        data: [{ role: 'admin' }],
        error: null,
      }),
    }),
  }),
}

describe('createTeam', () => {
  it('creates a team and returns team id', async () => {
    const config: TeamAdminConfig = { userId: 'usr_admin', db: mockDb as unknown }
    const result = await createTeam(config, 'My Team')
    expect(result.teamId).toBeDefined()
  })
})

describe('inviteMember', () => {
  it('admin can invite a member', async () => {
    const config: TeamAdminConfig = { userId: 'usr_admin', db: mockDb as unknown }
    const result = await inviteMember(config, 'team_abc', 'usr_new', 'member')
    expect(result.error).toBeNull()
  })
})

describe('removeMember', () => {
  it('admin can remove a member', async () => {
    const config: TeamAdminConfig = { userId: 'usr_admin', db: mockDb as unknown }
    const result = await removeMember(config, 'team_abc', 'usr_member')
    expect(result.error).toBeNull()
  })
})

describe('setTeamPreference', () => {
  it('admin can set team preference', async () => {
    const config: TeamAdminConfig = { userId: 'usr_admin', db: mockDb as unknown }
    const entry: LedgerEntry = {
      type: 'pref',
      data: { dim: 'tone', target: 'formal', w: 0.8, n: 5, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
    }
    const result = await setTeamPreference(config, 'team_abc', entry)
    expect(result.error).toBeNull()
  })

  it('member cannot set team preference', async () => {
    const memberDb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            data: [{ role: 'member' }],
            error: null,
          }),
        }),
        upsert: () => ({ data: [], error: null }),
      }),
    }
    const config: TeamAdminConfig = { userId: 'usr_member', db: memberDb as unknown }
    const entry: LedgerEntry = {
      type: 'pref',
      data: { dim: 'tone', target: 'formal', w: 0.8, n: 5, src: {}, ctd: 0, scope: '*', decay: 0.97, last: '2026-04-06' },
    }
    await expect(setTeamPreference(config, 'team_abc', entry)).rejects.toThrow('permission')
  })
})
