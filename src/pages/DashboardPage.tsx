import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  createGroup,
  getFixtures,
  getGroupMembers,
  getGroupsForUser,
  getStandings,
  getUserPredictions,
  regenerateInvite,
  removeGroupMember,
  savePrediction,
  signOut,
} from '../lib/api'
import { formatLocalKickoff, isBeforeKickoff } from '../lib/date'
import { rankStandings } from '../lib/ranking'
import type { Fixture, Group, GroupMember, MatchPick, Prediction, Standing } from '../lib/types'

type DashboardPageProps = {
  session: Session
  displayName: string
}

const picks: MatchPick[] = ['HOME', 'DRAW', 'AWAY']

export function DashboardPage({ session, displayName }: DashboardPageProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<number, Prediction>>({})
  const [members, setMembers] = useState<GroupMember[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? null,
    [groups, selectedGroupId],
  )

  const rankedStandings = useMemo(() => rankStandings(standings), [standings])

  const allMatchesFinished = useMemo(
    () => fixtures.length > 0 && fixtures.every((fixture) => fixture.status === 'finished'),
    [fixtures],
  )

  async function reloadBaseData() {
    setLoading(true)
    setError(null)
    try {
      const [nextGroups, nextFixtures, nextPredictions] = await Promise.all([
        getGroupsForUser(session.user),
        getFixtures(),
        getUserPredictions(session.user.id),
      ])

      const predictionMap = nextPredictions.reduce<Record<number, Prediction>>((accumulator, prediction) => {
        accumulator[prediction.match_id] = prediction
        return accumulator
      }, {})

      setGroups(nextGroups)
      setFixtures(nextFixtures)
      setPredictionsByMatch(predictionMap)

      const fallbackGroupId = selectedGroupId && nextGroups.some((group) => group.id === selectedGroupId)
        ? selectedGroupId
        : nextGroups[0]?.id ?? null

      setSelectedGroupId(fallbackGroupId)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo cargar el dashboard'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadBaseData()
    const timer = window.setInterval(() => {
      void reloadBaseData()
    }, 30_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [session.user.id])

  useEffect(() => {
    if (!selectedGroupId) {
      setMembers([])
      setStandings([])
      return
    }

    const groupId = selectedGroupId

    let mounted = true

    async function loadGroupData() {
      try {
        const [nextMembers, nextStandings] = await Promise.all([
          getGroupMembers(groupId),
          getStandings(groupId),
        ])

        if (!mounted) return
        setMembers(nextMembers)
        setStandings(nextStandings)
      } catch (caughtError) {
        if (!mounted) return
        const message = caughtError instanceof Error ? caughtError.message : 'No se pudo cargar el grupo'
        setError(message)
      }
    }

    void loadGroupData()

    return () => {
      mounted = false
    }
  }, [selectedGroupId])

  async function handleCreateGroup(event: FormEvent) {
    event.preventDefault()
    const groupName = newGroupName.trim()
    if (!groupName) return

    setError(null)

    try {
      const created = await createGroup(groupName)
      setNewGroupName('')
      await reloadBaseData()
      setSelectedGroupId(created.id)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo crear el grupo'
      setError(message)
    }
  }

  async function handlePick(matchId: number, pick: MatchPick) {
    setError(null)
    try {
      await savePrediction(session.user.id, matchId, pick)
      const prediction = predictionsByMatch[matchId]
      setPredictionsByMatch((current) => ({
        ...current,
        [matchId]: {
          id: prediction?.id ?? `local-${matchId}`,
          match_id: matchId,
          pick,
          updated_at: new Date().toISOString(),
        },
      }))
      if (selectedGroupId) {
        const refreshedStandings = await getStandings(selectedGroupId)
        setStandings(refreshedStandings)
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo guardar tu predicción'
      setError(message)
    }
  }

  async function handleRegenerateInvite() {
    if (!selectedGroup) return

    setError(null)
    try {
      await regenerateInvite(selectedGroup.id)
      await reloadBaseData()
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo regenerar el enlace'
      setError(message)
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!selectedGroup) return

    setError(null)
    try {
      await removeGroupMember(selectedGroup.id, memberId)
      const nextMembers = await getGroupMembers(selectedGroup.id)
      setMembers(nextMembers)
      const nextStandings = await getStandings(selectedGroup.id)
      setStandings(nextStandings)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo remover al miembro'
      setError(message)
    }
  }

  const isOwner = selectedGroup?.owner_id === session.user.id

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>World Cup 2026 Pool</h1>
          <p>Hola, {displayName}</p>
        </div>
        <button className="ghost" onClick={() => void signOut()}>Cerrar sesión</button>
      </header>

      {error && <p className="error card">{error}</p>}

      <section className="layout-grid">
        <aside className="card">
          <h2>Grupos</h2>

          <form onSubmit={handleCreateGroup} className="stack-sm">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              placeholder="Nombre del grupo"
              required
            />
            <button type="submit">Crear grupo</button>
          </form>

          <div className="stack-sm">
            {groups.map((group) => (
              <button
                key={group.id}
                className={group.id === selectedGroupId ? 'active' : ''}
                onClick={() => setSelectedGroupId(group.id)}
              >
                {group.name}
              </button>
            ))}
            {!groups.length && !loading && <p>Aún no perteneces a grupos.</p>}
          </div>

          {selectedGroup && (
            <div className="stack-sm top-divider">
              <h3>Invitación</h3>
              <p className="small-text">Comparte este enlace:</p>
              <code>{`${window.location.origin}/join/${selectedGroup.invite_token}`}</code>
              <button
                className="ghost"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/join/${selectedGroup.invite_token}`)}
              >
                Copiar enlace
              </button>
              {isOwner && (
                <button className="ghost" onClick={() => void handleRegenerateInvite()}>
                  Regenerar enlace
                </button>
              )}
            </div>
          )}

          {selectedGroup && (
            <div className="stack-sm top-divider">
              <h3>Miembros</h3>
              {members.map((member) => (
                <div key={member.user_id} className="member-row">
                  <span>{member.display_name ?? 'Sin nombre'}</span>
                  {isOwner && member.user_id !== session.user.id && (
                    <button className="danger" onClick={() => void handleRemoveMember(member.user_id)}>
                      Quitar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>

        <section className="card">
          <h2>Fixtures y predicciones</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Partido</th>
                  <th>Kickoff (local)</th>
                  <th>Estado</th>
                  <th>Tu pick</th>
                </tr>
              </thead>
              <tbody>
                {fixtures.map((fixture) => {
                  const currentPick = predictionsByMatch[fixture.id]?.pick
                  const unlocked = isBeforeKickoff(fixture.kickoff_at)

                  return (
                    <tr key={fixture.id}>
                      <td>{fixture.home_team_name} vs {fixture.away_team_name}</td>
                      <td>{formatLocalKickoff(fixture.kickoff_at)}</td>
                      <td>{fixture.status}</td>
                      <td>
                        <div className="pick-row">
                          {picks.map((pick) => (
                            <button
                              key={pick}
                              className={currentPick === pick ? 'active' : ''}
                              disabled={!unlocked}
                              onClick={() => void handlePick(fixture.id, pick)}
                            >
                              {pick}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2>Leaderboard</h2>
          {!selectedGroupId ? (
            <p>Selecciona un grupo para ver posiciones.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Jugador</th>
                    <th>Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedStandings.map((standing) => {
                    const topThreeHighlight = allMatchesFinished && standing.rank <= 3
                    return (
                      <tr key={standing.user_id} className={topThreeHighlight ? 'top-three' : ''}>
                        <td>#{standing.rank}</td>
                        <td>{standing.display_name ?? 'Sin nombre'}</td>
                        <td>{standing.points}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
