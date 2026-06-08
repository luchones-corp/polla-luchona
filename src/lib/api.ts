import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Fixture, Group, GroupMember, MatchPick, Prediction, Standing } from './types'

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
    .select('groups!inner(id, name, owner_id, invite_token)')
    .eq('user_id', user.id)

  if (error) throw error

  return (data ?? []).map((row: any) => row.groups as Group)
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
    .select('id, stage, kickoff_at, status, outcome, home_team_id, away_team_id, home_team:teams!matches_home_team_id_fkey(name, logo_url), away_team:teams!matches_away_team_id_fkey(name, logo_url)')
    .order('kickoff_at', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    stage: row.stage,
    kickoff_at: row.kickoff_at,
    status: row.status,
    outcome: row.outcome,
    home_team_id: row.home_team_id,
    away_team_id: row.away_team_id,
    home_team_name: row.home_team?.name ?? 'Por definir',
    away_team_name: row.away_team?.name ?? 'Por definir',
    home_team_logo: row.home_team?.logo_url ?? null,
    away_team_logo: row.away_team?.logo_url ?? null,
  }))
}

export async function getUserPredictions(userId: string): Promise<Prediction[]> {
  const { data, error } = await supabase
    .from('predictions')
    .select('id, match_id, pick, updated_at')
    .eq('user_id', userId)

  if (error) throw error
  return (data ?? []) as Prediction[]
}

export async function savePrediction(userId: string, matchId: number, pick: MatchPick): Promise<void> {
  const { error } = await supabase
    .from('predictions')
    .upsert({ user_id: userId, match_id: matchId, pick }, { onConflict: 'user_id,match_id' })

  if (error) throw error
}

export async function getStandings(groupId: string): Promise<Standing[]> {
  const { data, error } = await supabase
    .from('group_standings')
    .select('group_id, user_id, display_name, points')
    .eq('group_id', groupId)

  if (error) throw error
  return (data ?? []) as Standing[]
}
