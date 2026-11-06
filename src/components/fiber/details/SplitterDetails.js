'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { invalidateClosures } from '@/hooks/useClosures'
import { invalidateFibers } from '@/hooks/useFibers'
import { FIBER_TYPE_LABELS, POINT_COLORS, RATIO_LABELS } from '@/lib/fiber/constants'
import { Button } from '@/components/ui/Button'
import { IconDiamond, IconEdit } from '@/components/ui/icons'
import SplitterForm from '@/components/fiber/SplitterForm'
import { invalidateSplitters } from '@/hooks/useSplitters'
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

/** One output port: the fiber it feeds (a link), a building, in use but not yours to open, or free. */
function OutputRow({ output, onOpen }) {
  if (output.toFiber) {
    return (
      <LinkRow
        title={`Out ${output.portNo} → ${output.toFiber.name}`}
        sub={output.label}
        onClick={() => onOpen({ kind: 'fiber', id: output.toFiber.id })}
      />
    )
  }
  if (output.toBuilding) return <LinkRow title={`Out ${output.portNo} → ${output.toBuilding.buildingName}`} sub={output.label} />
  if (output.used) return <LinkRow title={`Out ${output.portNo}`} sub={output.label} badge="in use" />
  return <LinkRow title={`Out ${output.portNo}`} sub={output.label} badge="free" />
}

/**
 * One splitter in full: what it is, what feeds it, where it sits (a closure or
 * a fiber line), and every output port. The Splitters page, the map and a
 * closure's splitter cards all open it.
 */
/**
 * The fibers that may feed a splitter: its current input, the line it sits
 * on, and (for one inside a closure) the fibers ending at that closure.
 */
function useFeedOptions(splitter, active) {
  const closureId = splitter?.closure?.id
  const [closureFibers, setClosureFibers] = useState({ id: null, list: [] })
  useEffect(() => {
    if (!active || !closureId) return
    let alive = true
    apiClient
      .get(`/closures/${closureId}`)
      .then((res) => alive && setClosureFibers({ id: closureId, list: res.data.data.fibers ?? [] }))
      .catch(() => alive && setClosureFibers({ id: closureId, list: [] }))
    return () => {
      alive = false
    }
  }, [active, closureId])
  const ending = closureFibers.id === closureId ? closureFibers.list.filter((f) => f.role === 'in') : []
  const byId = new Map()
  for (const f of [splitter?.inputFiber, splitter?.onFiber, ...ending]) {
    if (f?.id) byId.set(f.id, { id: f.id, name: f.name })
  }
  return [...byId.values()]
}

export default function SplitterDetails({ id, canManage, canEditItem, onOpen, onCentre, onDeleted }) {
  const { data: splitter, loading, error, retry, refresh } = useDetail(`/splitters/${id}`, 'Could not load this splitter')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  // Editing ratio / type / feed inside the drawer.
  const [editing, setEditing] = useState(false)
  const feedOptions = useFeedOptions(splitter, editing)

  if (loading) return <Skeleton />
  if (error) return <LoadError error={error} onRetry={retry} />

  const ratio = RATIO_LABELS[splitter.ratio] ?? splitter.ratio

  async function remove() {
    if (!window.confirm(`Delete splitter ${splitter.code} (${ratio})?`)) return
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.delete(`/splitters/${splitter.id}`)
      // Also refreshes the Splitters list (useClosures chains it).
      invalidateClosures()
      invalidateFibers()
      onDeleted?.()
    } catch (err) {
      // e.g. "still feeds a fiber" — the server's safety rule, said plainly.
      setActionError(getApiErrorMessage(err, 'Could not delete this splitter'))
      setBusy(false)
    }
  }

  return (
    <>
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: POINT_COLORS.SPLITTER }}
        >
          <IconDiamond className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="break-words text-xl font-bold text-ink">{splitter.code}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className={`${CHIP} bg-fiber-tint text-fiber`}>{ratio} splitter</span>
            <span className={`${CHIP} bg-paper text-muted`}>
              {splitter.portsUsed} of {splitter.portsTotal} ports used
            </span>
          </div>
        </div>
      </div>

      {canEditItem?.(splitter) && !editing && (
        <Button type="button" variant="secondary" className="h-11 min-h-11" onClick={() => setEditing(true)}>
          <IconEdit className="h-4 w-4" strokeWidth={1.8} />
          Edit splitter
        </Button>
      )}

      {editing && (
        <SplitterForm
          splitter={splitter}
          endingFibers={feedOptions}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false)
            invalidateClosures()
            invalidateSplitters()
            invalidateFibers()
            refresh()
          }}
        />
      )}

      <Section title="Splitter">
        <FieldList
          rows={[
            ['Splitter ID', splitter.code],
            ['Ratio', ratio],
            ['Splitter type', splitter.location],
            ['Fiber type', splitter.fiberType ? (FIBER_TYPE_LABELS[splitter.fiberType] ?? splitter.fiberType) : null],
          ]}
        />
      </Section>

      <Section title="Connections">
        {splitter.inputFiber ? (
          <LinkRow
            title={splitter.inputFiber.name}
            sub="Fed by this fiber"
            onClick={() => onOpen({ kind: 'fiber', id: splitter.inputFiber.id })}
          />
        ) : (
          <EmptyLine>No input fiber recorded.</EmptyLine>
        )}
        {splitter.closure ? (
          <LinkRow
            color={POINT_COLORS.CLOSURE}
            title={splitter.closure.code}
            sub="Inside this closure"
            onClick={() => onOpen({ kind: 'closure', id: splitter.closure.id })}
          />
        ) : splitter.onFiber ? (
          <LinkRow
            title={splitter.onFiber.name}
            sub="Sits on this fiber line"
            onClick={() => onOpen({ kind: 'fiber', id: splitter.onFiber.id })}
          />
        ) : null}
      </Section>

      <Section title="Outputs" count={splitter.outputs.length}>
        {splitter.outputs.length === 0 && <EmptyLine>No output ports.</EmptyLine>}
        {splitter.outputs.map((output) => (
          <OutputRow key={output.portNo} output={output} onOpen={onOpen} />
        ))}
      </Section>

      <LocationBlock latitude={splitter.latitude} longitude={splitter.longitude} onCentre={onCentre} />

      <RecordBlock record={splitter} />

      {canManage && (
        <div className="flex flex-col gap-2">
          {actionError && <p className="rounded-btn bg-bad-tint p-3 text-sm font-medium text-bad">{actionError}</p>}
          <Button type="button" variant="dangerGhost" className="h-11 min-h-11" loading={busy} onClick={remove}>
            Delete splitter
          </Button>
        </div>
      )}
    </>
  )
}
