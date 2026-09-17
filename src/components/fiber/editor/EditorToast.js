'use client'

/**
 * The editor's only hint surface: a pill above the bottom action bar that
 * fades out on its own. `toast` comes from useEditorToast; the `key` restarts
 * the animation when a new message replaces a visible one.
 */
export default function EditorToast({ toast }) {
  if (!toast) return null
  return (
    <>
      <style>{`
        @keyframes fiber-toast { 0% { opacity: 0; transform: translateY(6px) }
          8%, 82% { opacity: 1; transform: none } 100% { opacity: 0 } }
        .fiber-toast { animation: fiber-toast 4s ease forwards; }
      `}</style>
      <div
        key={toast.id}
        role="status"
        className="fiber-toast pointer-events-none fixed bottom-20 left-1/2 z-30 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-full bg-ink/85 px-4 py-2 text-center text-sm text-paper shadow-lift lg:bottom-28"
      >
        {toast.text}
      </div>
    </>
  )
}
