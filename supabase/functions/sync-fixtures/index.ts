import { createClient } from 'npm:@supabase/supabase-js@2.49.8'

// ---------------------------------------------------------------------------
// football-data.org v4 — World Cup 2026 sync
// ---------------------------------------------------------------------------

const API_BASE = 'https://api.football-data.org/v4'
const COMPETITION = 'WC'
const DEFAULT_SEASON = '2026'
const MAX_RETRIES = 3

// ---- API types (verified against live responses) --------------------------

type ApiTeam = {
  id: number | null
  name: string
  shortName: string
  tla: string
  crest: string
}

type ApiScoreNode = { home: number | null; away: number | null }

type ApiScore = {
  winner: string | null
  duration: 'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT'
  fullTime: ApiScoreNode
  halfTime: ApiScoreNode
  regularTime?: ApiScoreNode
  extraTime?: ApiScoreNode
  penalties?: ApiScoreNode
}

type ApiMatch = {
  id: number
  utcDate: string
  status: string
  stage: string
  group: string | null
  homeTeam: ApiTeam
  awayTeam: ApiTeam
  score: ApiScore
}

// ---- DB row types ---------------------------------------------------------

type TeamRow = { id: number; name: string; logo_url: string | null }

type MatchRow = {
  id: number
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'
  group_label: string | null
  home_team_id: number | null
  away_team_id: number | null
  kickoff_at: string
  ft_home: number | null
  ft_away: number | null
  outcome: 'HOME' | 'DRAW' | 'AWAY' | null
  status: 'scheduled' | 'live' | 'finished'
}

// ---- Mappers --------------------------------------------------------------

function mapStage(apiStage: string): MatchRow['stage'] {
  switch (apiStage) {
    case 'GROUP_STAGE':     return 'group'
    case 'LAST_32':         return 'r32'
    case 'LAST_16':         return 'r16'
    case 'QUARTER_FINALS':  return 'qf'
    case 'SEMI_FINALS':     return 'sf'
    case 'FINAL':
    case 'THIRD_PLACE':     return 'final'
    default:                return 'group'
  }
}

function mapStatus(apiStatus: string): MatchRow['status'] {
  switch (apiStatus) {
    case 'FINISHED':          return 'finished'
    case 'IN_PLAY':
    case 'PAUSED':
    case 'EXTRA_TIME':
    case 'PENALTY_SHOOTOUT':  return 'live'
    default:                  return 'scheduled'
  }
}

/**
 * Determine the 90-minute score.
 *
 * - duration == REGULAR  → fullTime IS the 90-min result (no ET happened)
 * - duration != REGULAR  → regularTime holds the 90-min score
 *
 * For live matches we store the running fullTime score.
 * For scheduled matches we store nulls.
 */
function getScores(
  score: ApiScore,
  status: MatchRow['status'],
): { ft_home: number | null; ft_away: number | null } {
  if (status === 'scheduled') {
    return { ft_home: null, ft_away: null }
  }

  if (status === 'live' || score.duration === 'REGULAR') {
    return { ft_home: score.fullTime.home, ft_away: score.fullTime.away }
  }

  // Finished + extra time / penalties → use regularTime (the 90-min score)
  return {
    ft_home: score.regularTime?.home ?? null,
    ft_away: score.regularTime?.away ?? null,
  }
}

/**
 * Outcome based on the 90-minute score, set only for finished matches.
 */
function deriveOutcome(
  score: ApiScore,
  status: MatchRow['status'],
): MatchRow['outcome'] {
  if (status !== 'finished') return null

  const { ft_home, ft_away } = getScores(score, status)
  if (ft_home === null || ft_away === null) return null

  if (ft_home > ft_away) return 'HOME'
  if (ft_away > ft_home) return 'AWAY'
  return 'DRAW'
}

// ---- HTTP with throttle-aware retry ---------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type ThrottleInfo = { requestsAvailable: number; resetSeconds: number }

function readThrottleHeaders(headers: Headers): ThrottleInfo {
  return {
    requestsAvailable: parseInt(headers.get('x-requests-available-minute') ?? '10', 10),
    resetSeconds:      parseInt(headers.get('x-requestcounter-reset') ?? '60', 10),
  }
}

async function fetchWithRetry(
  url: string,
  apiKey: string,
): Promise<{ body: unknown; throttle: ThrottleInfo }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Auth-Token': apiKey },
    })

    const throttle = readThrottleHeaders(res.headers)
    console.log(
      `[sync] ${url} → ${res.status}  ` +
      `requests-available: ${throttle.requestsAvailable}, ` +
      `counter-reset: ${throttle.resetSeconds}s`,
    )

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '', 10)
      const waitSeconds = (isNaN(retryAfter) ? throttle.resetSeconds : retryAfter) * Math.pow(2, attempt)
      console.log(`[sync] 429 — backing off ${waitSeconds}s (attempt ${attempt + 1}/${MAX_RETRIES})`)
      lastError = new Error('Rate limited (429)')
      await sleep(waitSeconds * 1000)
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`football-data.org ${res.status}: ${text}`)
    }

    return { body: await res.json(), throttle }
  }

  throw lastError ?? new Error('Max retries exceeded')
}

// ---- Spanish team names ---------------------------------------------------

const teamNameEs: Record<string, string> = {
  'Algeria': 'Argelia',
  'Australia': 'Australia',
  'Austria': 'Austria',
  'Belgium': 'Bélgica',
  'Bosnia-Herzegovina': 'Bosnia-Herzegovina',
  'Brazil': 'Brasil',
  'Canada': 'Canadá',
  'Cape Verde Islands': 'Cabo Verde',
  'Colombia': 'Colombia',
  'Congo DR': 'RD Congo',
  'Croatia': 'Croacia',
  'Curaçao': 'Curazao',
  'Czechia': 'Chequia',
  'Ecuador': 'Ecuador',
  'Egypt': 'Egipto',
  'England': 'Inglaterra',
  'France': 'Francia',
  'Germany': 'Alemania',
  'Ghana': 'Ghana',
  'Haiti': 'Haití',
  'Iran': 'Irán',
  'Iraq': 'Irak',
  'Ivory Coast': 'Costa de Marfil',
  'Japan': 'Japón',
  'Jordan': 'Jordania',
  'Mexico': 'México',
  'Morocco': 'Marruecos',
  'Netherlands': 'Países Bajos',
  'New Zealand': 'Nueva Zelanda',
  'Norway': 'Noruega',
  'Panama': 'Panamá',
  'Paraguay': 'Paraguay',
  'Portugal': 'Portugal',
  'Qatar': 'Catar',
  'Saudi Arabia': 'Arabia Saudita',
  'Scotland': 'Escocia',
  'Senegal': 'Senegal',
  'South Africa': 'Sudáfrica',
  'South Korea': 'Corea del Sur',
  'Spain': 'España',
  'Sweden': 'Suecia',
  'Switzerland': 'Suiza',
  'Tunisia': 'Túnez',
  'Turkey': 'Turquía',
  'United States': 'Estados Unidos',
  'Uruguay': 'Uruguay',
  'Uzbekistan': 'Uzbekistán',
}

function spanishName(name: string): string {
  return teamNameEs[name] ?? name
}

// ---- Transform API response → DB rows ------------------------------------

function toRows(apiMatches: ApiMatch[]) {
  const teamsMap = new Map<number, TeamRow>()
  const matches: MatchRow[] = []

  for (const m of apiMatches) {
    for (const t of [m.homeTeam, m.awayTeam]) {
      if (t.id != null) {
        teamsMap.set(t.id, { id: t.id, name: spanishName(t.name), logo_url: t.crest ?? null })
      }
    }

    let status = mapStatus(m.status)
    const { ft_home, ft_away } = getScores(m.score, status)

    // Don't mark as finished if the API hasn't populated scores yet
    // (football-data.org sometimes returns FINISHED before scores are available)
    if (status === 'finished' && ft_home === null && ft_away === null) {
      status = 'live'
    }

    // Extract group letter from API value like "GROUP_A" → "A"
    const groupLabel = m.group ? m.group.replace('GROUP_', '') : null

    matches.push({
      id:            m.id,
      stage:         mapStage(m.stage),
      group_label:   groupLabel,
      home_team_id:  m.homeTeam.id ?? null,
      away_team_id:  m.awayTeam.id ?? null,
      kickoff_at:    m.utcDate,
      ft_home,
      ft_away,
      outcome:       deriveOutcome(m.score, status),
      status,
    })
  }

  return { teams: [...teamsMap.values()], matches }
}

// ---- Edge Function entry --------------------------------------------------

Deno.serve(async () => {
  try {
    const supabaseUrl   = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const apiKey         = Deno.env.get('APIFOOTBALL_API_KEY')
    const season         = Deno.env.get('APIFOOTBALL_SEASON') ?? DEFAULT_SEASON

    if (!supabaseUrl || !serviceRoleKey || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or APIFOOTBALL_API_KEY' }),
        { status: 500, headers: { 'content-type': 'application/json' } },
      )
    }

    // One call fetches all 104 WC matches
    const url = `${API_BASE}/competitions/${COMPETITION}/matches?season=${season}`
    const { body, throttle } = await fetchWithRetry(url, apiKey)
    const apiMatches = (body as { matches: ApiMatch[] }).matches

    console.log(`[sync] Fetched ${apiMatches.length} matches (requests remaining: ${throttle.requestsAvailable})`)

    const { teams, matches } = toRows(apiMatches)

    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (teams.length > 0) {
      const { error: teamErr } = await supabase
        .from('teams')
        .upsert(teams, { onConflict: 'id' })
      if (teamErr) throw teamErr
    }

    if (matches.length > 0) {
      const { error: matchErr } = await supabase
        .from('matches')
        .upsert(matches, { onConflict: 'id' })
      if (matchErr) throw matchErr
    }

    console.log(`[sync] Upserted ${teams.length} teams, ${matches.length} matches`)

    return new Response(
      JSON.stringify({
        synced: true,
        teams: teams.length,
        matches: matches.length,
        requestsAvailable: throttle.requestsAvailable,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[sync] Error:', message)
    return new Response(
      JSON.stringify({ synced: false, error: message }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }
})
