/**
 * Calendar maths for the visit plan, on plain 'YYYY-MM-DD' strings. Days are
 * handled as UTC midnights so the device's own time zone never shifts a day;
 * weeks run Monday–Sunday.
 */
const pad = (n) => String(n).padStart(2, '0')
const toDay = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
const parse = (day) => new Date(`${day}T00:00:00Z`)

/** `day` moved by `n` days. */
export const plusDays = (day, n) => toDay(new Date(parse(day).getTime() + n * 86400000))
const mondayOf = (day) => plusDays(day, -((parse(day).getUTCDay() + 6) % 7))

/** The seven days, Monday first, of the week holding `day`. */
export const weekDays = (day) => Array.from({ length: 7 }, (_, i) => plusDays(mondayOf(day), i))

/** A month as whole weeks (Mon–Sun), padded with the neighbouring months' days. */
export function monthGrid(ym) {
  const first = `${ym}-01`
  const [y, m] = ym.split('-').map(Number)
  const last = toDay(new Date(Date.UTC(y, m, 0)))
  const weeks = []
  for (let start = mondayOf(first); start <= last; start = plusDays(start, 7)) weeks.push(weekDays(start))
  return weeks
}

/** 'YYYY-MM' moved by `n` months. */
export function shiftMonth(ym, n) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`
}

/** Today in India (UTC+05:30, no DST), whatever the device clock zone. */
export const todayIst = () => toDay(new Date(Date.now() + 330 * 60000))
