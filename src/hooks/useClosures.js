'use client'

import { createSessionResource } from '@/lib/session-resource'

const useClosuresResource = createSessionResource('/closures')

/** Every saved closure with its splitters — shared by the map, the snap-target list and the admin table. */
export function useClosures() {
  const { data, loading } = useClosuresResource()
  return { closures: data, loading }
}

export const invalidateClosures = () => useClosuresResource.invalidate()
