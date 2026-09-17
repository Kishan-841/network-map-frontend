import { describe, it, expect } from 'vitest'
import { accessCandidates } from '../access'

const USERS = [
  { id: '1', name: 'Asha Patil', email: 'asha@isp.local', role: 'SURVEYOR' },
  { id: '2', name: 'Ravi Kale', email: 'ravi@isp.local', role: 'MANAGER' },
  { id: '3', name: 'Meera Joshi', email: 'meera@isp.local', role: 'SUPERVISOR' },
  { id: '4', name: 'Root', email: 'admin@isp.local', role: 'ADMIN' },
  { id: '5', name: 'Agent', email: 'agent@isp.local', role: 'ACQUISITION_AGENT' },
]

describe('accessCandidates', () => {
  it('keeps only the roles that can hold fiber access', () => {
    expect(accessCandidates(USERS, '').map((u) => u.id)).toEqual(['1', '2', '3'])
  })

  it('searches name and email, ignoring case and outer spaces', () => {
    expect(accessCandidates(USERS, '  RAVI ').map((u) => u.id)).toEqual(['2'])
    expect(accessCandidates(USERS, 'meera@').map((u) => u.id)).toEqual(['3'])
  })

  it('is empty, not broken, before the users have loaded', () => {
    expect(accessCandidates(null, '')).toEqual([])
  })
})
