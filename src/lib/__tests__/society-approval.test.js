import { describe, it, expect } from 'vitest'
import {
  APPROVAL_FILTER_OPTIONS,
  approvalLabel,
  approvalBadge,
  societyChip,
  approvalNotice,
  canDecideApproval,
  isApprovedSociety,
  isSociety,
  canChangeSocietyStatus,
  peCanEdit,
  visitKindLabel,
  historyDetail,
} from '@/lib/society'

describe('approval labels and chips', () => {
  it('offers the three approval filters in order', () => {
    expect(APPROVAL_FILTER_OPTIONS.map((o) => o.value)).toEqual(['PENDING', 'APPROVED', 'REJECTED'])
  })
  it('names each approval state in plain words', () => {
    expect(approvalLabel('PENDING')).toBe('Waiting for approval')
    expect(approvalLabel('APPROVED')).toBe('Approved')
    expect(approvalLabel('REJECTED')).toBe('Rejected')
    expect(approvalLabel(null)).toBe('')
  })
  it('uses the existing warn / ok / bad tints', () => {
    expect(approvalBadge('PENDING')).toBe('bg-warn-tint text-warn')
    expect(approvalBadge('APPROVED')).toBe('bg-ok-tint text-ok')
    expect(approvalBadge('REJECTED')).toBe('bg-bad-tint text-bad')
  })
  it('the chip shows the approval when there is one, else the permission status', () => {
    expect(societyChip({ permissionStatus: 'ACCEPTED', approval: { status: 'PENDING' } })).toEqual({
      label: 'Waiting for approval',
      className: 'bg-warn-tint text-warn',
    })
    expect(societyChip({ permissionStatus: 'ACCEPTED', approval: { status: 'APPROVED' } }).label).toBe('Approved')
    expect(societyChip({ permissionStatus: 'ACCEPTED', approval: { status: 'REJECTED' } }).label).toBe('Rejected')
    // Rejected stays Rejected after the status moves off Accepted (the reason stays visible).
    expect(societyChip({ permissionStatus: 'FOLLOW_UP', approval: { status: 'REJECTED' } }).label).toBe('Rejected')
    expect(societyChip({ permissionStatus: 'FOLLOW_UP', approval: null })).toEqual({
      label: 'Follow up',
      className: 'bg-warn-tint text-warn',
    })
    expect(societyChip({ permissionStatus: null, approval: null })).toEqual({
      label: 'No status',
      className: 'bg-paper text-muted',
    })
  })
})

describe('approval notice (the box at the top of a society)', () => {
  it('is nothing with no approval', () => {
    expect(approvalNotice(null)).toBeNull()
  })
  it('pending: amber, waiting since the submit date', () => {
    const n = approvalNotice({ status: 'PENDING', submittedAt: '2026-10-08T06:00:00Z' })
    expect(n.tone).toBe('warn')
    expect(n.title).toBe('Waiting for admin approval')
    expect(n.detail).toBe('Since 8 Oct 2026')
    expect(n.reason).toBeUndefined()
  })
  it('pending again after a rejection still shows the last reason', () => {
    const n = approvalNotice({ status: 'PENDING', submittedAt: '2026-10-08T06:00:00Z', reason: 'Unsigned' })
    expect(n.reason).toBe('Unsigned')
    expect(n.reasonLabel).toBe('Rejected before')
  })
  it('rejected: red, who/when plus the reason', () => {
    const n = approvalNotice({
      status: 'REJECTED',
      reason: 'Letter is unsigned',
      decidedAt: '2026-10-08T06:00:00Z',
      decidedBy: { id: 'u1', name: 'Asha' },
    })
    expect(n.tone).toBe('bad')
    expect(n.title).toBe('Rejected by admin')
    expect(n.detail).toBe('Asha · 8 Oct 2026')
    expect(n.reason).toBe('Letter is unsigned')
  })
  it('approved: green, by whom, when, and the zone', () => {
    const n = approvalNotice(
      { status: 'APPROVED', decidedAt: '2026-10-08T06:00:00Z', decidedBy: { id: 'u1', name: 'Asha' } },
      { name: 'Baner' },
    )
    expect(n.tone).toBe('ok')
    expect(n.title).toBe('Approved')
    expect(n.detail).toBe('By Asha on 8 Oct 2026 · Zone Baner')
  })
  it('approved with a deleted approver and no zone still reads', () => {
    const n = approvalNotice({ status: 'APPROVED', decidedAt: '2026-10-08T06:00:00Z', decidedBy: null })
    expect(n.detail).toBe('On 8 Oct 2026')
  })
})

describe('who may do what', () => {
  it('only an ADMIN decides, and only while pending', () => {
    expect(canDecideApproval('ADMIN', { status: 'PENDING' })).toBe(true)
    expect(canDecideApproval('ADMIN', { status: 'APPROVED' })).toBe(false)
    expect(canDecideApproval('ADMIN', null)).toBe(false)
    expect(canDecideApproval('PERMISSION_EXECUTIVE', { status: 'PENDING' })).toBe(false)
  })
  it('an approved society keeps its status; only its executive loses Edit', () => {
    const approved = { status: 'APPROVED' }
    expect(isApprovedSociety(approved)).toBe(true)
    expect(canChangeSocietyStatus(approved)).toBe(false)
    expect(canChangeSocietyStatus({ status: 'REJECTED' })).toBe(true)
    expect(canChangeSocietyStatus(null)).toBe(true)
    expect(peCanEdit('PERMISSION_EXECUTIVE', approved)).toBe(false)
    expect(peCanEdit('PERMISSION_EXECUTIVE', { status: 'PENDING' })).toBe(true)
    expect(peCanEdit('PERMISSION_EXECUTIVE', null)).toBe(true)
  })
  it('isSociety reads the building source', () => {
    expect(isSociety({ source: 'PERMISSION' })).toBe(true)
    expect(isSociety({ source: 'COVERAGE' })).toBe(false)
    expect(isSociety(null)).toBe(false)
  })
})

describe('history kinds', () => {
  it('names the approval kinds', () => {
    expect(visitKindLabel('SUBMITTED')).toBe('Sent for approval')
    expect(visitKindLabel('WITHDRAWN')).toBe('Withdrawn')
    expect(visitKindLabel('APPROVED')).toBe('Approved')
    expect(visitKindLabel('REJECTED')).toBe('Rejected')
    expect(visitKindLabel('VISIT')).toBe('Visit')
  })
  it('an approval row names its zone when the API sends one', () => {
    expect(historyDetail({ kind: 'APPROVED', zone: { name: 'Baner' } })).toBe('Zone: Baner')
    expect(historyDetail({ kind: 'APPROVED' })).toBe('')
    // The API's APPROVED row has no zone — the society's zone stands in.
    expect(historyDetail({ kind: 'APPROVED' }, { name: 'Kranti Chowk' })).toBe('Zone: Kranti Chowk')
    expect(historyDetail({ kind: 'VISIT' }, { name: 'Kranti Chowk' })).toBe('')
    expect(historyDetail({ kind: 'REJECTED', remark: 'x' })).toBe('')
  })
})
