export type MatchPick = 'HOME' | 'DRAW' | 'AWAY'

export type Group = {
  id: string
  name: string
  owner_id: string
  invite_token: string
}

export type GroupMember = {
  user_id: string
  display_name: string | null
}

export type Fixture = {
  id: number
  stage: string
  kickoff_at: string
  status: 'scheduled' | 'live' | 'finished'
  outcome: MatchPick | null
  home_team_id: number | null
  away_team_id: number | null
  home_team_name: string
  away_team_name: string
}

export type Prediction = {
  id: string
  match_id: number
  pick: MatchPick
  updated_at: string
}

export type Standing = {
  group_id: string
  user_id: string
  display_name: string | null
  points: number
}
