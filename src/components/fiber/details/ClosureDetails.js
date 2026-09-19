'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { invalidateClosures } from '@/hooks/useClosures'
import { invalidateFibers } from '@/hooks/useFibers'
import {
  closureKindLabel,
  coreColor,
  FIBER_TYPE_LABELS,
  fiberTypeLabel,
  POINT_COLORS,
  RATIO_LABELS,
} from '@/lib/fiber/constants'
import { Button } from '@/components/ui/Button'
import { IconCircleDot, IconTrash } from '@/components/ui/icons'
import SplitterForm from '@/components/fiber/SplitterForm'
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

const ROLE_LABEL = { in: 'ends here', out: 'starts here', through: 'passes through' }

function OutputRow({ output, onOpen }) {
  if (output.toFiber) {
    return (
      <LinkRow
        title={`Out ${output.portNo} → ${output.toFiber.name}`}
        onClick={() => onOpen({ kind: 'fiber', id: output.toFiber.id })}
      />
    )
  }
  if (output.toBuilding) return <LinkRow title={`Out ${output.portNo} → ${output.toBuilding.buildingName}`} />
  return <LinkRow title={`Out ${output.portNo}`} badge="free" />
}

function SplitterCard({ splitter, fiberById, canManage, busy, onOpen, onDelete }) {
  // An input that is not among this closure's own fibers is a data oddity —
  // worth saying so rather than pretending there is no input.
  const feed = !splitter.inputFiberId
    ? 'No input yet'
    : fiberById.has(splitter.inputFiberId)
      ? fiberById.get(splitter.inputFiberId).name
      : 'A fiber not on this closure'
  return (
    <div className="flex flex-col gap-2 rounded-card border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-bold text-ink">
          {splitter.code ?? 'Splitter'} · {RATIO_LABELS[splitter.ratio] ?? splitter.ratio}
        </p>
        {canManage && (
          <button
            type="button"
            aria-label={`Delete splitter ${splitter.code ?? ''}`}
            disabled={busy}
            onClick={() => onDelete(splitter)}
            className="-mr-1 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-btn text-faint transition-colors hover:bg-bad-tint hover:text-bad disabled:opacity-50"
          >
            <IconTrash className="h-4 w-4" />
          </button>
        )}
      </div>
      <FieldList
        rows={[
          ['Ratio', RATIO_LABELS[splitter.ratio] ?? splitter.ratio],
          ['Splitter type', splitter.location],
          ['Fiber type', splitter.fiberType ? (FIBER_TYPE_LABELS[splitter.fiberType] ?? splitter.fiberType) : null],
          ['Fed by', feed],
        ]}
      />
      <div className="flex flex-col">
        {splitter.outputs.map((output) => (
          <OutputRow key={output.portNo} output={output} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

/** One closure in full: the closure sheet, the fibers through it, and its splitters. */
export default function ClosureDetails({ id, canManage, onOpen, onCentre }) {
  const { data: closure, loading, error, retry, refresh } = useDetail(
    `/closures/${id}`,
    'Could not load this closure',
  )
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  if (loading) return <Skeleton />
  if (error) return <LoadError error={error} onRetry={retry} />

  const changed = () => {
    invalidateClosures()
    invalidateFibers()
    refresh()
  }

  const deleteSplitter = async (splitter) => {
    const label = RATIO_LABELS[splitter.ratio] ?? splitter.ratio
    if (!window.confirm(`Delete this ${label} splitter?`)) return
    setBusyId(splitter.id)
    setActionError(null)
    try {
      await apiClient.delete(`/splitters/${splitter.id}`)
      changed()
    } catch (err) {
      setActionError(getApiErrorMessage(err, 'Could not delete this splitter'))
    } finally {
      setBusyId(null)
    }
  }

  const fiberById = new Map(closure.fibers.map((f) => [f.id, f]))
  const endingFibers = closure.fibers.filter((f) => f.role === 'in').map((f) => ({ id: f.id, name: f.name }))

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: POINT_COLORS.CLOSURE }}
        >
          <IconCircleDot className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-ink">{closure.code}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${CHIP} bg-fiber-tint text-fiber`}>
              {closureKindLabel(closure.kind) ?? 'Closure'}
            </span>
            <span className={`${CHIP} bg-paper text-muted`}>
              {closure.fibers.length} fiber{closure.fibers.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <Section title="Closure sheet">
        <FieldList
          rows={[
            ['Closure ID', closure.code],
            ['Kind', closureKindLabel(closure.kind)],
            ['Fiber type', fiberTypeLabel(closure.fiberType)],
            ['Tubes', closure.tubeCount],
            ['Core in', closure.inCoreCount != null ? `${closure.inCoreCount} core` : null],
            ['Core out', closure.outCoreCount != null ? `${closure.outCoreCount} core` : null],
            ['Building', closure.building?.buildingName],
            ['Notes', closure.notes],
          ]}
        />
      </Section>

      <LocationBlock latitude={closure.latitude} longitude={closure.longitude} onCentre={onCentre} />

      <Section title="Fibers" count={closure.fibers.length}>
        {closure.fibers.length === 0 && <EmptyLine>No fibers here.</EmptyLine>}
        {closure.fibers.map((fiber) => (
          <LinkRow
            key={fiber.id}
            color={coreColor(fiber.coreCount)}
            title={fiber.name}
            sub={`${fiber.coreCount} core`}
            badge={ROLE_LABEL[fiber.role] ?? fiber.role}
            onClick={() => onOpen({ kind: 'fiber', id: fiber.id })}
          />
        ))}
      </Section>

      <Section title="Splitters" count={closure.splitters.length}>
        {closure.splitters.length === 0 && <EmptyLine>No splitters on this closure.</EmptyLine>}
        {closure.splitters.map((splitter) => (
          <SplitterCard
            key={splitter.id}
            splitter={splitter}
            fiberById={fiberById}
            canManage={canManage}
            busy={busyId === splitter.id}
            onOpen={onOpen}
            onDelete={deleteSplitter}
          />
        ))}
        {actionError && <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{actionError}</p>}
        {canManage && !showForm && (
          <Button type="button" variant="secondary" className="h-11 min-h-11" onClick={() => setShowForm(true)}>
            Add splitter
          </Button>
        )}
        {canManage && showForm && (
          <SplitterForm
            closureId={id}
            endingFibers={endingFibers}
            onSaved={() => {
              setShowForm(false)
              changed()
            }}
            onCancel={() => setShowForm(false)}
          />
        )}
      </Section>

      <RecordBlock record={closure} />
    </>
  )
}
