import type { Fixture, Prediction } from './types'
import { isBeforeKickoff } from './date'
import { computeStreak } from './streaks'

export type Achievement = {
  id: string
  name: string
  description: string
  icon: string
  earned: boolean
  progress?: { current: number; target: number }
}

export function computeAchievements(
  fixtures: Fixture[],
  predictionsByMatch: Record<number, Prediction>,
  t: (key: string) => string,
): Achievement[] {
  const finished = fixtures
    .filter(f => f.status === 'finished' && f.outcome !== null)
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())

  const groupFixtures = fixtures.filter(f => f.stage === 'group')
  const stages = new Set(fixtures.map(f => f.stage))

  const { best: maxStreak } = computeStreak(fixtures, predictionsByMatch)

  // Group stage completeness
  const groupPredicted = groupFixtures.filter(f => !!predictionsByMatch[f.id]).length

  // Perfect match day: all correct on a day with 3+ matches
  const byDay: Record<string, Fixture[]> = {}
  for (const f of finished) {
    const day = new Date(f.kickoff_at).toDateString()
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(f)
  }
  let perfectDay = false
  for (const dayFixtures of Object.values(byDay)) {
    if (dayFixtures.length >= 3) {
      const allCorrect = dayFixtures.every(f => {
        const pick = predictionsByMatch[f.id]?.pick
        return pick && pick === f.outcome
      })
      if (allCorrect) { perfectDay = true; break }
    }
  }

  // Early bird: predicted 24h+ before kickoff
  let earlyBird = false
  for (const f of fixtures) {
    const pred = predictionsByMatch[f.id]
    if (pred) {
      const predTime = new Date(pred.updated_at).getTime()
      const kickTime = new Date(f.kickoff_at).getTime()
      if (kickTime - predTime > 24 * 60 * 60_000) { earlyBird = true; break }
    }
  }

  // Todólogo: predicted at least one match in every stage
  const predictedStages = new Set<string>()
  for (const f of fixtures) {
    if (predictionsByMatch[f.id]) predictedStages.add(f.stage)
  }
  const allStages = [...stages].filter(s => fixtures.some(f => f.stage === s && !isBeforeKickoff(f.kickoff_at)))

  return [
    {
      id: 'streak3',
      name: t('achievements.streak3'),
      description: t('achievements.streak3desc'),
      icon: '🔥',
      earned: maxStreak >= 3,
      progress: { current: Math.min(maxStreak, 3), target: 3 },
    },
    {
      id: 'streak5',
      name: t('achievements.streak5'),
      description: t('achievements.streak5desc'),
      icon: '☄️',
      earned: maxStreak >= 5,
      progress: { current: Math.min(maxStreak, 5), target: 5 },
    },
    {
      id: 'streak10',
      name: t('achievements.streak10'),
      description: t('achievements.streak10desc'),
      icon: '⭐',
      earned: maxStreak >= 10,
      progress: { current: Math.min(maxStreak, 10), target: 10 },
    },
    {
      id: 'group-complete',
      name: t('achievements.groupComplete'),
      description: t('achievements.groupCompleteDesc'),
      icon: '🏆',
      earned: groupPredicted === groupFixtures.length && groupFixtures.length > 0,
      progress: { current: groupPredicted, target: groupFixtures.length },
    },
    {
      id: 'perfect-day',
      name: t('achievements.perfectionist'),
      description: t('achievements.perfectionistDesc'),
      icon: '💎',
      earned: perfectDay,
    },
    {
      id: 'early-bird',
      name: t('achievements.earlyBird'),
      description: t('achievements.earlyBirdDesc'),
      icon: '⏰',
      earned: earlyBird,
    },
    {
      id: 'all-stages',
      name: t('achievements.allRounder'),
      description: t('achievements.allRounderDesc'),
      icon: '🌍',
      earned: allStages.length > 0 && allStages.every(s => predictedStages.has(s)),
      progress: allStages.length > 0 ? { current: allStages.filter(s => predictedStages.has(s)).length, target: allStages.length } : undefined,
    },
  ]
}
