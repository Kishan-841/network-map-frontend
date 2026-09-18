import { describe, it, expect } from 'vitest'
import {
  canEditBuilding,
  canManageFiber,
  fiberNavFor,
  isForbiddenPath,
  mayHoldAccess,
  mayOpenAdminPath,
} from '../roles'

const user = (role, canManageFiber = false) => ({ role, canManageFiber })

describe('canManageFiber', () => {
  it('is always true for an ADMIN', () => {
    expect(canManageFiber(user('ADMIN'))).toBe(true)
  })

  it('needs the tick for MANAGER, SURVEYOR and SUPERVISOR', () => {
    for (const role of ['MANAGER', 'SURVEYOR', 'SUPERVISOR']) {
      expect(canManageFiber(user(role, false))).toBe(false)
      expect(canManageFiber(user(role, true))).toBe(true)
    }
  })

  it('ignores a tick on a role that cannot hold it', () => {
    expect(canManageFiber(user('ACQUISITION_AGENT', true))).toBe(false)
  })

  it('is false before the user has loaded', () => {
    expect(canManageFiber(undefined)).toBe(false)
    expect(canManageFiber(null)).toBe(false)
  })
})

describe('mayOpenAdminPath', () => {
  it('opens the fiber pages to a ticked surveyor, and nothing else under /admin', () => {
    const ticked = user('SURVEYOR', true)
    expect(mayOpenAdminPath(ticked, '/admin/fiber')).toBe(true)
    expect(mayOpenAdminPath(ticked, '/admin/closures')).toBe(true)
    expect(mayOpenAdminPath(ticked, '/admin/users')).toBe(false)
    expect(mayOpenAdminPath(ticked, '/admin/pops')).toBe(false)
  })

  it('keeps an unticked manager out of the fiber pages but in the rest', () => {
    const manager = user('MANAGER')
    expect(mayOpenAdminPath(manager, '/admin/fiber')).toBe(false)
    expect(mayOpenAdminPath(manager, '/admin/zones')).toBe(true)
  })

  it('does not mistake /admin/fiber-something for a fiber page', () => {
    expect(mayOpenAdminPath(user('SURVEYOR', true), '/admin/fiberglass')).toBe(false)
  })
})

describe('isForbiddenPath', () => {
  it('lets a ticked supervisor through to the fiber pages only', () => {
    const ticked = user('SUPERVISOR', true)
    expect(isForbiddenPath('SUPERVISOR', '/admin/fiber', ticked)).toBe(false)
    expect(isForbiddenPath('SUPERVISOR', '/admin/users', ticked)).toBe(true)
  })

  it('still keeps an unticked supervisor out of /admin', () => {
    expect(isForbiddenPath('SUPERVISOR', '/admin/fiber', user('SUPERVISOR'))).toBe(true)
  })

  it('never opens the fiber pages to the acquisition team, ticked or not', () => {
    expect(isForbiddenPath('ACQUISITION_AGENT', '/admin/fiber', user('ACQUISITION_AGENT', true))).toBe(true)
  })
})

describe('fiberNavFor', () => {
  it('gives a ticked non-admin the Fibers and Closures links', () => {
    expect(fiberNavFor(user('SURVEYOR', true)).map((item) => item.href)).toEqual([
      '/admin/fiber',
      '/admin/closures',
    ])
  })

  it('gives nothing to an unticked user, nor to an ADMIN (who has the full groups)', () => {
    expect(fiberNavFor(user('MANAGER'))).toEqual([])
    expect(fiberNavFor(user('ADMIN'))).toEqual([])
  })
})

describe('canEditBuilding', () => {
  const building = (createdById) => ({ id: 'b1', createdById })

  it('lets the roles that always could edit anyone\'s building', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SUPERVISOR']) {
      expect(canEditBuilding(user(role), building('someone-else'))).toBe(true)
    }
  })

  it('lets a ticked surveyor edit the building they logged', () => {
    expect(canEditBuilding({ id: 'u1', role: 'SURVEYOR', canEditBuildings: true }, building('u1'))).toBe(true)
  })

  it('stops a ticked surveyor on someone else\'s building', () => {
    expect(canEditBuilding({ id: 'u1', role: 'SURVEYOR', canEditBuildings: true }, building('u2'))).toBe(false)
  })

  it('stops an unticked surveyor on their own building', () => {
    expect(canEditBuilding({ id: 'u1', role: 'SURVEYOR' }, building('u1'))).toBe(false)
  })

  it('is false while either the user or the building is still loading', () => {
    expect(canEditBuilding(undefined, building('u1'))).toBe(false)
    expect(canEditBuilding({ id: 'u1', role: 'SURVEYOR', canEditBuildings: true }, null)).toBe(false)
  })
})

describe('mayHoldAccess', () => {
  it('says which ticks a role can hold', () => {
    expect(mayHoldAccess('SURVEYOR', 'canEditBuildings')).toBe(true)
    expect(mayHoldAccess('MANAGER', 'canEditBuildings')).toBe(false)
    expect(mayHoldAccess('MANAGER', 'canManageFiber')).toBe(true)
    expect(mayHoldAccess('ADMIN', 'canManageFiber')).toBe(false)
  })
})

