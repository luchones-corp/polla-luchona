import { describe, expect, it } from 'vitest'
import { rankStandings } from '../ranking'

describe('rankStandings', () => {
  it('assigns the same rank when points are tied', () => {
    const ranked = rankStandings([
      { group_id: 'g', user_id: 'a', display_name: 'Ana', points: 5 },
      { group_id: 'g', user_id: 'b', display_name: 'Beto', points: 5 },
      { group_id: 'g', user_id: 'c', display_name: 'Caro', points: 3 },
    ])

    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(1)
    expect(ranked[2].rank).toBe(3)
  })
})
