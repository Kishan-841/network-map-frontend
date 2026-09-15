'use client'

/** The one-line hint under the map. `tone` turns it into a nudge. */
export default function EditorHintBar({ hint, tone = 'muted' }) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-3 right-16 z-10 flex items-center justify-center gap-2 sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
      <p
        className={`rounded-2xl border px-4 py-1.5 text-center text-xs shadow sm:rounded-full ${
          tone === 'warn'
            ? 'border-fiber bg-fiber text-white'
            : 'border-line bg-card/90 text-muted'
        }`}
      >
        {hint}
      </p>
    </div>
  )
}
