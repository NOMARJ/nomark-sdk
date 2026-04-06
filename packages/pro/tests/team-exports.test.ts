import { describe, it, expect } from 'vitest'
import {
  createTeamSync,
  createTeam,
  inviteMember,
  removeMember,
  setTeamPreference,
} from '../src/index.js'

describe('team sync exports from @nomark/pro barrel', () => {
  it('exports createTeamSync as function', () => {
    expect(typeof createTeamSync).toBe('function')
  })

  it('exports createTeam as function', () => {
    expect(typeof createTeam).toBe('function')
  })

  it('exports inviteMember as function', () => {
    expect(typeof inviteMember).toBe('function')
  })

  it('exports removeMember as function', () => {
    expect(typeof removeMember).toBe('function')
  })

  it('exports setTeamPreference as function', () => {
    expect(typeof setTeamPreference).toBe('function')
  })
})
