import { FIBER_ACCESS_ROLES } from './roles'

/**
 * Who appears on Users → Assign accesses: the roles that can hold fiber
 * access (an admin has it anyway; the other teams never reach the map),
 * narrowed by the search box.
 */
export function accessCandidates(users, search) {
  const needle = (search ?? '').trim().toLowerCase()
  return (users ?? []).filter(
    (user) =>
      FIBER_ACCESS_ROLES.includes(user.role) &&
      (!needle ||
        user.name?.toLowerCase().includes(needle) ||
        user.email?.toLowerCase().includes(needle)),
  )
}
