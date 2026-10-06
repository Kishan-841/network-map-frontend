'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/auth-store'
import { isSemver, putFile, sortReleases } from '@/lib/app-releases'

/**
 * Partner app releases. Upload a new APK (straight to storage, with
 * progress), and set the oldest version still allowed to run — raising it
 * makes every older app show "Update Required" on next open.
 */
export default function AppReleasesPage() {
  const role = useAuthStore((s) => s.user?.role)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/app-releases')
      .then((res) => !cancelled && setData(res.data.data))
      .catch((err) => !cancelled && setError(getApiErrorMessage(err, 'Could not load app releases')))
    return () => {
      cancelled = true
    }
  }, [tick])

  if (role && role !== 'ADMIN') return <p className="text-sm text-muted">Only an admin can manage app releases.</p>

  const formError = version && !isSemver(version.trim()) ? 'Use a version like 1.2.0' : null

  async function release() {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const v = version.trim()
      const { data: up } = await apiClient.post('/app-releases/upload-url', { version: v })
      setProgress(0)
      await putFile(up.data.uploadUrl, file, up.data.contentType, setProgress)
      await apiClient.post('/app-releases', { version: v, ...(notes.trim() ? { notes: notes.trim() } : {}) })
      setNotice(`Version ${v} released. Raise the minimum below if older apps must update.`)
      setVersion('')
      setNotes('')
      setFile(null)
      setTick((t) => t + 1)
    } catch (err) {
      setError(getApiErrorMessage(err, err?.message ?? 'Could not release this version'))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  async function setMinimum(v) {
    const effect = v === '0.0.0' ? 'Every app version will be allowed to run.' : `Everyone below ${v} must update before they can use the app.`
    if (!window.confirm(effect)) return
    setError(null)
    try {
      await apiClient.put('/app-releases/minimum', { minimumSupportedVersion: v })
      setTick((t) => t + 1)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not change the minimum version'))
    }
  }

  const releases = data ? sortReleases(data.releases) : []

  return (
    <main className="mx-auto max-w-3xl">
      <PageHeader title="App releases" sub="Partner app versions and who must update" backHref="/dashboard" backLabel="Dashboard" />

      {error && <p className="mb-3 rounded-btn bg-bad-tint px-4 py-3 text-sm font-normal text-bad">{error}</p>}
      {notice && <p className="mb-3 rounded-btn bg-ok-tint px-4 py-3 text-sm font-normal text-ok">{notice}</p>}

      <section className="rounded-card bg-card p-5 shadow-soft">
        <h2 className="font-bold">Release a new APK</h2>
        <p className="mt-1 text-sm font-normal text-muted">
          Only for native changes. JavaScript changes go out with <code>eas update</code> and need no APK.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Input id="rel-version" label="Version (as in app.json)" placeholder="1.2.0" value={version} error={formError} onChange={(e) => setVersion(e.target.value)} />
          <Input id="rel-notes" label="What changed (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <input type="file" accept=".apk,application/vnd.android.package-archive" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {progress != null && (
            <div className="h-2 w-full overflow-hidden rounded-full bg-paper">
              <div className="h-full bg-fiber transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <Button onClick={release} loading={busy} disabled={!file || !isSemver(version.trim())}>
            Upload and release
          </Button>
        </div>
      </section>

      <section className="mt-4 rounded-card bg-card p-5 shadow-soft">
        <h2 className="font-bold">Minimum version allowed</h2>
        <p className="mt-1 text-sm font-normal text-muted">
          Apps older than this show &quot;Update Required&quot; and cannot be used until they update. Currently{' '}
          <b>{data?.minimumSupportedVersion ?? '…'}</b>.
        </p>
        <select
          className="mt-3 rounded-btn border border-line bg-card px-3 py-2 text-sm"
          value={data?.minimumSupportedVersion ?? '0.0.0'}
          onChange={(e) => setMinimum(e.target.value)}
        >
          <option value="0.0.0">None — every version may run</option>
          {releases.map((r) => (
            <option key={r.version} value={r.version}>{r.version}</option>
          ))}
        </select>
      </section>

      <section className="mt-4 rounded-card bg-card p-5 shadow-soft">
        <h2 className="font-bold">Releases</h2>
        {releases.length === 0 && <p className="mt-2 text-sm text-muted">No APK released yet.</p>}
        <ul className="mt-2 divide-y divide-line">
          {releases.map((r, i) => (
            <li key={r.version} className="py-3">
              <p className="text-sm font-bold">
                {r.version} {i === 0 && <span className="ml-1 rounded-full bg-ok-tint px-2 py-0.5 text-xs text-ok">latest</span>}
              </p>
              {r.notes && <p className="text-sm text-muted">{r.notes}</p>}
              <p className="text-xs text-faint">
                {r.createdBy?.name ?? 'Unknown'} · {new Date(r.createdAt).toLocaleString('en-IN')}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
