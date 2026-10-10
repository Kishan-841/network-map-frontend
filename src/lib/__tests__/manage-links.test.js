import { describe, it, expect, vi } from 'vitest'

// The real icons module is JSX in a .js file, which vitest's node transform
// cannot parse; the links only need *something* in the icon slot.
vi.mock('@/components/ui/icons', () =>
  Object.fromEntries(
    [
      'IconMap',
      'IconLayers',
      'IconPin',
      'IconNavigate',
      'IconBuildings',
      'IconUser',
      'IconUsers',
      'IconUserPlus',
      'IconShare',
      'IconLogs',
      'IconCalculator',
      'IconRupee',
      'IconDashboard',
      'IconHome',
      'IconCrosshair',
      'IconDiamond',
      'IconSmartphone',
      'IconTeamPlan',
      'IconDoc',
    ].map((name) => [name, name]),
  ),
)

const { MANAGE_LINKS } = await import('../manage-links')
const { mayOpenAdminPath } = await import('../roles')

const user = (role, canManageFiber = false) => ({ role, canManageFiber })

describe('MANAGE_LINKS for a manager', () => {
  it("shows a manager's grid only their team and the fiber pages", () => {
    const hrefs = MANAGE_LINKS.filter((l) => !l.adminOnly).map((l) => l.href)
    expect(hrefs.sort()).toEqual(
      ['/admin/users', '/admin/fiber', '/admin/pops', '/admin/closures', '/admin/splitters'].sort(),
    )
  })

  it('opens every link the grid offers a ticked manager', () => {
    const ticked = user('MANAGER', true)
    for (const l of MANAGE_LINKS.filter((link) => !link.adminOnly)) {
      expect(mayOpenAdminPath(ticked, l.href)).toBe(true)
    }
  })
})
