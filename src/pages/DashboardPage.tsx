import { FormEvent, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  createGroup,
  getFixtures,
  getGroupMembers,
  getGroupsForUser,
  getGroupPredictions,
  getStandings,
  getUserPredictions,
  regenerateInvite,
  removeGroupMember,
  savePrediction,
  signOut,
} from '../lib/api'
import { rankStandings } from '../lib/ranking'
import { Avatar } from '../components/Avatar'
import { AchievementsPanel } from '../components/AchievementsPanel'
import { ICONS } from '../components/Icons'
import { PartidosView } from '../components/PartidosView'
import { TablaView } from '../components/TablaView'
import { GrupoView } from '../components/GrupoView'
import { useNotificationBadge } from '../hooks/useNotifications'
import { useTheme } from '../hooks/useTheme'
import { usePWAInstall } from '../hooks/usePWAInstall'
import type { Fixture, Group, GroupMember, GroupPrediction, MatchPick, Prediction, Standing } from '../lib/types'

type DashboardPageProps = { session: Session; displayName: string }
type View = 'partidos' | 'tabla' | 'grupo'

export function DashboardPage({ session, displayName }: DashboardPageProps) {
  const [view, setView] = useState<View>('partidos')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<number, Prediction>>({})
  const [members, setMembers] = useState<GroupMember[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [groupPredictions, setGroupPredictions] = useState<GroupPrediction[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<string | null>(null)
  const [showAchievements, setShowAchievements] = useState(false)

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId) ?? null, [groups, selectedGroupId])
  const rankedStandings = useMemo(() => rankStandings(standings), [standings])
  const groupPredictionsByMatch = useMemo(() => {
    const map: Record<number, GroupPrediction[]> = {}
    for (const gp of groupPredictions) {
      if (!map[gp.match_id]) map[gp.match_id] = []
      map[gp.match_id].push(gp)
    }
    return map
  }, [groupPredictions])
  const isOwner = selectedGroup?.owner_id === session.user.id
  const badgeCount = useNotificationBadge(fixtures, predictionsByMatch)
  const { theme, toggleTheme } = useTheme()
  const { canInstall, promptInstall } = usePWAInstall()

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1900)
  }

  async function reloadBaseData() {
    setLoading(true)
    setError(null)
    try {
      const [nextGroups, nextFixtures, nextPredictions] = await Promise.all([
        getGroupsForUser(session.user),
        getFixtures(),
        getUserPredictions(session.user.id),
      ])
      const predictionMap = nextPredictions.reduce<Record<number, Prediction>>((acc, p) => { acc[p.match_id] = p; return acc }, {})
      setGroups(nextGroups)
      setFixtures(nextFixtures)
      setPredictionsByMatch(predictionMap)
      const fallbackGroupId = selectedGroupId && nextGroups.some(g => g.id === selectedGroupId)
        ? selectedGroupId : nextGroups[0]?.id ?? null
      setSelectedGroupId(fallbackGroupId)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadBaseData()
    const timer = window.setInterval(() => { void reloadBaseData() }, 30_000)
    return () => window.clearInterval(timer)
  }, [session.user.id])

  useEffect(() => {
    if (!selectedGroupId) { setMembers([]); setStandings([]); setGroupPredictions([]); return }
    const groupId = selectedGroupId
    let mounted = true
    async function loadGroupData() {
      try {
        const [nextMembers, nextStandings, nextGroupPredictions] = await Promise.all([
          getGroupMembers(groupId),
          getStandings(groupId),
          getGroupPredictions(groupId),
        ])
        if (!mounted) return
        setMembers(nextMembers)
        setStandings(nextStandings)
        setGroupPredictions(nextGroupPredictions)
      } catch (caughtError) {
        if (!mounted) return
        setError(caughtError instanceof Error ? caughtError.message : 'No se pudo cargar el grupo')
      }
    }
    void loadGroupData()
    return () => { mounted = false }
  }, [selectedGroupId])

  async function handleCreateGroup(event: FormEvent) {
    event.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    setError(null)
    try {
      const created = await createGroup(name)
      setNewGroupName('')
      await reloadBaseData()
      setSelectedGroupId(created.id)
      showToast('¡Grupo creado!')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo crear el grupo')
    }
  }

  async function handlePick(matchId: number, pick: MatchPick) {
    setError(null)
    try {
      await savePrediction(session.user.id, matchId, pick)
      setPredictionsByMatch(current => ({
        ...current,
        [matchId]: { id: current[matchId]?.id ?? `local-${matchId}`, match_id: matchId, pick, updated_at: new Date().toISOString() },
      }))
      showToast('¡Predicción guardada!')
      if (selectedGroupId) {
        const refreshedStandings = await getStandings(selectedGroupId)
        setStandings(refreshedStandings)
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo guardar tu predicción')
    }
  }

  async function handleRegenerateInvite() {
    if (!selectedGroup) return
    setError(null)
    try {
      await regenerateInvite(selectedGroup.id)
      await reloadBaseData()
      showToast('Enlace regenerado')
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo regenerar el enlace')
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
      setError(caughtError instanceof Error ? caughtError.message : 'No se pudo remover al miembro')
    }
  }

  const go = (v: View) => { setView(v); window.scrollTo({ top: 0 }) }

  if (!loading && groups.length === 0) {
    return (
      <div className="shell">
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div className="card fade-in" style={{ padding: 28, width: 'min(420px, 95vw)' }}>
            <div className="brand" style={{ marginBottom: 16 }}>
              <div className="brand-mark"><span>LP</span></div>
              <div className="brand-txt"><b>La Polla</b><em>Mundial 2026</em></div>
            </div>
            <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 24, textTransform: 'uppercase', marginBottom: 8 }}>Crea tu grupo</h2>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 16 }}>Empieza creando un grupo para invitar a tus amigos.</p>
            <form onSubmit={handleCreateGroup}>
              <div className="field">
                <label>Nombre del grupo</label>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="ej. Polla Luchona" required />
              </div>
              <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 8 }}>Crear grupo</button>
            </form>
            {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <div className="brand-mark"><span>LP</span></div>
            <div className="brand-txt"><b>La Polla</b><em>{selectedGroup?.name ?? 'Mundial 2026'}</em></div>
          </div>
          <nav className="nav-desk">
            <button className={view === 'partidos' ? 'on' : ''} onClick={() => go('partidos')}>
              {ICONS.dash} Partidos
              {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
            </button>
            <button className={view === 'tabla' ? 'on' : ''} onClick={() => go('tabla')}>{ICONS.board} Tabla</button>
            <button className={view === 'grupo' ? 'on' : ''} onClick={() => go('grupo')}>{ICONS.group} Grupo</button>
          </nav>
          <div className="topbar-right">
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAchievements(true)} title="Logros">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 21h8M12 17v4M5 4h14v6a7 7 0 0 1-14 0zM5 7H3v1a3 3 0 0 0 3 3M19 7h2v1a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="me-chip">
              <span className="me-name">{displayName}</span>
              <Avatar name={displayName} size={30} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} title="Cerrar sesión">
              {ICONS.logout}
            </button>
          </div>
        </div>
      </header>

      <nav className="nav-mob">
        <button className={view === 'partidos' ? 'on' : ''} onClick={() => go('partidos')} style={{ position: 'relative' }}>
          {ICONS.dash}<span>Partidos</span>
          {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
        </button>
        <button className={view === 'tabla' ? 'on' : ''} onClick={() => go('tabla')}>{ICONS.board}<span>Tabla</span></button>
        <button className={view === 'grupo' ? 'on' : ''} onClick={() => go('grupo')}>{ICONS.group}<span>Grupo</span></button>
      </nav>

      <main className="page page-mob-pad">
        {canInstall && (
          <div className="wrap" style={{ marginBottom: 12 }}>
            <div className="pwa-banner card">
              <span>Instala La Polla en tu dispositivo para acceso rápido.</span>
              <button className="btn btn-primary btn-sm" onClick={promptInstall}>Instalar</button>
            </div>
          </div>
        )}
        {error && <div className="wrap"><p className="error-msg" style={{ marginBottom: 12 }}>{error}</p></div>}

        {view === 'partidos' && (
          <PartidosView
            fixtures={fixtures}
            predictionsByMatch={predictionsByMatch}
            groupPredictionsByMatch={groupPredictionsByMatch}
            onPick={handlePick}
          />
        )}

        {view === 'tabla' && (
          <TablaView
            rankedStandings={rankedStandings}
            userId={session.user.id}
            fixtures={fixtures}
            groupPredictions={groupPredictions}
            predictionsByMatch={predictionsByMatch}
            groupId={selectedGroupId}
          />
        )}

        {view === 'grupo' && (
          <GrupoView
            selectedGroup={selectedGroup}
            isOwner={isOwner}
            members={members}
            session={session}
            onRegenerateInvite={handleRegenerateInvite}
            onRemoveMember={handleRemoveMember}
            toast={showToast}
          />
        )}
      </main>

      {toast && (
        <div className="toast pop-in">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {toast}
        </div>
      )}

      {showAchievements && (
        <AchievementsPanel
          fixtures={fixtures}
          predictionsByMatch={predictionsByMatch}
          onClose={() => setShowAchievements(false)}
        />
      )}
    </div>
  )
}
