import { useMemo } from 'react'
import { isBeforeKickoff } from '../lib/date'
import type { Fixture, Prediction } from '../lib/types'

export function useNotificationBadge(
  fixtures: Fixture[],
  predictionsByMatch: Record<number, Prediction>,
): number {
  return useMemo(() => {
    const twoHours = 2 * 60 * 60_000
    const now = Date.now()
    return fixtures.filter(f => {
      if (!isBeforeKickoff(f.kickoff_at)) return false
      if (predictionsByMatch[f.id]) return false
      const timeUntil = new Date(f.kickoff_at).getTime() - now
      return timeUntil > 0 && timeUntil <= twoHours
    }).length
  }, [fixtures, predictionsByMatch])
}
