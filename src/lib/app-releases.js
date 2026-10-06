/** Partner app releases — version rules mirror backend/src/lib/semver.js. */
const SEMVER = /^\d+\.\d+\.\d+$/
export const isSemver = (v) => typeof v === 'string' && SEMVER.test(v)
export function compareSemver(a, b) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1
  return 0
}
export const sortReleases = (releases) => [...releases].sort((a, b) => compareSemver(b.version, a.version))

/**
 * PUT a file straight to a presigned storage URL, reporting progress (0–1).
 * XMLHttpRequest, not fetch: fetch has no upload progress. The Content-Type
 * must match what the URL was signed for.
 */
export function putFile(url, file, contentType, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)))
    xhr.onerror = () => reject(new Error('Upload failed — check the connection, and that the storage bucket allows uploads from this site (CORS)'))
    xhr.send(file)
  })
}
