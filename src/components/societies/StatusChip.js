import { societyChip } from '@/lib/society'

/**
 * A society's status as a small pill: its admin approval when it has one
 * ("Waiting for approval", "Approved", "Rejected"), otherwise the permission
 * status — "No status" when none was recorded.
 */
export function StatusChip({ status, approval = null, className = '' }) {
  const chip = societyChip({ permissionStatus: status, approval })
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${chip.className} ${className}`}
    >
      {chip.label}
    </span>
  )
}
