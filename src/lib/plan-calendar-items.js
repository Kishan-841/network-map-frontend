/**
 * One day's calendar entries for the planner's detailed calendar: planned
 * tasks and off-plan visits together, in time order — tasks with a window by
 * their start, off-plan visits by when they happened, any-time tasks last.
 * Pure, so the month and week grids stay simple.
 */
const pad = (n) => String(n).padStart(2, '0')

/** 'HH:mm' in India time for an instant. */
const istHHmm = (iso) => {
  const d = new Date(new Date(iso).getTime() + 330 * 60000)
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

export function calendarItems(tasks = [], offPlan = []) {
  const byDay = new Map()
  const add = (day, item) => {
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(item)
  }
  for (const t of tasks ?? []) {
    add(t.taskDate, {
      key: `task:${t.id}`,
      kind: 'task',
      time: t.startTime ?? null,
      sort: t.startTime ?? '99:99',
      name: t.building?.buildingName ?? 'Building',
      status: t.status,
      task: t,
      visitId: t.visit?.id ?? null,
    })
  }
  for (const v of offPlan ?? []) {
    const time = istHHmm(v.visitedAt)
    add(v.day, {
      key: `visit:${v.id}`,
      kind: 'offplan',
      time,
      sort: time,
      name: v.buildingName ?? 'Building',
      status: 'OFF_PLAN',
      visit: v,
      visitId: v.id,
    })
  }
  for (const items of byDay.values()) items.sort((a, b) => a.sort.localeCompare(b.sort))
  return byDay
}
