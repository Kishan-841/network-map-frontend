import { IconShield } from '@/components/ui/icons'

/**
 * "Society" — a building that came in through the permission executives and
 * was approved by the admin. Same shield as its map marker, so the list and
 * the map say the same thing.
 */
export function SocietyBadge({ className = '' }) {
  return (
    <span
      title="Society permission — added by a permission executive, approved by the admin"
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-doc-tint px-2 py-0.5 text-xs font-medium text-doc ${className}`}
    >
      <IconShield className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
      Society
    </span>
  )
}
