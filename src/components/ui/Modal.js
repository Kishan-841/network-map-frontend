'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconClose } from '@/components/ui/icons'

/**
 * Centered modal dialog.
 *
 * - Renders into document.body to avoid ancestor stacking contexts.
 * - Uses a high stacking order to appear above page content.
 * - Keeps the header and footer fixed within the dialog.
 * - Scrolls only the modal body when content exceeds viewport height.
 * - Uses an opaque background to prevent underlying content showing through.
 * - Supports click-outside dismissal, wide layouts, and non-dismissable steps.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
  dismissable = true,
}) {
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event) {
      if (event.key === 'Escape' && dismissable) {
        onClose?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose, dismissable])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/50 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (
          dismissable &&
          event.target === event.currentTarget
        ) {
          onClose?.()
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          'relative flex w-full flex-col overflow-hidden',
          'max-h-[calc(100dvh-24px)] sm:max-h-[calc(100dvh-40px)]',
          wide ? 'max-w-3xl' : 'max-w-md',
          'rounded-card border border-line/70 bg-card text-ink shadow-lift',
        ].join(' ')}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line/60 bg-card px-5 py-4">
          <h2 className="min-w-0 break-words text-base font-bold">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-faint transition-colors hover:bg-paper hover:text-ink"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-card px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 border-t border-line/60 bg-card px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}