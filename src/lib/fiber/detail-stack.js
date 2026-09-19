/**
 * What the detail drawer is showing, and where Back goes.
 *
 * The drawer holds a short history, so following a link inside it (a closure →
 * a fiber through it → the POP that fiber starts at) can be walked back one
 * step at a time. Entries are `{ kind: 'pop' | 'fiber' | 'closure', id }`.
 */
export const DETAIL_KINDS = ['pop', 'fiber', 'closure']

const same = (a, b) => a?.kind === b?.kind && a?.id === b?.id
const valid = (entry) => DETAIL_KINDS.includes(entry?.kind) && Boolean(entry?.id)

/** A fresh click on the map or a table row: start a new history. */
export function openEntry(stack, entry) {
  if (!valid(entry)) return stack
  if (stack.length === 1 && same(stack[0], entry)) return stack
  return [entry]
}

/** A link inside the drawer: one step deeper. Opening what is on top is a no-op. */
export function pushEntry(stack, entry) {
  if (!valid(entry)) return stack
  if (same(stack.at(-1), entry)) return stack
  // Already further back? Go back to it rather than growing a loop.
  const at = stack.findIndex((e) => same(e, entry))
  if (at !== -1) return stack.slice(0, at + 1)
  return [...stack, entry]
}

export const backEntry = (stack) => stack.slice(0, -1)
