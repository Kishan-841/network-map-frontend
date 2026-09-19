'use client'

import dynamic from 'next/dynamic'
import { closureKindLabel, coreColor, fiberTypeLabel, POINT_COLORS, RATIO_LABELS } from '@/lib/fiber/constants'
import { IconRoute } from '@/components/ui/icons'
import SegmentList from '@/components/fiber/SegmentList'
import FiberActions from '@/components/fiber/FiberActions'
import {
  CHIP,
  EmptyLine,
  FieldList,
  LinkRow,
  LoadError,
  Photos,
  RecordBlock,
  Section,
  Skeleton,
} from './DetailParts'
import { useDetail } from './useDetail'

// React Flow measures the DOM on mount, so the schematic never renders on the
// server. The placeholder holds its height so the drawer does not jump.
const FiberSchematic = dynamic(() => import('@/components/fiber/FiberSchematic'), {
  ssr: false,
  loading: () => <div className="h-64 rounded-card bg-paper" />,
})

const STATUS_LABEL = { PLANNED: 'Planned', LIVE: 'Live', CUT: 'Cut' }
const POINT_LABEL = { POP: 'POP', CLOSURE: 'Closure', SPLITTER: 'Splitter', BUILDING: 'Building', WAYPOINT: 'Bend' }
const metres = (n) => `${Math.round(n ?? 0)} m`

/** Where a point leads when tapped: its own record, or just the map. */
function pointTarget(point) {
  if (point.type === 'POP' && point.popId) return { kind: 'pop', id: point.popId }
  if (point.type === 'CLOSURE' && point.closureId) return { kind: 'closure', id: point.closureId }
  return null
}

function pointSub(point) {
  if (point.type === 'CLOSURE') return [POINT_LABEL.CLOSURE, closureKindLabel(point.kind)].filter(Boolean).join(' · ')
  if (point.type === 'SPLITTER') {
    return [POINT_LABEL.SPLITTER, point.splitter, point.splitterLocation].filter(Boolean).join(' · ')
  }
  return POINT_LABEL[point.type] ?? point.type
}

function FeedRows({ fiber, onOpen }) {
  if (fiber.olt) {
    return (
      <LinkRow
        color={POINT_COLORS.POP}
        title={`${fiber.olt.pop.name} · ${fiber.olt.name}`}
        sub={`OLT feed · PON port ${fiber.ponPort ?? '—'}`}
        onClick={() => onOpen({ kind: 'pop', id: fiber.olt.pop.id })}
      />
    )
  }
  if (fiber.fedBy) {
    const { portNo, splitter } = fiber.fedBy
    const where = splitter.closure?.code ?? splitter.code ?? 'splitter'
    return (
      <>
        <LinkRow
          color={POINT_COLORS.SPLITTER}
          title={`${where} · output ${portNo}`}
          sub={`Splitter ${splitter.code ?? ''} · ${RATIO_LABELS[splitter.ratio] ?? splitter.ratio} · ${splitter.location}`}
          onClick={splitter.closure ? () => onOpen({ kind: 'closure', id: splitter.closure.id }) : undefined}
        />
        {splitter.inputFiber && (
          <LinkRow
            title={splitter.inputFiber.name}
            sub="The fiber feeding that splitter"
            onClick={() => onOpen({ kind: 'fiber', id: splitter.inputFiber.id })}
          />
        )}
      </>
    )
  }
  return <EmptyLine>No feed recorded — neither an OLT port nor a splitter.</EmptyLine>
}

/** One fiber in full: the cable sheet, its route stop by stop, segments, splitters and photos. */
export default function FiberDetails({ id, canManage, onOpen, onCentre, onEdit }) {
  const { data: fiber, loading, error, retry } = useDetail(`/fibers/${id}`, 'Could not load this fiber')

  if (loading) return <Skeleton />
  if (error) return <LoadError error={error} onRetry={retry} />

  const stops = fiber.points.filter((p) => p.type !== 'WAYPOINT')
  const bends = fiber.points.length - stops.length
  const laid = fiber.totals.fiberLaidMeters
  const splitters = fiber.splitters ?? []

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: coreColor(fiber.coreCount) }}
        >
          <IconRoute className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-ink">{fiber.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${CHIP} bg-paper text-muted`}>{fiber.coreCount} core</span>
            {fiber.cableType && <span className={`${CHIP} bg-paper text-muted`}>{fiberTypeLabel(fiber.cableType)}</span>}
            {fiber.status === 'CUT' && <span className={`${CHIP} bg-bad-tint text-bad`}>Cut</span>}
          </div>
        </div>
      </div>

      <FiberActions fiber={fiber} canManage={canManage} onEdit={onEdit} />

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Length', metres(fiber.totals.mapMeters || fiber.totals.pathMeters)],
          ['Closures', fiber.totals.closureCount],
          ['Splitters', fiber.totals.splitterCount ?? 0],
        ].map(([caption, value]) => (
          <div key={caption} className="rounded-btn bg-paper px-2.5 py-2">
            <p className="truncate text-[11px] font-normal text-faint">{caption}</p>
            <p className="text-sm font-bold tabular-nums text-ink">{value}</p>
          </div>
        ))}
      </div>

      <Section title="Cable sheet">
        <FieldList
          rows={[
            ['Route name', fiber.name],
            ['Fiber ID', fiber.cableTag],
            ['Fiber type', fiberTypeLabel(fiber.cableType)],
            ['Core count', `${fiber.coreCount} core`],
            ['IN / OUT', fiber.placement],
            ['Zone', fiber.zone?.name],
            ['Operator', fiber.operator?.name],
            ['Status', STATUS_LABEL[fiber.status] ?? fiber.status],
            ['Laid length', laid > 0 ? metres(laid) : null],
            ['Remark', fiber.notes],
          ]}
        />
      </Section>

      <Section title="Feed">
        <FeedRows fiber={fiber} onOpen={onOpen} />
      </Section>

      <FiberSchematic
        fiber={fiber}
        onNodeClick={(point) => {
          const target = pointTarget(point)
          if (target) onOpen(target)
          else onCentre?.(point)
        }}
        onFiberLink={(fiberId) => onOpen({ kind: 'fiber', id: fiberId })}
      />

      <Section title="Route" count={`${stops.length} stops${bends ? ` · ${bends} bends` : ''}`}>
        {stops.length === 0 && <EmptyLine>Only bends — no POP, closure or building on this line.</EmptyLine>}
        {stops.map((point) => {
          const target = pointTarget(point)
          return (
            <LinkRow
              key={point.id}
              color={POINT_COLORS[point.type]}
              title={point.label ?? POINT_LABEL[point.type]}
              sub={pointSub(point)}
              onClick={target ? () => onOpen(target) : onCentre ? () => onCentre(point) : undefined}
            />
          )
        })}
      </Section>

      <Section title="Segments" count={fiber.segments.length}>
        <SegmentList segments={fiber.segments} points={fiber.points} />
      </Section>

      <Section title="Splitters fed by this fiber" count={splitters.length}>
        {splitters.length === 0 && <EmptyLine>None.</EmptyLine>}
        {splitters.map((splitter) => (
          <div key={splitter.id} className="flex flex-col gap-1 rounded-card border border-line p-3">
            <p className="text-sm font-bold text-ink">
              {splitter.code ?? 'Splitter'} · {RATIO_LABELS[splitter.ratio] ?? splitter.ratio} · {splitter.location}
              {splitter.closure ? ` · at ${splitter.closure.code}` : ''}
            </p>
            {splitter.outputs.map((output) =>
              output.toFiber ? (
                <LinkRow
                  key={output.portNo}
                  title={`Out ${output.portNo} → ${output.toFiber.name}`}
                  onClick={() => onOpen({ kind: 'fiber', id: output.toFiber.id })}
                />
              ) : (
                <LinkRow
                  key={output.portNo}
                  title={`Out ${output.portNo}${output.toBuilding ? ` → ${output.toBuilding.buildingName}` : ''}`}
                  badge={output.toBuilding ? null : 'free'}
                />
              ),
            )}
          </div>
        ))}
      </Section>

      {fiber.downstream && (
        <Section title="Out of service because of the cut">
          <FieldList
            rows={[
              ['Buildings', fiber.downstream.buildings.map((b) => b.buildingName).join(', ') || 'None'],
              ['Fibers', fiber.downstream.fibers.map((f) => f.name).join(', ') || 'None'],
            ]}
          />
        </Section>
      )}

      <Photos images={fiber.images} />

      <RecordBlock record={fiber} />
    </>
  )
}
