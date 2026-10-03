import { describe, it, expect } from 'vitest'
import { bankFormErrors, bankPayload, isIfsc, normalizeAccountNumber, normalizeIfsc } from '../bank'

const good = { accountHolderName: 'Asha Patil', accountNumber: '0012 3456 7890', confirmAccountNumber: '001234567890', ifsc: 'hdfc0001234', branchName: 'Cidco', bankName: '' }

describe('bank form', () => {
  it('normalises like the server', () => {
    expect(normalizeAccountNumber(' 0012 3456 7890 ')).toBe('001234567890')
    expect(normalizeIfsc(' hdfc0001234 ')).toBe('HDFC0001234')
    expect(isIfsc('HDFC0001234')).toBe(true)
    expect(isIfsc('HDFC1001234')).toBe(false)
  })
  it('passes a good form', () => expect(bankFormErrors(good)).toEqual({}))
  it('flags a mismatch, short number, bad IFSC, blank name/branch', () => {
    expect(bankFormErrors({ ...good, confirmAccountNumber: '001234567891' }).confirmAccountNumber).toBeTruthy()
    expect(bankFormErrors({ ...good, accountNumber: '12345678', confirmAccountNumber: '12345678' }).accountNumber).toBeTruthy()
    expect(bankFormErrors({ ...good, ifsc: 'HDFC1' }).ifsc).toBeTruthy()
    expect(bankFormErrors({ ...good, accountHolderName: ' ' }).accountHolderName).toBeTruthy()
    expect(bankFormErrors({ ...good, branchName: '' }).branchName).toBeTruthy()
  })
  it('builds the payload the API takes (no confirm field)', () => {
    expect(bankPayload(good)).toEqual({ accountHolderName: 'Asha Patil', accountNumber: '001234567890', ifsc: 'HDFC0001234', branchName: 'Cidco' })
  })
})
