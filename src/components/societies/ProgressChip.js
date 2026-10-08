import { societyProgress, PROGRESS_STEPS } from '@/lib/society-survey'

/**
 * Where a society is in the whole flow — approval, survey, materials, live —
 * as one chip with a small five-step bar under it (rejections in red).
 */
export function ProgressChip({ approval, survey, isLive, className = '' }) {
  const p = societyProgress({ approval, survey, isLive })
  const bad = p.className.includes('text-bad')
  return (
    <span className={`inline-flex flex-col gap-1 ${className}`}>
      <span className={`inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${p.className}`}>
        {p.label}
      </span>
      <span className="flex gap-0.5" aria-label={`Step ${p.step} of ${PROGRESS_STEPS}`}>
        {Array.from({ length: PROGRESS_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1 w-4 rounded-full ${i < p.step ? (bad && i === p.step - 1 ? 'bg-bad' : 'bg-ok') : 'bg-line'}`}
          />
        ))}
      </span>
    </span>
  )
}
