'use client'

import { useEffect, useRef } from 'react'
import { MarkerClusterer } from '@googlemaps/markerclusterer'
import {
  popClusterRenderer,
  popIconUrl,
  popMarkerData,
  POP_ICON_ANCHOR,
  POP_ICON_SIZE,
} from '@/lib/fiber/pop-markers'

// On top of everything else on the map. The building clusterer stacks its
// bubbles from Marker.MAX_ZINDEX upwards, and the fiber overlay draws its own
// POP square at the same spot when a fiber starts here — a POP is a landmark,
// so it wins both: one marker, never buried under a cluster.
const POP_Z_OFFSET = 100000

/**
 * The POPs layer: one triangle pin per POP. On the map the pins cluster into a
 * count bubble when they would overlap (like the building layer) and spread out
 * as you zoom in; in the editor (`clickable = false`) they stay individual, so
 * a cluster's zoom-on-click never steals a drawing tap. `pops` is the raw list
 * (or empty when the layer is off); the pins rebuild when it changes.
 */
export function usePopMarkers({ map, ready, pops, onPopClick, clickable = true }) {
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
        position: pop.position,
        icon,
        title: pop.name, // native hover tooltip
        zIndex: Number(google.maps.Marker.MAX_ZINDEX) + POP_Z_OFFSET,
        // In the editor the map surface is a drawing canvas: a pin must not
        // swallow the tap that adds the next point.
        clickable,
      })
      if (clickable) marker.addListener('click', () => onPopClickRef.current?.(pop))
      return marker
    })

    if (clickable) {
      // The clusterer owns the markers' map — it shows a count bubble when they
      // overlap and the individual pins as you zoom in.
      const clusterer = new MarkerClusterer({ map, markers, renderer: popClusterRenderer })
      return () => {
        clusterer.clearMarkers()
        markers.forEach((marker) => marker.setMap(null))
      }
    }
    markers.forEach((marker) => marker.setMap(map))
    return () => markers.forEach((marker) => marker.setMap(null))
  }, [map, ready, pops, clickable])
}
