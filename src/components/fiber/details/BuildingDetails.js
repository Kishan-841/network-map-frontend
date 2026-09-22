'use client'

import Link from 'next/link'
import { IconBuildings } from '@/components/ui/icons'
import { POINT_COLORS } from '@/lib/fiber/constants'
import {
  CHIP,
  EmptyLine,
  FieldList,
  LinkRow,
  LoadError,
  LocationBlock,
  RecordBlock,
  Section,
  Skeleton,
} from './DetailParts'
import { useDetail } from './useDetail'

const titleCase = (value) =>
  value ? value.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : null

/** One building in full, opened from the map: its details and its OLT mapping. */
export default function BuildingDetails({ id, onOpen, onCentre }) {
  const { data: b, loading, error, retry } = useDetail(`/buildings/${id}`, 'Could not load this building')

  if (loading) return <Skeleton />
  if (error) return <LoadError error={error} onRetry={retry} />

  const pop = b.olt?.pop ?? null

  return (
    <>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fiber text-white">
          <IconBuildings className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-ink">{b.buildingName}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${CHIP} ${b.isLive ? 'bg-ok-tint text-ok' : 'bg-paper text-muted'}`}>
              {b.isLive ? 'Live' : 'Not live'}
            </span>
            {b.zone?.name && <span className={`${CHIP} bg-paper text-muted`}>{b.zone.name}</span>}
          </div>
        </div>
      </div>

      <Link
        href={`/buildings/${b.id}`}
        className="inline-flex min-h-11 w-fit items-center rounded-btn border border-line px-4 text-sm font-medium transition-colors hover:bg-paper"
      >
        Open full building
      </Link>

      <Section title="OLT mapping">
        {b.olt ? (
          <>
            <FieldList
              rows={[
                ['OLT', b.olt.name],
                ['PON port', b.ponPort],
                ['On POP', pop?.name],
                ['Zone', pop?.zone?.name],
              ]}
            />
            {pop && (
              <LinkRow
                color={POINT_COLORS.POP}
                title={pop.name}
                sub="Open this POP"
                onClick={() => onOpen({ kind: 'pop', id: pop.id })}
              />
            )}
          </>
        ) : (
          <EmptyLine>Not mapped to an OLT yet.</EmptyLine>
        )}
      </Section>

      <Section title="Overview">
        <FieldList
          rows={[
            ['Address', b.formattedAddress],
            ['City', b.city?.name],
            ['Home pass', b.details?.homePass],
            ['Building type', b.details?.buildingType],
            ['Floors', b.details?.floors],
            ['Wings', b.details?.wings],
            ['Remarks', b.details?.remarks],
          ]}
        />
      </Section>

      <Section title="Status">
        <FieldList
          rows={[
            ['Connection', b.isLive ? 'Live' : 'Not live'],
            ['Feasibility', titleCase(b.feasibleStatus)],
            ['Survey', titleCase(b.surveyStatus)],
          ]}
        />
      </Section>

      <LocationBlock latitude={b.latitude} longitude={b.longitude} onCentre={onCentre} />

      <RecordBlock record={b} />
    </>
  )
}
