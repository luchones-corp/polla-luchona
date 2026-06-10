import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Fixture, Group, GroupArchive, GroupMember, GroupPrediction, LeaderboardSnapshot, MatchEvent, MatchPick, Prediction, ReactionSummary, Standing } from './types'

export async function getProfileDisplayName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data.display_name
}

export async function saveDisplayName(userId: string, displayName: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, display_name: displayName.trim() })

  if (error) throw error
}

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function createGroup(name: string): Promise<Group> {
  const { data, error } = await supabase.rpc('create_group', { group_name: name })
  if (error) throw error
  return data as Group
}

export async function getGroupsForUser(user: User): Promise<Group[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('groups!inner(id, name, owner_id, invite_token, lock_minutes_before)')
    .eq('user_id', user.id)

  if (!error) {
    return (data ?? []).map((row: any) => row.groups as Group)
  }

  // Fallback: lock_minutes_before column may not exist yet (migration 010)
  const { data: fallback, error: fallbackError } = await supabase
    .from('group_members')
    .select('groups!inner(id, name, owner_id, invite_token)')
    .eq('user_id', user.id)

  if (fallbackError) throw fallbackError

  return (fallback ?? []).map((row: any) => ({
    ...row.groups,
    lock_minutes_before: 0,
  } as Group))
}

export async function getGroupByInviteToken(token: string): Promise<Pick<Group, 'id' | 'name' | 'owner_id'> | null> {
  const { data, error } = await supabase.rpc('get_group_by_invite_token', { token })
  if (error) throw error
  if (!data || data.length === 0) return null
  return data[0]
}

export async function joinGroupByToken(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('join_group_by_token', { token })
  if (error) throw error
  return data as string
}

export async function regenerateInvite(groupId: string): Promise<string> {
  const { data, error } = await supabase.rpc('regenerate_group_invite_token', { target_group_id: groupId })
  if (error) throw error
  return data as string
}

export async function removeGroupMember(groupId: string, memberId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_group_member', {
    target_group_id: groupId,
    target_member_id: memberId,
  })
  if (error) throw error
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('user_id, profiles!inner(display_name)')
    .eq('group_id', groupId)

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    user_id: row.user_id,
    display_name: row.profiles?.display_name ?? null,
  }))
}

export async function getFixtures(): Promise<Fixture[]> {
  const { data, error } = await supabase
    .from('matches')
    .select('id, stage, group_label, kickoff_at, status, outcome, ft_home, ft_away, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
    .order('kickoff_at', { ascending: true })

  if (!error) {
    return (data ?? []).map((row: any) => ({
      id: row.id,
      stage: row.stage,
      group_label: row.group_label ?? null,
      kickoff_at: row.kickoff_at,
      status: row.status,
      outcome: row.outcome,
      home_team_id: row.home_team_id,
      away_team_id: row.away_team_id,
      home_team_name: row.home_team?.name ?? 'Por definir',
      away_team_name: row.away_team?.name ?? 'Por definir',
      home_team_logo: row.home_team?.logo_url ?? null,
      away_team_logo: row.away_team?.logo_url ?? null,
      ft_home: row.ft_home ?? null,
      ft_away: row.ft_away ?? null,
    }))
  }

  // Fallback: group_label column may not exist yet (migration 012)
  const { data: fallback, error: fallbackError } = await supabase
    .from('matches')
    .select('id, stage, kickoff_at, status, outcome, ft_home, ft_away, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
    .order('kickoff_at', { ascending: true })

  if (fallbackError) throw fallbackError

  return (fallback ?? []).map((row: any) => ({
    id: row.id,
    stage: row.stage,
    group_label: null,
    kickoff_at: row.kickoff_at,
    status: row.status,
    outcome: row.outcome,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    home_team_name: row.home_team?.name ?? 'Por definir',
    away_team_name: row.away_team?.name ?? 'Por definir',
    home_team_logo: row.home_team?.logo_url ?? null,
    away_team_logo: row.away_team?.logo_url ?? null,
    ft_home: row.ft_home ?? null,
    ft_away: row.ft_away ?? null,
  }))
}

export async function getUserPredictions(userId: string): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, match_id, pick, score_home, score_away, updated_at')
    .eq('user_id', userId)

  if (!error) {
    return (data ?? []) as Prediction[]
  }

  // Fallback: score columns may not exist yet (migration 005)
  const { data: fallback, error: fallbackError } = await supabase
    .from('predictions')
    .select('id, match_id, pick, updated_at')
    .eq('user_id', userId)

  if (fallbackError) throw fallbackError
  return (fallback ?? []).map((row: any) => ({
    ...row,
    score_home: null,
    score_away: null,
  } as Prediction))
}

export async function savePrediction(
  userId: string,
  matchId: number,
  pick: MatchPick,
  scoreHome: number | null = null,
  scoreAway: number | null = null,
): Promise<void> {
  const derivedPick = scoreHome !== null && scoreAway !== null
    ? (scoreHome > scoreAway ? 'HOME' : scoreHome < scoreAway ? 'AWAY' : 'DRAW') as MatchPick
    : pick
  const { error } = await supabase
    .from('predictions')
    .upsert(
      { user_id: userId, match_id: matchId, pick: derivedPick, score_home: scoreHome, score_away: scoreAway },
      { onConflict: 'user_id,match_id' },
    )

  if (!error) return

  // Fallback: score columns may not exist yet (migration 005)
  const { error: fallbackError } = await supabase
    .from('predictions')
    .upsert(
      { user_id: userId, match_id: matchId, pick: derivedPick },
      { onConflict: 'user_id,match_id' },
    )

  if (fallbackError) throw fallbackError
}

export async function getGroupPredictions(groupId: string): Promise<GroupPrediction[]> {
  const { data, error } = await supabase.rpc('get_group_predictions', { target_group_id: groupId })
  if (error) throw error
  return (data ?? []) as GroupPrediction[]
}

export async function getStandings(groupId: string): Promise<Standing[]> {
  const { data, error } = await supabase
    .from('group_standings')
    .select('group_id, user_id, display_name, points, exact_count, last_correct_at')
    .eq('group_id', groupId)

  if (!error) {
    return (data ?? []) as Standing[]
  }

  // Fallback: exact_count/last_correct_at may not exist yet (migration 005)
  const { data: fallback, error: fallbackError } = await supabase
    .from('group_standings')
    .select('group_id, user_id, display_name, points')
    .eq('group_id', groupId)

  if (fallbackError) throw fallbackError
  return (fallback ?? []).map((row: any) => ({
    ...row,
    exact_count: 0,
    last_correct_at: null,
  } as Standing))
}

export type GroupMessage = {
  id: string
  group_id: string
  user_id: string
  display_name: string | null
  body: string
  created_at: string
}

export async function getGroupMessages(groupId: string, limit = 50): Promise<GroupMessage[]> {
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, group_id, user_id, body, created_at, profiles!inner(display_name)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    group_id: row.group_id,
    user_id: row.user_id,
    display_name: row.profiles?.display_name ?? null,
    body: row.body,
    created_at: row.created_at,
  })).reverse()
}

export async function sendGroupMessage(groupId: string, userId: string, body: string): Promise<void> {
  const { error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, user_id: userId, body: body.trim() })
  if (error) throw error
}

export async function getUserProfile(userId: string): Promise<{ display_name: string | null; created_at: string }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, created_at')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export async function getPublicUserPredictions(userId: string, groupId: string): Promise<Prediction[]> {
  const { data, error } = await supabase.rpc('get_user_predictions_in_group', {
    target_user_id: userId,
    target_group_id: groupId,
  })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: `public-${row.match_id}`,
    match_id: row.match_id,
    pick: row.pick,
    score_home: row.score_home,
    score_away: row.score_away,
    updated_at: row.updated_at,
  }))
}

export async function getLeaderboardHistory(groupId: string): Promise<LeaderboardSnapshot[]> {
  const { data, error } = await supabase.rpc('get_leaderboard_history', { target_group_id: groupId })
  if (error) return [] // RPC may not exist yet (migration 007)
  return (data ?? []) as LeaderboardSnapshot[]
}

export async function getStageStandings(groupId: string, stage?: string): Promise<Standing[]> {
  const { data, error } = await supabase.rpc('get_stage_standings', {
    target_group_id: groupId,
    target_stage: stage ?? null,
  })
  if (error) throw error
  return (data ?? []) as Standing[]
}

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: userId, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      { onConflict: 'user_id,endpoint' },
    )
  if (error) throw error
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
  if (error) throw error
}

export async function getTodayMatchEvents(): Promise<MatchEvent[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const { data, error } = await supabase
    .from('match_events')
    .select('id, match_id, event_type, minute, description, created_at')
    .gte('created_at', today.toISOString())
    .lt('created_at', tomorrow.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return [] // Table may not exist yet (migration 008)
  return (data ?? []) as MatchEvent[]
}

export async function addGhostPlayer(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('add_ghost_player', { target_group_id: groupId })
  if (error) throw error
}

export async function getGroupArchive(groupId: string, season = '2026'): Promise<GroupArchive | null> {
  const { data, error } = await supabase
    .from('group_archives')
    .select('*')
    .eq('group_id', groupId)
    .eq('season', season)
    .maybeSingle()
  if (error) throw error
  return data as GroupArchive | null
}

export async function createGroupArchive(groupId: string): Promise<void> {
  const { error } = await supabase.rpc('archive_group', { target_group_id: groupId })
  if (error) throw error
}

export async function updateGroupLockMinutes(groupId: string, lockMinutesBefore: number): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .update({ lock_minutes_before: lockMinutesBefore })
    .eq('id', groupId)
  if (error) throw error
}

export async function getGroupReactions(groupId: string): Promise<Record<number, ReactionSummary[]>> {
  const { data, error } = await supabase.rpc('get_group_reactions', { target_group_id: groupId })
  if (error) return {} // RPC may not exist yet (migration 009)
  const map: Record<number, ReactionSummary[]> = {}
  for (const row of (data ?? []) as ReactionSummary[]) {
    if (!map[row.match_id]) map[row.match_id] = []
    map[row.match_id].push(row)
  }
  return map
}

export async function toggleReaction(matchId: number, groupId: string, userId: string, emoji: string): Promise<boolean> {
  // Check if reaction exists
  const { data: existing, error: checkError } = await supabase
    .from('match_reactions')
    .select('id')
    .eq('match_id', matchId)
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (checkError) throw checkError // Table may not exist

  if (existing) {
    const { error } = await supabase
      .from('match_reactions')
      .delete()
      .eq('id', existing.id)
    if (error) throw error
    return false // removed
  } else {
    const { error } = await supabase
      .from('match_reactions')
      .insert({ match_id: matchId, group_id: groupId, user_id: userId, emoji })
    if (error) throw error
    return true // added
  }
}
