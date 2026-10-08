import Link from 'next/link'
import { approvalNotice } from '@/lib/society'

const TONE = {
  warn: 'border-warn/30 bg-warn-tint text-warn',
  bad: 'border-bad/30 bg-bad-tint text-bad',
  ok: 'border-ok/30 bg-ok-tint text-ok',
}

/**
 * Where a society stands with the admin, at the top of its page: waiting
 * (amber), rejected with the reason the executive must fix (red), or approved
 * into a zone (green, with a link to the building it now is — `buildingId`
 * is passed only for someone who can open Buildings, never the executive).
 */
export function ApprovalNotice({ approval, zone, buildingId }) {
  const n = approvalNotice(approval, zone)
  if (!n) return null
  return (
    <section role="status" className={`mb-4 min-w-0 rounded-card border px-4 py-3 ${TONE[n.tone]}`}>
      <p className="text-sm font-semibold">{n.title}</p>
      {n.detail && <p className="mt-0.5 break-words text-sm font-normal">{n.detail}</p>}
      {n.reason && (
        <p className="mt-2 whitespace-pre-wrap break-words rounded-btn bg-card px-3 py-2 text-sm font-normal text-ink">
          {n.reasonLabel && <span className="font-medium text-muted">{n.reasonLabel}: </span>}
          {n.reason}
        </p>
      )}
      {n.tone === 'ok' && buildingId && (
        <Link
          href={`/buildings/${buildingId}`}
          className="mt-2 inline-flex min-h-9 items-center text-sm font-medium underline underline-offset-2"
        >
          Open in Buildings
        </Link>
      )}
    </section>
  )
}
