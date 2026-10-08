import { describe, it, expect } from 'vitest'
import {
  LINK_METHODS,
  linkMethodLabel,
  emptyWing,
  emptyLink,
  setWingField,
  surveyToForm,
  surveyPayload,
  surveyErrors,
  surveyStatusLabel,
  surveyNotice,
  societyProgress,
  PROGRESS_FILTER_OPTIONS,
  surveyEditMode,
  canMarkLive,
  surveyRemarkField,
} from '@/lib/society-survey'
import { visitKindLabel, changeLabels } from '@/lib/society'

const filledWing = (over = {}) => ({ ...emptyWing(), name: 'A', floors: '10', flatsPerFloor: '4', shafts: '1', ...over })

describe('wing home pass', () => {
  it('defaults to floors × flats per floor while untouched', () => {
    let w = emptyWing()
    w = setWingField(w, 'floors', '10')
    expect(w.homePass).toBe('')
    w = setWingField(w, 'flatsPerFloor', '4')
    expect(w.homePass).toBe('40')
    w = setWingField(w, 'floors', '12')
    expect(w.homePass).toBe('48')
  })
  it('stops following once the user edits it', () => {
    let w = setWingField(setWingField(emptyWing(), 'floors', '10'), 'flatsPerFloor', '4')
    w = setWingField(w, 'homePass', '38')
    expect(w.homePassEdited).toBe(true)
    w = setWingField(w, 'floors', '11')
    expect(w.homePass).toBe('38')
  })
  it('clearing the home pass hands it back to the default', () => {
    let w = setWingField(setWingField(emptyWing(), 'floors', '10'), 'flatsPerFloor', '4')
    w = setWingField(w, 'homePass', '')
    expect(w.homePassEdited).toBe(false)
    expect(w.homePass).toBe('40')
  })
})

describe('survey ↔ form', () => {
  it('starts an empty form when there is no survey', () => {
    const f = surveyToForm(null)
    expect(f.checks).toEqual({ nameOk: true, nameCorrection: '', wingsOk: true, homePassOk: true, note: '' })
    expect(f.wings).toEqual([emptyWing()])
    expect(f.links).toEqual([])
    expect(f.materials).toEqual({})
  })
  it('loads a saved survey as strings, and marks a non-default home pass as edited', () => {
    const f = surveyToForm({
      checks: { nameOk: false, nameCorrection: 'Green Park B', wingsOk: true, homePassOk: false },
      wings: [
        { name: 'A', floors: 10, flatsPerFloor: 4, shafts: 1, homePass: 40 },
        { name: 'B', floors: 5, flatsPerFloor: 2, shafts: 0, homePass: 9 },
      ],
      links: [{ from: 'A', to: 'B', method: 'AERIAL', meters: 30 }, { from: 'B', to: 'A', method: 'TRAY' }],
      materials: { FIBER_4F: 120, FAT_BOX: 0 },
    })
    expect(f.checks).toEqual({ nameOk: false, nameCorrection: 'Green Park B', wingsOk: true, homePassOk: false, note: '' })
    expect(f.wings[0]).toEqual({ name: 'A', floors: '10', flatsPerFloor: '4', shafts: '1', homePass: '40', homePassEdited: false })
    expect(f.wings[1].homePassEdited).toBe(true)
    expect(f.links[1]).toEqual({ from: 'B', to: 'A', method: 'TRAY', meters: '' })
    expect(f.materials).toEqual({ FIBER_4F: '120' })
  })
  it('builds the PUT body: ints, empty rows dropped, zero materials dropped', () => {
    const form = {
      checks: { nameOk: false, nameCorrection: '  Green Park B ', wingsOk: true, homePassOk: true, note: ' ok ' },
      wings: [filledWing(), emptyWing(), filledWing({ name: ' B ', floors: '5', flatsPerFloor: '2', shafts: '', homePass: '' })],
      links: [{ from: 'A', to: 'B', method: 'UNDERGROUND', meters: '25.5' }, emptyLink(), { from: 'B', to: 'A', method: 'TRAY', meters: '' }],
      materials: { FIBER_4F: '120', FAT_BOX: '0', SIDE_L: '', CLOSURE_TIFFIN: '3' },
    }
    expect(surveyPayload(form)).toEqual({
      checks: { nameOk: false, nameCorrection: 'Green Park B', wingsOk: true, homePassOk: true, note: 'ok' },
      wings: [
        { name: 'A', floors: 10, flatsPerFloor: 4, shafts: 1, homePass: 40 },
        { name: 'B', floors: 5, flatsPerFloor: 2, shafts: 0, homePass: 10 },
      ],
      links: [
        { from: 'A', to: 'B', method: 'UNDERGROUND', meters: 25.5 },
        { from: 'B', to: 'A', method: 'TRAY' },
      ],
      materials: { FIBER_4F: 120, CLOSURE_TIFFIN: 3 },
    })
  })
  it('sends no name correction when the name is right, and no empty note', () => {
    const p = surveyPayload({
      checks: { nameOk: true, nameCorrection: 'stale', wingsOk: true, homePassOk: true, note: '  ' },
      wings: [],
      links: [],
      materials: {},
    })
    expect(p.checks).toEqual({ nameOk: true, wingsOk: true, homePassOk: true })
  })
})

describe('validation (mirrors the API)', () => {
  const base = () => ({
    checks: { nameOk: true, nameCorrection: '', wingsOk: true, homePassOk: true, note: '' },
    wings: [filledWing(), filledWing({ name: 'B' })],
    links: [{ from: 'A', to: 'B', method: 'AERIAL', meters: '' }],
    materials: { FIBER_4F: '100' },
  })
  it('passes a good survey, for save and for submit', () => {
    expect(surveyErrors(base()).ok).toBe(true)
    expect(surveyErrors(base(), { submit: true }).ok).toBe(true)
  })
  it('wants unique wing names (case-insensitive) and a name on a filled row', () => {
    const f = base()
    f.wings[1].name = 'a'
    let e = surveyErrors(f)
    expect(e.ok).toBe(false)
    expect(e.wings[1]).toBe('Wing “a” is listed twice')
    f.wings[1].name = ''
    e = surveyErrors(f)
    expect(e.wings[1]).toBe('Give this wing a name')
    f.wings[1].name = 'x'.repeat(21)
    expect(surveyErrors(f).wings[1]).toBe('Wing name: 20 characters at most')
  })
  it('wants whole numbers within range', () => {
    const f = base()
    f.wings[0].floors = '2.5'
    expect(surveyErrors(f).wings[0]).toBe('Floors must be a whole number')
    f.wings[0].floors = '-1'
    expect(surveyErrors(f).wings[0]).toBe('Floors must be a whole number')
    const g = base()
    g.materials.FAT_BOX = '1.5'
    expect(surveyErrors(g).materials.FAT_BOX).toBe('Whole number, 0–100000')
    g.materials.FAT_BOX = '100001'
    expect(surveyErrors(g).materials.FAT_BOX).toBe('Whole number, 0–100000')
  })
  it('links must join two different listed wings', () => {
    const f = base()
    f.links[0].to = 'C'
    expect(surveyErrors(f).links[0]).toBe('Pick both wings from the list')
    f.links[0].to = 'A'
    expect(surveyErrors(f).links[0]).toBe('A link joins two different wings')
    f.links[0] = { from: 'A', to: 'B', method: '', meters: '' }
    expect(surveyErrors(f).links[0]).toBe('Pick how the wings are linked')
    // metres may carry decimals (the API takes 0–100000)
    f.links[0] = { from: 'A', to: 'B', method: 'TRAY', meters: '12.5' }
    expect(surveyErrors(f).links[0]).toBeUndefined()
    f.links[0].meters = 'abc'
    expect(surveyErrors(f).links[0]).toBe('Metres: a number up to 100000')
    f.links[0].meters = '100001'
    expect(surveyErrors(f).links[0]).toBe('Metres: a number up to 100000')
  })
  it('refuses a link listed twice (same wings and method, either direction)', () => {
    const f = base()
    f.links = [
      { from: 'A', to: 'B', method: 'AERIAL', meters: '' },
      { from: 'B', to: 'A', method: 'AERIAL', meters: '10' },
      { from: 'A', to: 'B', method: 'TRAY', meters: '' },
      { from: 'A', to: 'B', method: 'AERIAL', meters: '' },
    ]
    const e = surveyErrors(f)
    expect(e.links[0]).toBeUndefined()
    expect(e.links[1]).toBe('That link is already listed')
    expect(e.links[2]).toBeUndefined()
    expect(e.links[3]).toBe('That link is already listed')
  })
  it('keeps wing numbers within the API caps', () => {
    const f = base()
    f.wings[0].floors = '301'
    expect(surveyErrors(f).wings[0]).toBe('Floors: 300 at most')
    f.wings[0].floors = '10'
    f.wings[0].flatsPerFloor = '201'
    expect(surveyErrors(f).wings[0]).toBe('Flats per floor: 200 at most')
    f.wings[0].flatsPerFloor = '4'
    f.wings[0].shafts = '101'
    expect(surveyErrors(f).wings[0]).toBe('Shafts: 100 at most')
  })
  it('caps wings at 26 and links at 50', () => {
    const f = base()
    f.wings = Array.from({ length: 27 }, (_, i) => filledWing({ name: `W${i}` }))
    f.links = []
    expect(surveyErrors(f).form).toContain('26 wings at most')
  })
  it('to submit: at least one wing and one material', () => {
    const f = base()
    f.wings = [emptyWing()]
    f.links = []
    f.materials = { FIBER_4F: '0' }
    const e = surveyErrors(f, { submit: true })
    expect(e.ok).toBe(false)
    expect(e.form).toEqual(['Add at least one wing', 'Ask for at least one material'])
    // a draft may be saved half-done
    expect(surveyErrors(f).ok).toBe(true)
  })
})

describe('labels', () => {
  it('names link methods', () => {
    expect(LINK_METHODS.map((m) => m.value)).toEqual(['AERIAL', 'UNDERGROUND', 'TRAY'])
    expect(linkMethodLabel('UNDERGROUND')).toBe('Underground')
  })
  it('names survey statuses', () => {
    expect(surveyStatusLabel('DRAFT')).toBe('Draft')
    expect(surveyStatusLabel('SUBMITTED')).toBe('Waiting for admin')
    expect(surveyStatusLabel('APPROVED')).toBe('Materials approved')
    expect(surveyStatusLabel('REJECTED')).toBe('Rejected')
    expect(surveyStatusLabel(null)).toBe('Not started')
  })
  it('names the new history kinds and change keys', () => {
    expect(visitKindLabel('SURVEY_SAVED')).toBe('Survey saved')
    expect(visitKindLabel('SURVEY_SUBMITTED')).toBe('Survey submitted')
    expect(visitKindLabel('SURVEY_EDITED')).toBe('Survey edited')
    expect(visitKindLabel('MATERIALS_APPROVED')).toBe('Materials approved')
    expect(visitKindLabel('MATERIALS_REJECTED')).toBe('Materials rejected')
    expect(visitKindLabel('MARKED_LIVE')).toBe('Marked live')
    expect(changeLabels(['checks', 'wings', 'links', 'materials'])).toEqual(['Checks', 'Wings', 'Wing links', 'Materials'])
  })
})

describe('status box', () => {
  it('says nothing before a survey exists', () => {
    expect(surveyNotice(null, false)).toEqual({ tone: 'muted', title: 'Survey not started', detail: '' })
  })
  it('draft, waiting, rejected with reason, approved with who and when, live', () => {
    expect(surveyNotice({ status: 'DRAFT', updatedAt: '2026-10-08T06:00:00Z' }).title).toBe('Draft — not sent yet')
    // a re-saved rejection is a draft again, and keeps the reason until approval
    expect(surveyNotice({ status: 'DRAFT', updatedAt: '2026-10-08T06:00:00Z', rejectReason: 'Too much' })).toMatchObject({
      reason: 'Too much',
      reasonLabel: 'Rejected before',
    })
    const w = surveyNotice({ status: 'SUBMITTED', submittedAt: '2026-10-08T06:00:00Z', submittedBy: { name: 'Ravi' } })
    expect(w).toEqual({ tone: 'warn', title: 'Waiting for admin', detail: 'Sent by Ravi on 8 Oct 2026' })
    const r = surveyNotice({ status: 'REJECTED', rejectReason: 'Too much fibre', decidedAt: '2026-10-08T06:00:00Z', decidedBy: { name: 'Admin' } })
    expect(r).toEqual({ tone: 'bad', title: 'Rejected', detail: 'Admin · 8 Oct 2026', reason: 'Too much fibre' })
    const a = surveyNotice({ status: 'APPROVED', decidedAt: '2026-10-08T06:00:00Z', decidedBy: { name: 'Admin' } }, false)
    expect(a).toEqual({ tone: 'ok', title: 'Materials approved', detail: 'By Admin on 8 Oct 2026' })
    const l = surveyNotice({ status: 'APPROVED', decidedAt: '2026-10-08T06:00:00Z', decidedBy: { name: 'Admin' } }, true, '2026-10-09T06:00:00Z')
    expect(l).toEqual({ tone: 'ok', title: 'Live', detail: 'Live since 9 Oct 2026 · materials approved by Admin on 8 Oct 2026' })
  })
})

describe('progress chip', () => {
  it('walks the stages', () => {
    expect(societyProgress({})).toMatchObject({ stage: 'NOT_SENT', label: 'Not sent', step: 0 })
    expect(societyProgress({ approval: { status: 'PENDING' } })).toMatchObject({ label: 'Waiting for approval', className: 'bg-warn-tint text-warn', step: 1 })
    expect(societyProgress({ approval: { status: 'REJECTED' } })).toMatchObject({ label: 'Rejected', className: 'bg-bad-tint text-bad', step: 1 })
    expect(societyProgress({ approval: { status: 'APPROVED' } })).toMatchObject({ label: 'Approved · survey pending', step: 2 })
    expect(societyProgress({ approval: { status: 'APPROVED' }, survey: { status: 'DRAFT' } })).toMatchObject({ label: 'Survey draft', step: 2 })
    expect(societyProgress({ approval: { status: 'APPROVED' }, survey: { status: 'SUBMITTED' } })).toMatchObject({ label: 'Survey submitted', className: 'bg-warn-tint text-warn', step: 3 })
    expect(societyProgress({ approval: { status: 'APPROVED' }, survey: { status: 'REJECTED' } })).toMatchObject({ label: 'Materials rejected', className: 'bg-bad-tint text-bad', step: 3 })
    expect(societyProgress({ approval: { status: 'APPROVED' }, survey: { status: 'APPROVED' } })).toMatchObject({ label: 'Materials approved', className: 'bg-ok-tint text-ok', step: 4 })
    expect(societyProgress({ approval: { status: 'APPROVED' }, survey: { status: 'APPROVED' }, isLive: true })).toMatchObject({ label: 'Live', step: 5 })
  })
  it('offers the stage filter', () => {
    expect(PROGRESS_FILTER_OPTIONS.map((o) => o.value)).toEqual([
      'APPROVAL_PENDING', 'APPROVED_NO_SURVEY', 'SURVEY_SUBMITTED', 'MATERIALS_APPROVED', 'LIVE',
    ])
  })
})

describe('who edits the survey', () => {
  it('surveyor until approved, then read-only', () => {
    expect(surveyEditMode('SURVEYOR', null)).toBe('edit')
    expect(surveyEditMode('SURVEYOR', { status: 'DRAFT' })).toBe('edit')
    expect(surveyEditMode('SURVEYOR', { status: 'SUBMITTED' })).toBe('edit')
    expect(surveyEditMode('SURVEYOR', { status: 'REJECTED' })).toBe('edit')
    expect(surveyEditMode('SURVEYOR', { status: 'APPROVED' })).toBe('read')
  })
  it('admin always, with a remark after approval', () => {
    expect(surveyEditMode('ADMIN', { status: 'SUBMITTED' })).toBe('edit')
    expect(surveyEditMode('ADMIN', { status: 'APPROVED' })).toBe('edit-remark')
  })
  it('a live society is read-only for the surveyor (the API answers 409 Already live)', () => {
    expect(surveyEditMode('SURVEYOR', null, true)).toBe('read')
    expect(surveyEditMode('SURVEYOR', { status: 'DRAFT' }, true)).toBe('read')
  })
  it('the admin’s remark is recorded only on a SUBMITTED or APPROVED survey', () => {
    expect(surveyRemarkField('ADMIN', { status: 'APPROVED' })).toBe('required')
    expect(surveyRemarkField('ADMIN', { status: 'SUBMITTED' })).toBe('optional')
    expect(surveyRemarkField('ADMIN', { status: 'DRAFT' })).toBe(null)
    expect(surveyRemarkField('ADMIN', { status: 'REJECTED' })).toBe(null)
    expect(surveyRemarkField('ADMIN', null)).toBe(null)
    expect(surveyRemarkField('SURVEYOR', { status: 'SUBMITTED' })).toBe(null)
  })
  it('everyone else reads', () => {
    expect(surveyEditMode('PERMISSION_EXECUTIVE', { status: 'DRAFT' })).toBe('read')
    expect(surveyEditMode('MANAGER', null)).toBe('read')
  })
  it('mark live: surveyor or admin, approved materials, not yet live', () => {
    expect(canMarkLive('SURVEYOR', { status: 'APPROVED' }, false)).toBe(true)
    expect(canMarkLive('ADMIN', { status: 'APPROVED' }, false)).toBe(true)
    expect(canMarkLive('SURVEYOR', { status: 'APPROVED' }, true)).toBe(false)
    expect(canMarkLive('SURVEYOR', { status: 'SUBMITTED' }, false)).toBe(false)
    expect(canMarkLive('PERMISSION_EXECUTIVE', { status: 'APPROVED' }, false)).toBe(false)
  })
})
