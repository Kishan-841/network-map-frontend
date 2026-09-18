import { describe, it, expect } from 'vitest'
import { pickExtraNav } from '../nav-extras'

// Shaped like MANAGE_LINKS, minus the icons (this module never touches them).
const LINKS = [
  { href: '/partners', label: 'Partners' },
  { href: '/leads', label: 'Leads' },
  { href: '/admin/zones', label: 'Zones' },
  { href: '/admin/fiber', label: 'Fibers' },
  { href: '/admin/pops', label: 'POPs' },
  { href: '/admin/closures', label: 'Closures' },
  { href: '/admin/users', label: 'Users' },
]
const user = (role, canManageFiber = false) => ({ role, canManageFiber })

describe('pickExtraNav', () => {
  it('gives a ticked surveyor the fiber pages, in the order they are listed', () => {
    expect(pickExtraNav(LINKS, user('SURVEYOR', true)).map((i) => i.href)).toEqual([
      '/admin/fiber',
      '/admin/pops',
      '/admin/closures',
    ])
  })

  it('gives a ticked supervisor or manager the same pages', () => {
    for (const role of ['SUPERVISOR', 'MANAGER']) {
      expect(pickExtraNav(LINKS, user(role, true)).map((i) => i.href)).toEqual([
        '/admin/fiber',
        '/admin/pops',
        '/admin/closures',
      ])
    }
  })

  it('gives an unticked surveyor or manager nothing', () => {
    expect(pickExtraNav(LINKS, user('SURVEYOR'))).toEqual([])
    expect(pickExtraNav(LINKS, user('MANAGER'))).toEqual([])
  })

  it('gives an admin every link, whole entries so the sheet keeps its icons', () => {
    const extra = pickExtraNav(LINKS, user('ADMIN'))
    expect(extra).toHaveLength(LINKS.length)
    expect(extra[0]).toEqual(LINKS[0])
  })

  it('leaves out what is already a tab, so More never repeats the bar', () => {
    const hrefs = pickExtraNav(LINKS, user('ADMIN'), ['/partners', '/admin/fiber']).map((i) => i.href)
    expect(hrefs).not.toContain('/partners')
    expect(hrefs).not.toContain('/admin/fiber')
    expect(hrefs).toContain('/admin/pops')
  })

  it('is empty, not broken, before the user has loaded', () => {
    expect(pickExtraNav(LINKS, undefined)).toEqual([])
    expect(pickExtraNav(LINKS, null)).toEqual([])
    expect(pickExtraNav(undefined, user('ADMIN'))).toEqual([])
  })
})
