import type { Fixture, Prediction } from './types'

export type StreakInfo = {
  current: number
  best: number
  isHot: boolean
}

export function computeStreak(
  fixtures: Fixture[],
  predictionsByMatch: Record<number, Prediction>,
): StreakInfo {
  const finished = fixtures
    .filter(f => f.status === 'finished' && f.outcome !== null)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())

  let maxStreak = 0
  let streak = 0

  for (const f of finished) {
    const pick = predictionsByMatch[f.id]?.pick
    if (pick && pick === f.outcome) {
      streak++
      maxStreak = Math.max(maxStreak, streak)
    } else if (pick) {
      streak = 0
    }
  }

  return { current: streak, best: maxStreak, isHot: streak >= 3 }
}
