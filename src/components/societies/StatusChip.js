import { permissionStatusBadge, permissionStatusLabel } from '@/lib/society'

/** A society's permission status as a small pill — "No status" when none was recorded. */
export function StatusChip({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${permissionStatusBadge(status)} ${className}`}
    >
      {status ? permissionStatusLabel(status) : 'No status'}
    </span>
  )
}
