import { describe, expect, it } from 'vitest'
import { rankStandings } from '../ranking'

const base = { group_id: 'g', exact_count: 0, last_correct_at: null }

describe('rankStandings', () => {
  it('assigns the same rank when points are tied', () => {
    const ranked = rankStandings([
      { ...base, user_id: 'a', display_name: 'Ana', points: 5 },
      { ...base, user_id: 'b', display_name: 'Beto', points: 5 },
      { ...base, user_id: 'c', display_name: 'Caro', points: 3 },
    ])

    expect(ranked[0].rank).toBe(1)
    expect(ranked[1].rank).toBe(1)
    expect(ranked[2].rank).toBe(3)
  })

  it('breaks ties by exact_count then last_correct_at', () => {
    const ranked = rankStandings([
      { ...base, user_id: 'a', display_name: 'Ana', points: 5, exact_count: 1 },
      { ...base, user_id: 'b', display_name: 'Beto', points: 5, exact_count: 2 },
      { ...base, user_id: 'c', display_name: 'Caro', points: 5, exact_count: 1, last_correct_at: '2026-06-15T18:00:00Z' },
    ])

    expect(ranked[0].display_name).toBe('Beto')
    expect(ranked[1].display_name).toBe('Caro')
    expect(ranked[2].display_name).toBe('Ana')
  })
})
