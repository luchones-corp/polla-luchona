import type { Standing } from './types'

export type RankedStanding = Standing & { rank: number }

export function rankStandings(standings: Standing[]): RankedStanding[] {
  const sorted = [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.exact_count !== a.exact_count) return b.exact_count - a.exact_count
    const aLast = a.last_correct_at ? new Date(a.last_correct_at).getTime() : 0
    const bLast = b.last_correct_at ? new Date(b.last_correct_at).getTime() : 0
    if (bLast !== aLast) return bLast - aLast
    const aName = (a.display_name ?? '').toLowerCase()
    const bName = (b.display_name ?? '').toLowerCase()
    return aName.localeCompare(bName)
  })

  let previousPoints: number | null = null
  let previousRank = 0

  return sorted.map((standing, index) => {
    let rank: number
    if (previousPoints === standing.points) {
      rank = previousRank
    } else {
      rank = index + 1
    }
    previousPoints = standing.points
    previousRank = rank
    return { ...standing, rank }
  })
}
