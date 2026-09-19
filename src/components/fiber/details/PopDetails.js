'use client'

import { Button } from '@/components/ui/Button'
import { IconEdit, IconTriangle } from '@/components/ui/icons'
import { coreColor, POINT_COLORS } from '@/lib/fiber/constants'
import { RACK_CONDITION_LABELS } from '@/lib/fiber/pop-sheet'
import {
  CHIP,
  EmptyLine,
  FieldList,
  LinkRow,
  LoadError,
  LocationBlock,
  Photos,
  RecordBlock,
  Section,
  Skeleton,
} from './DetailParts'
import { useDetail } from './useDetail'

const DEVICE_SECTIONS = [
  { kind: 'SWITCH', title: 'Switches', noun: 'Switch' },
  { kind: 'MIKROTIK', title: 'Mikrotiks', noun: 'Mikrotik' },
  { kind: 'FMS', title: 'FMS units', noun: 'FMS' },
]

/** What each kind of device carries — a switch has a speed, an FMS has ports, not an address. */
function deviceRows(device) {
  if (device.kind === 'FMS') return [['Ports', device.portCount ? `${device.portCount} port` : null]]
  return [
    ['IP address', device.ipAddress],
    ['Model', device.model],
    ...(device.kind === 'SWITCH' ? [['Speed', device.speed]] : []),
  ]
}

function OltCard({ olt, onOpen }) {
  const used = olt.fibers?.length ?? 0
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line p-3">
      <p className="text-sm font-bold text-ink">{olt.name}</p>
      <FieldList
        rows={[
          ['Type', olt.type],
          ['Model', olt.model],
          ['IP address', olt.ipAddress],
          ['PON ports', `${olt.ponPortCount} · ${used} in use`],
        ]}
      />
      {used > 0 && (
        <div className="flex flex-col">
          {olt.fibers.map((fiber) => (
            <LinkRow
              key={fiber.id}
              color={coreColor(fiber.coreCount)}
              title={fiber.name}
              badge={`port ${fiber.ponPort}`}
              onClick={() => onOpen({ kind: 'fiber', id: fiber.id })}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** One POP in full: the survey sheet, the rack's contents, and the cables at the site. */
export default function PopDetails({ id, canManage, onOpen, onCentre, onEdit }) {
  const { data: pop, loading, error, retry } = useDetail(`/pops/${id}`, 'Could not load this POP')

  if (loading) return <Skeleton />
  if (error) return <LoadError error={error} onRetry={retry} />

  const devicesOf = (kind) => pop.devices.filter((d) => d.kind === kind)

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: POINT_COLORS.POP }}
        >
          <IconTriangle className="h-5 w-5" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-ink">{pop.name}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${CHIP} bg-paper text-muted`}>POP</span>
            {pop.zone && <span className={`${CHIP} bg-paper text-muted`}>{pop.zone.name}</span>}
            <span className={`${CHIP} bg-paper text-muted`}>
              {pop.olts.length} OLT{pop.olts.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {canManage && (
        <Button type="button" variant="secondary" className="h-11 min-h-11" onClick={() => onEdit?.(pop)}>
          <IconEdit className="h-4 w-4" strokeWidth={1.8} />
          Edit POP
        </Button>
      )}

      <Section title="Site">
        <FieldList
          rows={[
            ['Server name', pop.name],
            ['Zone', pop.zone?.name],
            ['Server location', pop.serverLocation],
            ['Rack size', pop.rackSize],
            ['Rack condition', pop.rackCondition ? (RACK_CONDITION_LABELS[pop.rackCondition] ?? pop.rackCondition) : null],
            ['UPS batteries', pop.upsBatteryCount],
            ['Notes', pop.notes],
          ]}
        />
      </Section>

      <LocationBlock latitude={pop.latitude} longitude={pop.longitude} onCentre={onCentre} />

      <Photos images={pop.images} />

      <Section title="OLTs" count={pop.olts.length}>
        {pop.olts.length === 0 && <EmptyLine>No OLTs recorded.</EmptyLine>}
        {pop.olts.map((olt) => (
          <OltCard key={olt.id} olt={olt} onOpen={onOpen} />
        ))}
      </Section>

      {DEVICE_SECTIONS.map(({ kind, title, noun }) => {
        const list = devicesOf(kind)
        return (
          <Section key={kind} title={title} count={list.length}>
            {list.length === 0 && <EmptyLine>None recorded.</EmptyLine>}
            {list.map((device, index) => (
              <div key={device.id} className="flex flex-col gap-2 rounded-card border border-line p-3">
                <p className="text-sm font-bold text-ink">{device.label || `${noun} ${index + 1}`}</p>
                <FieldList rows={deviceRows(device)} />
              </div>
            ))}
          </Section>
        )
      })}

      <Section title="Fibers at this POP" count={pop.fibers.length}>
        {pop.fibers.length === 0 && <EmptyLine>No fiber starts or passes here.</EmptyLine>}
        {pop.fibers.map((fiber) => (
          <LinkRow
            key={fiber.id}
            color={coreColor(fiber.coreCount)}
            title={fiber.name}
            sub={`${fiber.coreCount} core`}
            onClick={() => onOpen({ kind: 'fiber', id: fiber.id })}
          />
        ))}
      </Section>

      <RecordBlock record={pop} />
    </>
  )
}
