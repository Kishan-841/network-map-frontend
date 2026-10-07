/** A small red count on a nav item; nothing when the count is 0. */
export function NavBadge({ count, className = '' }) {
  if (!count) return null
  return (
    <span
      aria-label={`${count} overdue`}
      className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-bad px-1 text-[10px] font-bold leading-none tabular-nums text-white ${className}`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
