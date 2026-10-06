import { canManageFiber, FIBER_PAGE_HREFS, partnerNavFor } from './roles'

/**
 * What goes behind the bottom bar's "More" tab, beyond the role's own tabs.
 *
 * The phone bar carries a role's daily work and nothing else, so the admin
 * pages — the fiber editor above all — had no way in on a phone at all. This
 * picks the ones this user may open: everything for an admin, and the fiber
 * pages for whoever was ticked on Users → Assign accesses, and the
 * partner-network pages for a sales manager. Mirrors the
 * sidebar, which shows the Manage groups to an admin and a Fiber group to a
 * ticked user.
 *
 * `links` is MANAGE_LINKS (passed in, so this module stays free of icons and
 * can be tested); `taken` is the hrefs already on the bar, which must not
 * appear twice.
 */
export function pickExtraNav(links, user, taken = []) {
  if (user?.role === 'ADMIN') return (links ?? []).filter((link) => !taken.includes(link.href))
  // Pages this user was given on top of their role: the fiber pages for a
  // ticked user, the partner-network pages for a sales manager.
  const hrefs = [...(canManageFiber(user) ? FIBER_PAGE_HREFS : []), ...partnerNavFor(user?.role)]
  if (hrefs.length === 0) return []
  return (links ?? []).filter((link) => hrefs.includes(link.href) && !taken.includes(link.href))
}
