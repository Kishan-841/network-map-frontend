'use client'

import { IconChevronRight, IconCrosshair, IconNavigate } from '@/components/ui/icons'
import { addedBy, coordText, formatWhen, mapsUrl, NOT_RECORDED, shown } from '@/lib/fiber/detail-format'

export const CHIP = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium'

/** A titled block. `count` sits beside the title for lists. */
export function Section({ title, count, children }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-wide text-faint">
        {title}
        {count != null && <span className="font-mono normal-case tracking-normal">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

/**
 * Label/value rows. Every row is always shown: a blank answer reads "Not
 * recorded", so what the survey sheet is missing is visible, not hidden.
 */
export function FieldList({ rows }) {
  return (
    <dl className="divide-y divide-line/60 rounded-card border border-line">
      {rows.map(([label, value]) => {
        const text = shown(value)
        return (
          <div key={label} className="flex gap-3 px-3 py-2.5 text-sm">
            <dt className="w-32 shrink-0 font-normal text-muted">{label}</dt>
            <dd className={`min-w-0 flex-1 break-words ${text === NOT_RECORDED ? 'text-faint' : 'font-medium text-ink'}`}>
              {text}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

export function Photos({ images }) {
  const list = images ?? []
  return (
    <Section title="Photos" count={list.length}>
      {list.length === 0 ? (
        <p className="text-sm font-normal text-faint">No photos.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {list.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-24 w-full rounded-btn object-cover" />
            </a>
          ))}
        </div>
      )}
    </Section>
  )
}

/** A row that opens another record in the drawer (or does nothing, if it can't). */
export function LinkRow({ color, title, sub, badge, onClick }) {
  const body = (
    <>
      {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{title}</span>
        {sub && <span className="block truncate text-xs font-normal text-muted">{sub}</span>}
      </span>
      {badge && <span className={`${CHIP} shrink-0 bg-paper text-muted`}>{badge}</span>}
      {onClick && <IconChevronRight className="h-4 w-4 shrink-0 text-faint" />}
    </>
  )
  const cls = 'flex min-h-11 w-full items-center gap-2.5 rounded-btn px-2 py-1.5 text-left'
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" onClick={onClick} className={`${cls} transition-colors hover:bg-paper`}>
      {body}
    </button>
  )
}

export function EmptyLine({ children }) {
  return <p className="px-2 text-sm font-normal text-faint">{children}</p>
}

/** Where it is: the coordinates, a jump on our map, and a hand-off to Google Maps. */
export function LocationBlock({ latitude, longitude, onCentre }) {
  const url = mapsUrl(latitude, longitude)
  return (
    <Section title="Location">
      <p className="font-mono text-sm text-ink">{coordText(latitude, longitude)}</p>
      <div className="flex flex-wrap gap-2">
        {onCentre && url && (
          <button
            type="button"
            onClick={() => onCentre({ latitude, longitude })}
            className="inline-flex min-h-11 items-center gap-2 rounded-btn border border-line px-3 text-sm font-medium transition-colors hover:bg-paper"
          >
            <IconCrosshair className="h-4 w-4" strokeWidth={1.8} />
            Show on map
          </button>
        )}
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-btn border border-line px-3 text-sm font-medium transition-colors hover:bg-paper"
          >
            <IconNavigate className="h-4 w-4" strokeWidth={1.8} />
            Open in Google Maps
          </a>
        )}
      </div>
    </Section>
  )
}

/** Who and when — the last block of every record. */
export function RecordBlock({ record }) {
  return (
    <Section title="Record">
      <FieldList
        rows={[
          ['Added by', addedBy(record)],
          ['Added on', formatWhen(record?.createdAt)],
          ...(record && 'updatedAt' in record ? [['Last changed', formatWhen(record.updatedAt)]] : []),
        ]}
      />
    </Section>
  )
}

export function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="h-7 w-40 animate-pulse rounded-btn bg-paper" />
      <div className="h-6 w-56 animate-pulse rounded-full bg-paper" />
      <div className="h-40 w-full animate-pulse rounded-card bg-paper" />
      <div className="h-24 w-full animate-pulse rounded-card bg-paper" />
    </div>
  )
}

export function LoadError({ error, onRetry }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-btn border border-line px-4 text-sm font-medium transition-colors hover:bg-paper"
      >
        Retry
      </button>
    </div>
  )
}
