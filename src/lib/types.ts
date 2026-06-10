export type MatchPick = 'HOME' | 'DRAW' | 'AWAY'

export type Group = {
  id: string
  name: string
  owner_id: string
  invite_token: string
  lock_minutes_before: number
}

export type GroupMember = {
  user_id: string
  display_name: string | null
}

export type Fixture = {
  id: number
  stage: string
  group_label: string | null
  kickoff_at: string
  status: 'scheduled' | 'live' | 'finished'
  outcome: MatchPick | null
  home_team_id: number | null
  away_team_id: number | null
  home_team_name: string
  away_team_name: string
  home_team_logo: string | null
  away_team_logo: string | null
  ft_home: number | null
  ft_away: number | null
}

export type Prediction = {
  id: string
  match_id: number
  pick: MatchPick
  score_home: number | null
  score_away: number | null
  updated_at: string
}

export type Standing = {
  group_id: string
  user_id: string
  display_name: string | null
  points: number
  exact_count: number
  last_correct_at: string | null
}

export type LeaderboardSnapshot = {
  user_id: string
  display_name: string | null
  match_id: number
  kickoff_at: string
  cumulative_points: number
}

export type MatchEvent = {
  id: string
  match_id: number
  event_type: 'goal' | 'kickoff' | 'halftime' | 'fulltime' | 'red_card'
  minute: number | null
  description: string
  created_at: string
}

export type GroupPrediction = {
  match_id: number
  user_id: string
  display_name: string | null
  pick: MatchPick
  score_home: number | null
  score_away: number | null
}

export type ReactionSummary = {
  match_id: number
  emoji: string
  count: number
  user_reacted: boolean
}

export type GroupArchive = {
  id: string
  group_id: string
  season: string
  archived_at: string
  final_standings: {
    user_id: string
    display_name: string | null
    points: number
    exact_count: number
  }[]
  stats: {
    total_predictions: number
    total_members: number
  }
}
