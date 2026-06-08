// @ts-nocheck

import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

type ApiFixture = {
  fixture: {
    id: number
    date: string
    status: { short: string }
  }
  league: {
    round?: string
  }
  teams: {
    home: { id: number | null; name: string | null; logo: string | null }
    away: { id: number | null; name: string | null; logo: string | null }
  }
  score: {
    fulltime: { home: number | null; away: number | null }
  }
}

type TeamRow = { id: number; name: string; logo_url: string | null }
type MatchRow = {
  id: number
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  home_team_id: number | null
  away_team_id: number | null
  kickoff_at: string
  ft_home: number | null
  ft_away: number | null
  outcome: 'HOME' | 'DRAW' | 'AWAY' | null
  status: 'scheduled' | 'live' | 'finished'
}

function mapStage(round?: string): MatchRow['stage'] {
  if (!round) return 'group'
  const normalized = round.toLowerCase()

  if (normalized.includes('group')) return 'group'
  if (normalized.includes('round of 32') || normalized.includes('1/16')) return 'r32'
  if (normalized.includes('round of 16') || normalized.includes('1/8')) return 'r16'
  if (normalized.includes('quarter')) return 'qf'
  if (normalized.includes('semi')) return 'sf'
  if (normalized.includes('final')) return 'final'

  return 'group'
}

function mapStatus(short: string): MatchRow['status'] {
  if (['FT', 'AET', 'PEN'].includes(short)) return 'finished'
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'].includes(short)) return 'live'
  return 'scheduled'
}

function deriveOutcome(
  status: MatchRow['status'],
  ftHome: number | null,
  ftAway: number | null,
): MatchRow['outcome'] {
  if (status !== 'finished' || ftHome === null || ftAway === null) {
    return null
  }
  if (ftHome > ftAway) return 'HOME'
  if (ftAway > ftHome) return 'AWAY'
  return 'DRAW'
}

function getApiHeaders(apiKey: string): HeadersInit {
  const rapidHost = Deno.env.get('APIFOOTBALL_RAPID_HOST')
  if (rapidHost) {
    return {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': rapidHost,
    }
  }
  return {
    'x-apisports-key': apiKey,
  }
}

async function fetchFixtures(apiBaseUrl: string, apiKey: string, season: string, league: string): Promise<ApiFixture[]> {
  const url = `${apiBaseUrl}/fixtures?league=${league}&season=${season}`
  const response = await fetch(url, {
    headers: getApiHeaders(apiKey),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API-Football error ${response.status}: ${text}`)
  }

  const payload = await response.json()
  return payload.response as ApiFixture[]
}

function toRows(fixtures: ApiFixture[]) {
  const teams = new Map<number, TeamRow>()
  const matches: MatchRow[] = []

  for (const fixture of fixtures) {
    const home = fixture.teams.home
    const away = fixture.teams.away

    if (home.id && home.name) {
      teams.set(home.id, {
        id: home.id,
        name: home.name,
        logo_url: home.logo,
      })
    }

    if (away.id && away.name) {
      teams.set(away.id, {
        id: away.id,
        name: away.name,
        logo_url: away.logo,
      })
    }

    const status = mapStatus(fixture.fixture.status.short)
    const ftHome = fixture.score.fulltime.home
    const ftAway = fixture.score.fulltime.away

    matches.push({
      id: fixture.fixture.id,
      stage: mapStage(fixture.league.round),
      home_team_id: home.id,
      away_team_id: away.id,
      kickoff_at: fixture.fixture.date,
      ft_home: ftHome,
      ft_away: ftAway,
      outcome: deriveOutcome(status, ftHome, ftAway),
      status,
    })
  }

  return { teams: [...teams.values()], matches }
}

Deno.serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey = Deno.env.get('APIFOOTBALL_API_KEY')
    const apiBaseUrl = Deno.env.get('APIFOOTBALL_BASE_URL') ?? 'https://v3.football.api-sports.io'
    const season = Deno.env.get('APIFOOTBALL_SEASON') ?? '2026'
    const league = Deno.env.get('APIFOOTBALL_LEAGUE_ID') ?? '1'

    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or APIFOOTBALL_API_KEY' }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }

    const fixtures = await fetchFixtures(apiBaseUrl, apiKey, season, league)
    const { teams, matches } = toRows(fixtures)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (teams.length > 0) {
      const { error: teamError } = await supabase
        .from('teams')
        .upsert(teams, { onConflict: 'id' })

      if (teamError) {
        throw teamError
      }
    }

    if (matches.length > 0) {
      const { error: matchError } = await supabase
        .from('matches')
        .upsert(matches, { onConflict: 'id' })

      if (matchError) {
        throw matchError
      }
    }

    return new Response(
      JSON.stringify({
        synced: true,
        teams: teams.length,
        matches: matches.length,
      }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        synced: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      },
    )
  }
})
