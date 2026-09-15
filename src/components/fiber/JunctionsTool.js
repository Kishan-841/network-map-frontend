'use client'

import { useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { usePops } from '@/hooks/usePops'
import { invalidateFibers } from '@/hooks/useFibers'
import { invalidateClosures } from '@/hooks/useClosures'

const RADII = [5, 10, 20]
const SELECT_CLASS =
  'h-11 rounded-btn border border-line bg-card px-3 text-sm text-ink outline-none focus:border-fiber focus:ring-2 focus:ring-fiber/15'

/** Stable identity for a cluster across renders — clusters carry no id of their own. */
const clusterKey = (cluster) =>
  cluster.points
    .map((p) => p.pointId)
    .sort()
    .join('-')

function AttachToPopModal({ pops, busy, error, onClose, onAttach }) {
  const [popId, setPopId] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title="Attach to POP"
      footer={
        <Button
          type="button"
          fullWidth
          disabled={!popId}
          loading={busy}
          onClick={() => onAttach(popId)}
        >
          Attach
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <select
          value={popId}
          onChange={(e) => setPopId(e.target.value)}
          className={`${SELECT_CLASS} w-full`}
        >
          <option value="">Select POP…</option>
          {pops.map((pop) => (
            <option key={pop.id} value={pop.id}>
              {pop.name}
            </option>
          ))}
        </select>
        {error && (
          <p className="rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">{error}</p>
        )}
      </div>
    </Modal>
  )
}

/**
 * Phase-1 routes were migrated one segment per fiber, so several lines meeting
 * at the same pole ended up as loose overlapping endpoints. This finds those
 * piles (spec §2.15) and turns each into one shared closure or POP. Fetches
 * on button press only — never polls.
 */
export default function JunctionsTool({ onMerged }) {
  const { pops } = usePops()
  const [radius, setRadius] = useState(10)
  const [clusters, setClusters] = useState(null) // null = not searched yet
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [toast, setToast] = useState(null)
  const [busyKey, setBusyKey] = useState(null)
  const [clusterErrors, setClusterErrors] = useState({})
  const [popModalCluster, setPopModalCluster] = useState(null)

  async function find() {
    setLoading(true)
    setSearchError(null)
    setToast(null)
    try {
      const res = await apiClient.get('/fibers/junctions', { params: { radius } })
      setClusters(res.data.data)
    } catch (err) {
      setClusters(null)
      setSearchError(getApiErrorMessage(err, 'Could not search for junctions'))
    } finally {
      setLoading(false)
    }
  }

  async function merge(cluster, body) {
    const key = clusterKey(cluster)
    setBusyKey(key)
    setClusterErrors((prev) => ({ ...prev, [key]: null }))
    try {
      const res = await apiClient.post('/fibers/merge-points', {
        pointIds: cluster.points.map((p) => p.pointId),
        ...body,
      })
      const { entity, fibers } = res.data.data
      const fiberNames = fibers.map((f) => f.name).join(', ')
      setToast(
        entity.type === 'CLOSURE'
          ? `Created ${entity.code} across ${fiberNames}`
          : `Attached to ${entity.name} across ${fiberNames}`,
      )
      setClusters((prev) => prev.filter((c) => clusterKey(c) !== key))
      setPopModalCluster(null)
      invalidateFibers()
      invalidateClosures()
      onMerged?.()
    } catch (err) {
      setClusterErrors((prev) => ({
        ...prev,
        [key]: getApiErrorMessage(err, 'Could not merge these points'),
      }))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Find junctions</h2>
      <p className="mt-1 text-sm font-normal text-muted">
        Group loose endpoints from the phase-1 migration that sit on top of each other into one
        shared closure or POP.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Button type="button" variant="secondary" loading={loading} onClick={find}>
          Find junctions
        </Button>
        <select
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          aria-label="Search radius"
          className={SELECT_CLASS}
        >
          {RADII.map((r) => (
            <option key={r} value={r}>
              {r} m
            </option>
          ))}
        </select>
      </div>

      {searchError && (
        <p className="mt-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">
          {searchError}
        </p>
      )}
      {toast && (
        <p className="mt-3 rounded-btn bg-ok-tint px-4 py-3 text-sm font-normal text-ok">{toast}</p>
      )}

      {clusters?.length === 0 && (
        <p className="mt-3 text-sm font-normal text-muted">No junctions found within {radius} m.</p>
      )}

      {clusters?.length > 0 && (
        <div className="mt-3 flex flex-col gap-3">
          {clusters.map((cluster) => {
            const key = clusterKey(cluster)
            const fiberNames = [...new Set(cluster.points.map((p) => p.fiberName))]
            const busy = busyKey === key
            return (
              <div key={key} className="rounded-card border border-line bg-card p-4 shadow-soft">
                <p className="font-bold">
                  {cluster.points.length} endpoints within {radius} m
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {fiberNames.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-paper px-2.5 py-1 text-xs font-medium text-muted"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-mono text-xs text-faint">
                  {cluster.centre.latitude.toFixed(6)}, {cluster.centre.longitude.toFixed(6)}
                </p>
                {clusterErrors[key] && (
                  <p className="mt-2 rounded-btn bg-bad-tint px-3 py-2 text-sm font-normal text-bad">
                    {clusterErrors[key]}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    loading={busy}
                    onClick={() => merge(cluster, { type: 'CLOSURE' })}
                  >
                    Make closure
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => setPopModalCluster(cluster)}
                  >
                    Attach to POP…
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {popModalCluster && (
        <AttachToPopModal
          pops={pops}
          busy={busyKey === clusterKey(popModalCluster)}
          error={clusterErrors[clusterKey(popModalCluster)]}
          onClose={() => setPopModalCluster(null)}
          onAttach={(popId) => merge(popModalCluster, { type: 'POP', popId })}
        />
      )}
    </section>
  )
}
