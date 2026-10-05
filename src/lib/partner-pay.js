/**
 * How a partner is paid. Agents, society representatives and retail shops
 * only pass a lead on — our sales team converts it — so they earn a flat
 * amount per customer (the server says how much) and the earnings calculator
 * means nothing to them. A DSA works the lead until it converts and is paid
 * from the rate card, so a DSA keeps the calculator. This is the web's one
 * place that knows which partner types are paid flat.
 */
const FLAT_PAY_TYPES = ['AGENT', 'SOCIETY_REPRESENTATIVE', 'RETAIL_SHOP']

export const isFixedPay = (partner) => FLAT_PAY_TYPES.includes(partner?.type)

export const CALCULATOR_HREF = '/partner/calculator'

/** The portal's tabs for this partner — no Calculator for a flat-pay partner. */
export const tabsForPartner = (tabs, partner) =>
  isFixedPay(partner) ? tabs.filter((t) => t.href !== CALCULATOR_HREF) : tabs
