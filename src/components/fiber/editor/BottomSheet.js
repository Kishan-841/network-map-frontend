'use client'

// Below `lg` every card in the editor is the same thing: a sheet that rises
// from the bottom edge, inside the thumb's reach and clear of the top bar.
const SHEET =
  'fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col overflow-y-auto rounded-t-2xl border border-line bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lift'

/** The desktop placement most cards had before: a small card above the mode pill. */
export const SHEET_ANCHORED =
  'lg:absolute lg:inset-x-3 lg:bottom-24 lg:mx-auto lg:max-h-none lg:max-w-sm lg:rounded-card lg:pb-4'

/** A centred dialog at `lg` — for the two that were modals (save form, splitter). */
export const SHEET_DIALOG =
  'lg:left-1/2 lg:right-auto lg:top-1/2 lg:bottom-auto lg:w-full lg:max-w-md lg:max-h-[90dvh] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-card lg:pb-5'

/**
 * Responsive wrapper for the editor's cards and modals: a bottom sheet on a
 * phone, the card's own desktop placement from `lg` up.
 *
 * `desktop` carries the `lg:` overrides (one of the presets above, or a
 * pixel-anchored set built by the caller). `backdrop` adds the dimmer the two
 * dialog-style sheets need.
 */
export default function BottomSheet({
  desktop = SHEET_ANCHORED,
  backdrop = false,
  onBackdropClick,
  style,
  className = '',
  children,
}) {
  return (
    <>
      {backdrop && (
        <div
          className="fixed inset-0 z-30 bg-ink/40"
          onClick={onBackdropClick}
          aria-hidden="true"
        />
      )}
      <div style={style} className={`${SHEET} ${desktop} ${className}`}>
        {children}
      </div>
    </>
  )
}
