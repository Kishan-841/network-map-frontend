'use client'

import { useEffect, useRef } from 'react'
import { popIconUrl, popMarkerData, POP_ICON_ANCHOR, POP_ICON_SIZE } from '@/lib/fiber/pop-markers'

// On top of everything else on the map. The building clusterer stacks its
// bubbles from Marker.MAX_ZINDEX upwards, and the fiber overlay draws its own
// POP square at the same spot when a fiber starts here — a POP is a landmark,
// so it wins both: one marker, never buried under a cluster.
const POP_Z_OFFSET = 100000

/**
 * The POPs layer: one triangle pin per POP. Never clustered — there are
 * few, and a POP is a landmark people navigate by. `pops` is the raw list (or
 * an empty one when the layer is off); the pins are rebuilt when it changes.
 */
export function usePopMarkers({ map, ready, pops, onPopClick }) {
  const onPopClickRef = useRef(onPopClick)
  useEffect(() => {
    onPopClickRef.current = onPopClick
  })

  useEffect(() => {
    if (!map || !ready) return undefined
    const size = new google.maps.Size(POP_ICON_SIZE, POP_ICON_SIZE)
    const icon = {
      url: popIconUrl(),
      scaledSize: size,
      anchor: new google.maps.Point(POP_ICON_ANCHOR.x, POP_ICON_ANCHOR.y),
    }
    const markers = popMarkerData(pops).map((pop) => {
      const marker = new google.maps.Marker({
        map,
        position: pop.position,
        icon,
        title: pop.name, // native hover tooltip
        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + POP_Z_OFFSET,
      })
      marker.addListener('click', () => onPopClickRef.current?.(pop))
      return marker
    })
    return () => markers.forEach((marker) => marker.setMap(null))
  }, [map, ready, pops])
}
