/** Bank-details rules — a mirror of backend bank-account.schemas.js. Keep them in step. */
export const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/
export const normalizeAccountNumber = (s) => String(s ?? '').replace(/\s+/g, '')
export const normalizeIfsc = (s) => String(s ?? '').trim().toUpperCase()
export const isAccountNumber = (s) => /^\d{9,18}$/.test(normalizeAccountNumber(s))
export const isIfsc = (s) => IFSC_PATTERN.test(normalizeIfsc(s))

export function bankFormErrors(form) {
  const e = {}
  const len = (s) => String(s ?? '').trim().length
  if (len(form.accountHolderName) < 2) e.accountHolderName = 'Enter the name as printed in the passbook'
  if (!isAccountNumber(form.accountNumber)) e.accountNumber = 'Account number must be 9 to 18 digits'
  else if (normalizeAccountNumber(form.accountNumber) !== normalizeAccountNumber(form.confirmAccountNumber)) {
    e.confirmAccountNumber = 'The two account numbers do not match'
  }
  if (!isIfsc(form.ifsc)) e.ifsc = 'Enter a valid IFSC code, like HDFC0001234'
  if (len(form.branchName) < 2) e.branchName = 'Enter the branch'
  return e
}

export function bankPayload(form) {
  const bankName = String(form.bankName ?? '').trim()
  return {
    accountHolderName: form.accountHolderName.trim(),
    accountNumber: normalizeAccountNumber(form.accountNumber),
    ifsc: normalizeIfsc(form.ifsc),
    branchName: form.branchName.trim(),
    ...(bankName ? { bankName } : {}),
  }
}
