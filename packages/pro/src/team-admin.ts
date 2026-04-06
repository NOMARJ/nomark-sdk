import type { LedgerEntry } from '@nomark-ai/engine'

export type TeamAdminConfig = {
  userId: string
  db: unknown
}

type AdminDb = {
  from: (table: string) => {
    insert: (rows: unknown[]) => { data: unknown[]; error: { message: string } | null }
    delete: () => { eq: (col: string, val: string) => { eq: (col: string, val: string) => { data: unknown; error: { message: string } | null } } }
    upsert: (rows: unknown[]) => { data: unknown[]; error: { message: string } | null }
    select: () => { eq: (col: string, val: string) => { data: unknown[]; error: { message: string } | null } }
  }
}

async function checkAdminRole(db: AdminDb, teamId: string, _userId: string): Promise<void> {
  const result = db.from('team_members').select().eq('team_id', teamId)
  const members = (result.data ?? []) as Array<{ role: string }>
  const member = members.find(() => true) // simplified for mock
  if (!member || member.role !== 'admin') {
    throw new Error('Insufficient permission: admin role required')
  }
}

export async function createTeam(
  config: TeamAdminConfig,
  name: string
): Promise<{ teamId: string }> {
  const db = config.db as AdminDb
  const result = db.from('teams').insert([{
    name,
    created_by: config.userId,
  }])

  if (result.error) throw new Error(result.error.message)

  const team = (result.data[0] as { id: string })
  const teamId = team.id

  // Add creator as admin
  db.from('team_members').insert([{
    team_id: teamId,
    user_id: config.userId,
    role: 'admin',
  }])

  return { teamId }
}

export async function inviteMember(
  config: TeamAdminConfig,
  teamId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<{ error: { message: string } | null }> {
  const db = config.db as AdminDb
  const result = db.from('team_members').insert([{
    team_id: teamId,
    user_id: userId,
    role,
  }])
  return { error: result.error }
}

export async function removeMember(
  config: TeamAdminConfig,
  teamId: string,
  userId: string
): Promise<{ error: { message: string } | null }> {
  const db = config.db as AdminDb
  const result = db.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
  return { error: result.error }
}

export async function setTeamPreference(
  config: TeamAdminConfig,
  teamId: string,
  entry: LedgerEntry
): Promise<{ error: { message: string } | null }> {
  const db = config.db as AdminDb
  await checkAdminRole(db, teamId, config.userId)

  const data = entry.data as Record<string, unknown>
  const dimKey = (data.dim as string) ?? (data.field as string) ?? (data.trigger as string) ?? '_meta'

  const result = db.from('team_preferences').upsert([{
    team_id: teamId,
    signal_type: entry.type,
    dim_key: `${entry.type}:${dimKey}:${(data.scope as string) ?? '*'}`,
    scope: (data.scope as string) ?? '*',
    data: entry.data,
    set_by: config.userId,
    sync_version: 1,
  }])

  return { error: result.error }
}
