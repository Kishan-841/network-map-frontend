'use client'

import { createSessionResource } from '@/lib/session-resource'
import { invalidateSplitters } from './useSplitters'

const useClosuresResource = createSessionResource('/closures')

/** Every saved closure with its splitters — shared by the map, the snap-target list and the admin table. */
export function useClosures() {
  const { data, loading } = useClosuresResource()
  return { closures: data, loading }
}

// Every splitter change (add/delete in a closure, a line splitter saved with a
// fiber) already invalidates closures, so the Splitters list refreshes with it.
export const invalidateClosures = () => {
  useClosuresResource.invalidate()
  invalidateSplitters()
}
