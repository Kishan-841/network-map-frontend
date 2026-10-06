'use client'

import { createSessionResource } from '@/lib/session-resource'

const useSplittersResource = createSessionResource('/splitters')

/** Every splitter the reader may see — the Splitters page. */
export function useSplitters() {
  const { data, loading } = useSplittersResource()
  return { splitters: data, loading }
}

export const invalidateSplitters = () => useSplittersResource.invalidate()
