'use client'

import { useRef } from 'react'

/**
 * Six cells, not one box.
 *
 * For someone who has never used a web app, the shape of the input is the
 * instruction: six boxes say "six digits" before any label is read. It also
 * removes the two ways a single field goes wrong on a phone — no cursor to
 * lose, and no doubt about how much is left.
 *
 * The current code is read from the CELLS, never from the `value` prop.
 * React state lags a fast typist by a render, and deriving each keystroke
 * from a stale prop silently dropped digits — the DOM is always current.
 */
export function OtpInput({ value, onChange, length = 6, disabled, onComplete }) {
  const refs = useRef([])

  /** What the cells actually hold right now, as a fixed-width array. */
  const readCells = () =>
    Array.from({ length }, (_, i) => {
      const raw = refs.current[i]?.value ?? ''
      return raw.replace(/\D/g, '').slice(-1)
    })

  const commit = (chars, focusAt) => {
    // Trailing gaps are fine; a gap in the middle means the code is not
    // finished, so it must not read as complete.
    const code = chars.join('')
    onChange(code)
    if (focusAt != null) refs.current[Math.min(Math.max(focusAt, 0), length - 1)]?.focus()
    if (chars.every(Boolean)) onComplete?.(code)
  }

  function handleInput(i, raw) {
    const typed = raw.replace(/\D/g, '')
    if (!typed) return
    const chars = readCells()
    // One character replaces this cell; several (a paste into a cell) fill
    // forward from here.
    for (let k = 0; k < typed.length && i + k < length; k++) chars[i + k] = typed[k]
    for (let k = 0; k < length; k++) if (refs.current[k]) refs.current[k].value = chars[k] ?? ''
    commit(chars, i + typed.length)
  }

  function handleKeyDown(i, e) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const chars = readCells()
      // Clear this cell if it has something, otherwise step back and clear
      // that one — what a person expects from a row of boxes.
      const target = chars[i] ? i : Math.max(i - 1, 0)
      chars[target] = ''
      if (refs.current[target]) refs.current[target].value = ''
      commit(chars, target)
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < length - 1) refs.current[i + 1]?.focus()
  }

  return (
    <div
      className="flex justify-between gap-2"
      role="group"
      aria-label={`${length}-digit code`}
      onPaste={(e) => {
        e.preventDefault()
        const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
        const chars = Array.from({ length }, (_, i) => digits[i] ?? '')
        for (let k = 0; k < length; k++) if (refs.current[k]) refs.current[k].value = chars[k]
        commit(chars, digits.length)
      }}
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          id={i === 0 ? 'partner-code' : undefined}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          disabled={disabled}
          defaultValue={value[i] ?? ''}
          onChange={(e) => handleInput(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          className="h-14 w-full min-w-0 rounded-btn border-2 border-line bg-card text-center text-2xl font-bold tabular-nums outline-none transition-colors focus:border-primary disabled:opacity-50"
        />
      ))}
    </div>
  )
}
