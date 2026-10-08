import { describe, it, expect } from 'vitest'
import {
  materialGroupCounts,
  materialsFilled,
  defaultOpenGroup,
  groupsWithErrors,
  surveyTabCounts,
  surveyTabErrors,
  firstTabWithErrors,
  SURVEY_TABS,
  historyView,
  statusStrip,
} from '@/lib/society-page'
import { surveyErrors, emptyWing, emptyLink } from '@/lib/society-survey'
import { istDate } from '@/lib/society'

const D = '2026-10-08T08:30:00.000Z'
const day = istDate(D)

describe('material counts', () => {
  it('counts filled items per catalogue group, zero for the rest', () => {
    const c = materialGroupCounts({ FIBER_4F: '10', FIBER_12F: '3', FAT_BOX: '2', PVC_PIPE_40: '', PVC_PIPE_25: '0' })
    expect(c.FIBER).toBe(2)
    expect(c.FITTINGS).toBe(1)
    expect(c.PVC_PIPE).toBe(0)
    expect(c.PATCH).toBe(0)
    expect(Object.keys(c)).toHaveLength(9)
  })
  it('ignores blanks, zero, non-numbers and unknown keys', () => {
    expect(materialsFilled({ FIBER_4F: ' 5 ', FIBER_6F: 'abc', NOPE: '9', FDC: 0 })).toBe(1)
    expect(materialsFilled(null)).toBe(0)
  })
})

describe('defaultOpenGroup', () => {
  it('opens the first group that has filled items', () => {
    expect(defaultOpenGroup({ FAT_BOX: '2', PATCH_LC_LC: '1' })).toBe('FITTINGS')
  })
  it('opens Fiber when nothing is filled', () => {
    expect(defaultOpenGroup({})).toBe('FIBER')
    expect(defaultOpenGroup(undefined)).toBe('FIBER')
  })
})

describe('groupsWithErrors', () => {
  it('maps item errors to their groups', () => {
    expect([...groupsWithErrors({ FAT_BOX: 'x', CASSETTE_1X2: 'y' })].sort()).toEqual(['CASSETTE', 'FITTINGS'])
    expect(groupsWithErrors(undefined).size).toBe(0)
  })
})

describe('survey tabs', () => {
  const form = {
    checks: { nameOk: true },
    wings: [
      { ...emptyWing(), name: 'A' },
      { ...emptyWing(), name: ' ' },
      { ...emptyWing(), name: 'B' },
    ],
    links: [{ ...emptyLink(), from: 'x', to: 'y' }, emptyLink()],
    materials: { FIBER_4F: '10', FAT_BOX: '2', FDC: '' },
  }
  it('lists three tabs in order', () => {
    expect(SURVEY_TABS.map((t) => t.key)).toEqual(['checks', 'wings', 'materials'])
  })
  it('counts named wings, non-empty links and filled materials', () => {
    expect(surveyTabCounts(form)).toEqual({ checks: null, wings: 2, links: 1, materials: 2 })
  })
  it('counts no errors when there is no attempt yet', () => {
    expect(surveyTabErrors(null)).toEqual({ checks: 0, wings: 0, materials: 0 })
  })
  it('puts row errors and submit-only rules on the right tab', () => {
    const bad = {
      checks: { nameOk: true },
      wings: [{ ...emptyWing(), floors: '3' }],
      links: [],
      materials: { FAT_BOX: 'x' },
    }
    // an unnamed wing (wings); a bad quantity + "Ask for at least one material" (materials)
    expect(surveyTabErrors(surveyErrors(bad, { submit: true }))).toEqual({ checks: 0, wings: 1, materials: 2 })
    const empty = { checks: { nameOk: true }, wings: [emptyWing()], links: [], materials: {} }
    // "Add at least one wing" → wings; "Ask for at least one material" → materials
    expect(surveyTabErrors(surveyErrors(empty, { submit: true }))).toEqual({ checks: 0, wings: 1, materials: 1 })
  })
  it('stays on the current tab when it has errors, else jumps to the first that does', () => {
    expect(firstTabWithErrors({ checks: 0, wings: 1, materials: 2 }, 'materials')).toBe('materials')
    expect(firstTabWithErrors({ checks: 0, wings: 1, materials: 2 }, 'checks')).toBe('wings')
    expect(firstTabWithErrors({ checks: 0, wings: 0, materials: 0 }, 'checks')).toBe('checks')
  })
})

describe('historyView', () => {
  const visits = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }))
  it('shows the latest three, collapsed', () => {
    const v = historyView(visits, false)
    expect(v.shown.map((x) => x.id)).toEqual(['0', '1', '2'])
    expect(v).toMatchObject({ total: 7, hidden: 4, canToggle: true })
  })
  it('shows all when expanded', () => {
    const v = historyView(visits, true)
    expect(v.shown).toHaveLength(7)
    expect(v).toMatchObject({ hidden: 0, canToggle: true })
  })
  it('has no toggle with three or fewer', () => {
    expect(historyView(visits.slice(0, 3), false)).toMatchObject({ canToggle: false, hidden: 0 })
    expect(historyView(undefined, false)).toMatchObject({ total: 0, shown: [], canToggle: false })
  })
})

describe('statusStrip', () => {
  const approved = { status: 'APPROVED', decidedAt: D, decidedBy: { name: 'Asha' } }
  const base = { zone: { name: 'Baner' }, createdBy: { name: 'Ravi' }, createdAt: D }

  it('puts the whole approved-and-live story on one line', () => {
    const s = statusStrip({
      ...base,
      approval: approved,
      survey: { status: 'APPROVED', decidedAt: D, decidedBy: { name: 'Asha' } },
      isLive: true,
      liveSince: D,
    })
    expect(s.facts).toEqual([
      `Approved by Asha on ${day}`,
      'Zone Baner',
      `Materials approved by Asha on ${day}`,
      `Live since ${day}`,
      `Added by Ravi on ${day}`,
    ])
    expect(s.alerts).toEqual([])
  })

  it('says the survey has not started, and when a draft was saved or sent', () => {
    expect(statusStrip({ ...base, approval: approved, survey: null }).facts).toContain('Survey not started')
    expect(statusStrip({ ...base, approval: approved, survey: { status: 'DRAFT', updatedAt: D } }).facts).toContain(
      `Survey draft saved ${day}`,
    )
    expect(
      statusStrip({
        ...base,
        approval: approved,
        survey: { status: 'SUBMITTED', submittedAt: D, submittedBy: { name: 'Sid' } },
      }).facts,
    ).toContain(`Survey sent by Sid on ${day}`)
  })

  it('keeps waiting-for-approval visible as an amber alert, with an earlier rejection reason', () => {
    const s = statusStrip({
      ...base,
      approval: { status: 'PENDING', submittedAt: D, reason: 'No letter' },
      survey: null,
    })
    expect(s.alerts).toEqual([
      {
        tone: 'warn',
        title: 'Waiting for admin approval',
        detail: `Since ${day}`,
        reason: 'No letter',
        reasonLabel: 'Rejected before',
      },
    ])
    expect(s.facts).toEqual(['Zone Baner', `Added by Ravi on ${day}`])
  })

  it('shows a society rejection in red with its reason', () => {
    const s = statusStrip({
      ...base,
      approval: { status: 'REJECTED', decidedAt: D, decidedBy: { name: 'Asha' }, reason: 'Wrong pin' },
    })
    expect(s.alerts[0]).toMatchObject({ tone: 'bad', title: 'Rejected by admin', reason: 'Wrong pin' })
  })

  it('shows a materials rejection in red, and a re-saved draft keeps the old reason', () => {
    const r = statusStrip({
      ...base,
      approval: approved,
      survey: { status: 'REJECTED', decidedAt: D, decidedBy: { name: 'Asha' }, rejectReason: 'Too much fiber' },
    })
    expect(r.alerts).toEqual([
      {
        tone: 'bad',
        title: 'Materials rejected',
        detail: `Asha · ${day}`,
        reason: 'Too much fiber',
        reasonLabel: 'Reason',
      },
    ])
    const d = statusStrip({
      ...base,
      approval: approved,
      survey: { status: 'DRAFT', updatedAt: D, rejectReason: 'Too much fiber' },
    })
    expect(d.alerts).toEqual([
      {
        tone: 'muted',
        title: 'Materials were rejected before',
        detail: '',
        reason: 'Too much fiber',
        reasonLabel: 'Reason',
      },
    ])
  })

  it('ignores the survey before the society is approved, and copes with missing names', () => {
    const s = statusStrip({ approval: null, survey: { status: 'DRAFT' }, createdAt: D })
    expect(s.facts).toEqual([`Added on ${day}`])
    expect(s.alerts).toEqual([])
    expect(statusStrip({ approval: { status: 'APPROVED', decidedAt: D } }).facts[0]).toBe(`Approved on ${day}`)
  })
})
