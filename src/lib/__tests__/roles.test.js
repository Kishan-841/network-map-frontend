import { describe, it, expect } from 'vitest'
import {
  assignTargets,
  receivesVisitTasks,
  canManageTeamZones,
  canAssignOlt,
  canEditBuilding,
  canManageFiber,
  fiberNavFor,
  homePathFor,
  isForbiddenPath,
  canApprovePartners,
  mayOpenAdminPath,
  canManagePartners,
  isPermissionExecutive,
  mayHoldAccess,
  ROLE_LABELS,
  isZoneManager,
  seesCompanyWideCharts,
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
    expect(mayOpenAdminPath(ticked, '/admin/pops')).toBe(true)
    expect(mayOpenAdminPath(ticked, '/admin/users')).toBe(false)
    expect(mayOpenAdminPath(ticked, '/admin/zones')).toBe(false)
  })

  it('keeps an unticked manager out of the fiber pages and the setup pages; Users stays open', () => {
    const manager = user('MANAGER')
    expect(mayOpenAdminPath(manager, '/admin/fiber')).toBe(false)
    expect(mayOpenAdminPath(manager, '/admin/users')).toBe(true)
    for (const p of ['/admin/zones', '/admin/operators', '/admin/building-types', '/admin/cities', '/admin/system-logs', '/admin/app-releases']) {
      expect(mayOpenAdminPath(manager, p)).toBe(false)
    }
    expect(mayOpenAdminPath(user('ADMIN'), '/admin/zones')).toBe(true)
  })

  it('opens Users itself to a manager, not its sub-pages (Assign accesses is the admin\'s)', () => {
    const manager = user('MANAGER')
    expect(mayOpenAdminPath(manager, '/admin/users/')).toBe(true)
    expect(mayOpenAdminPath(manager, '/admin/users/access')).toBe(false)
    expect(mayOpenAdminPath(manager, '/admin/usersx')).toBe(false)
    expect(mayOpenAdminPath(user('ADMIN'), '/admin/users/access')).toBe(true)
  })

  it('lets a ticked manager into the fiber pages as well as Users', () => {
    const ticked = user('MANAGER', true)
    expect(mayOpenAdminPath(ticked, '/admin/fiber')).toBe(true)
    expect(mayOpenAdminPath(ticked, '/admin/users')).toBe(true)
    expect(mayOpenAdminPath(ticked, '/admin/zones')).toBe(false)
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
  it('gives a ticked non-admin the Fibers, Closures, POPs and Splitters links', () => {
    expect(fiberNavFor(user('SURVEYOR', true)).map((item) => item.href)).toEqual([
      '/admin/fiber',
      '/admin/closures',
      '/admin/pops',
      '/admin/splitters',
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

  it('leaves an approved society to ADMIN alone (the API answers others 403)', () => {
    const society = { id: 'b1', createdById: 'u1', source: 'PERMISSION' }
    expect(canEditBuilding(user('ADMIN'), society)).toBe(true)
    for (const role of ['MANAGER', 'SUPERVISOR']) expect(canEditBuilding(user(role), society)).toBe(false)
    expect(canEditBuilding({ id: 'u1', role: 'SURVEYOR', canEditBuildings: true }, society)).toBe(false)
  })

  it('is false while either the user or the building is still loading', () => {
    expect(canEditBuilding(undefined, building('u1'))).toBe(false)
    expect(canEditBuilding({ id: 'u1', role: 'SURVEYOR', canEditBuildings: true }, null)).toBe(false)
  })
})

describe('canAssignOlt', () => {
  it('allows every coverage role — a surveyor needs no edit tick', () => {
    for (const role of ['ADMIN', 'MANAGER', 'SUPERVISOR', 'SURVEYOR']) {
      expect(canAssignOlt(role)).toBe(true)
    }
  })

  it('denies acquisition and other roles', () => {
    for (const role of ['ACQUISITION_AGENT', 'ACQUISITION_LEAD', 'PARTNER_MANAGER', 'ACCOUNTS', undefined]) {
      expect(canAssignOlt(role)).toBe(false)
    }
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


describe('permission executive', () => {
  it('labels and identifies the role', () => {
    expect(ROLE_LABELS.PERMISSION_EXECUTIVE).toBe('Permission Executive')
    expect(isPermissionExecutive('PERMISSION_EXECUTIVE')).toBe(true)
    expect(isPermissionExecutive('SURVEYOR')).toBe(false)
  })
  it('lands on /societies and is confined to it', () => {
    expect(homePathFor('PERMISSION_EXECUTIVE')).toBe('/societies')
    expect(isForbiddenPath('PERMISSION_EXECUTIVE', '/societies')).toBe(false)
    expect(isForbiddenPath('PERMISSION_EXECUTIVE', '/societies/add')).toBe(false)
    expect(isForbiddenPath('PERMISSION_EXECUTIVE', '/profile')).toBe(false)
    expect(isForbiddenPath('PERMISSION_EXECUTIVE', '/map')).toBe(true)
    expect(isForbiddenPath('PERMISSION_EXECUTIVE', '/admin/users')).toBe(true)
    expect(isForbiddenPath('PERMISSION_EXECUTIVE', '/societies/abc123')).toBe(false)
  })
  it('society permissions: the admin reads them (list + detail) but does not add; no other role reaches them', () => {
    expect(isForbiddenPath('ADMIN', '/societies')).toBe(false)
    expect(isForbiddenPath('ADMIN', '/societies/abc123')).toBe(false)
    expect(isForbiddenPath('ADMIN', '/societies/add')).toBe(true)
    for (const role of ['MANAGER', 'SUPERVISOR', 'ACQUISITION_AGENT', 'ACQUISITION_LEAD']) {
      expect(isForbiddenPath(role, '/societies')).toBe(true)
      expect(isForbiddenPath(role, '/societies/abc123')).toBe(true)
    }
  })
  it('society surveys: a surveyor reads the list + detail (their zones) but does not add', () => {
    expect(isForbiddenPath('SURVEYOR', '/societies')).toBe(false)
    expect(isForbiddenPath('SURVEYOR', '/societies/abc123')).toBe(false)
    expect(isForbiddenPath('SURVEYOR', '/societies/add')).toBe(true)
  })
})

describe('team zones', () => {
  it('only admins and sales managers manage team-leader zones', () => {
    expect(canManageTeamZones('ADMIN')).toBe(true)
    expect(canManageTeamZones('SALES_MANAGER')).toBe(true)
    expect(['TEAM_LEADER', 'SALES_EXECUTIVE', 'MANAGER', undefined].some(canManageTeamZones)).toBe(false)
  })
  it('the assign picker never offers a team leader (they get zones instead)', () => {
    const team = [
      { id: 't', role: 'TEAM_LEADER' },
      { id: 's', role: 'SALES_EXECUTIVE' },
      { id: 'm', role: 'SALES_MANAGER' },
    ]
    expect(assignTargets(team).map((u) => u.id)).toEqual(['s', 'm'])
    expect(assignTargets(null)).toEqual([])
  })
})

describe('sales manager and the partner network', () => {
  it('reaches the four partner pages and their own sales pages, nothing else', () => {
    for (const path of ['/partner-dashboard', '/partners', '/leads', '/admin/partner-approvals', '/sales', '/sales/leads', '/profile']) {
      expect(isForbiddenPath('SALES_MANAGER', path)).toBe(false)
    }
    for (const path of ['/referrals', '/payouts', '/calculator', '/admin/users', '/buildings', '/map']) {
      expect(isForbiddenPath('SALES_MANAGER', path)).toBe(true)
    }
  })

  it('team leaders and executives stay out of the partner network', () => {
    for (const role of ['TEAM_LEADER', 'SALES_EXECUTIVE']) {
      for (const path of ['/partner-dashboard', '/partners', '/leads', '/admin/partner-approvals']) {
        expect(isForbiddenPath(role, path)).toBe(true)
      }
    }
  })

  it('approves partners like an admin; a partner manager does not', () => {
    expect(canManagePartners('SALES_MANAGER')).toBe(true)
    expect(canApprovePartners('SALES_MANAGER')).toBe(true)
    expect(canApprovePartners('ADMIN')).toBe(true)
    expect(canApprovePartners('PARTNER_MANAGER')).toBe(false)
    expect(canApprovePartners('TEAM_LEADER')).toBe(false)
  })

  it('opens the Partner approvals page inside /admin, and no other admin page', () => {
    const sm = { role: 'SALES_MANAGER' }
    expect(mayOpenAdminPath(sm, '/admin/partner-approvals')).toBe(true)
    expect(mayOpenAdminPath(sm, '/admin/users')).toBe(false)
    expect(mayOpenAdminPath({ role: 'ADMIN' }, '/admin/partner-approvals')).toBe(true)
    expect(mayOpenAdminPath({ role: 'PARTNER_MANAGER' }, '/admin/partner-approvals')).toBe(false)
    expect(mayOpenAdminPath({ role: 'TEAM_LEADER' }, '/admin/partner-approvals')).toBe(false)
  })

  it('gives visit-plan tasks (Calendar, Overdue) to executives and team leaders only', () => {
    expect(receivesVisitTasks('SALES_EXECUTIVE')).toBe(true)
    expect(receivesVisitTasks('TEAM_LEADER')).toBe(true)
    expect(receivesVisitTasks('SALES_MANAGER')).toBe(false)
    expect(receivesVisitTasks('ADMIN')).toBe(false)
  })
})

describe('isZoneManager', () => {
  it('is the MANAGER role only', () => {
    expect(isZoneManager('MANAGER')).toBe(true)
    for (const r of ['ADMIN', 'SURVEYOR', 'SALES_MANAGER', undefined]) expect(isZoneManager(r)).toBe(false)
  })
})

describe('seesCompanyWideCharts', () => {
  it('is ADMIN only — zone readers get the charts empty from the API', () => {
    expect(seesCompanyWideCharts('ADMIN')).toBe(true)
    for (const role of ['MANAGER', 'SURVEYOR', 'SUPERVISOR', undefined]) {
      expect(seesCompanyWideCharts(role)).toBe(false)
    }
  })
})
