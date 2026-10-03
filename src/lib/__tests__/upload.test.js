import { describe, it, expect, vi } from 'vitest'
import { uploadFile } from '../upload'

/**
 * uploadFile hands back the link a page can SHOW right away: the signed
 * previewUrl when the API gives one (the bucket may be private), otherwise the
 * plain url. Saving it is safe — every save path on the API turns a signed
 * link back into the permanent one before storing it.
 */
const pdf = () => new File(['%PDF'], 'letter.pdf', { type: 'application/pdf' }) // not compressed
const client = (data) => ({ post: vi.fn(async () => ({ data: { data } })) })

describe('uploadFile', () => {
  it('returns the signed preview link when the API sends one', async () => {
    const c = client({ url: 'https://pub.r2.dev/a.pdf', previewUrl: 'https://s3/a.pdf?sig=1' })
    expect(await uploadFile(pdf(), c)).toBe('https://s3/a.pdf?sig=1')
  })

  it('falls back to the url from an API that has no previewUrl yet', async () => {
    const c = client({ url: 'https://pub.r2.dev/a.pdf' })
    expect(await uploadFile(pdf(), c)).toBe('https://pub.r2.dev/a.pdf')
  })
})
