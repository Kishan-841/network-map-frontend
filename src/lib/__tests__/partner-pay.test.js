import { describe, it, expect } from 'vitest'
import { CALCULATOR_HREF, isFixedPay, tabsForPartner } from '../partner-pay'

const TABS = [{ href: '/partner' }, { href: CALCULATOR_HREF }, { href: '/partner/profile' }]

describe('partner pay', () => {
  it('agents, society reps and shops are paid flat; a DSA is paid from the rate card', () => {
    for (const type of ['AGENT', 'SOCIETY_REPRESENTATIVE', 'RETAIL_SHOP']) expect(isFixedPay({ type })).toBe(true)
    expect(isFixedPay({ type: 'DSA' })).toBe(false)
    expect(isFixedPay(null)).toBe(false)
  })
  it('drops the Calculator tab for flat-pay partners only — a DSA keeps it', () => {
    expect(tabsForPartner(TABS, { type: 'RETAIL_SHOP' }).map((t) => t.href)).toEqual(['/partner', '/partner/profile'])
    expect(tabsForPartner(TABS, { type: 'DSA' })).toBe(TABS)
  })
})
