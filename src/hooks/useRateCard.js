'use client'

import { useEffect, useState } from 'react'
import { apiClient, getApiErrorMessage } from '@/lib/api-client'

/**
 * The rate card a lead conversion prices itself from — the same source the
 * calculator quotes from. `problem` says why a conversion can't be priced,
 * out loud, rather than leaving the speed choices silently empty (production
 * once had no rate card rows).
 */
export function useRateCard() {
  const [card, setCard] = useState({ rates: [], fixedAmountByType: {}, problem: null })

  useEffect(() => {
    let cancelled = false
    apiClient
      .get('/rate-card')
      .then((res) => {
        if (cancelled) return
        const rates = res.data.data.rates ?? []
        setCard({
          rates,
          // The flat amount per partner type ({ AGENT: 500, … }), for the convert preview.
          fixedAmountByType: res.data.data.fixedAmountByType ?? {},
          problem: rates.length ? null : "The rate card isn't set up yet, so a conversion can't be priced.",
        })
      })
      .catch((err) => {
        if (cancelled) return
        setCard((c) => ({ ...c, problem: getApiErrorMessage(err, "Couldn't load the rate card, so a conversion can't be priced.") }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return card
}
