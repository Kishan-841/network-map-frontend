import { canManageFiber, FIBER_PAGE_HREFS } from './roles'

/**
 * What goes behind the bottom bar's "More" tab, beyond the role's own tabs.
 *
 * The phone bar carries a role's daily work and nothing else, so the admin
 * pages — the fiber editor above all — had no way in on a phone at all. This
 * picks the ones this user may open: everything for an admin, and the fiber
 * pages for whoever was ticked on Users → Assign accesses. Mirrors the
 * sidebar, which shows the Manage groups to an admin and a Fiber group to a
 * ticked user.
 *
 * `links` is MANAGE_LINKS (passed in, so this module stays free of icons and
 * can be tested); `taken` is the hrefs already on the bar, which must not
 * appear twice.
 */
export function pickExtraNav(links, user, taken = []) {
  const allowed =
    user?.role === 'ADMIN' ? () => true : canManageFiber(user) ? (link) => FIBER_PAGE_HREFS.includes(link.href) : null
  if (!allowed) return []
  return (links ?? []).filter((link) => allowed(link) && !taken.includes(link.href))
}
