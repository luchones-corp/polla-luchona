import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import {
  createGroup,
  deleteGroup,
  getFixtures,
  getGroupMembers,
  getGroupReactions,
  getGroupsForUser,
  getGroupPredictions,
  getStandings,
  getUserPredictions,
  leaveGroup,
  regenerateInvite,
  removeGroupMember,
  savePrediction,
  signOut,
} from '../lib/api'
import { rankStandings } from '../lib/ranking'
import { Avatar } from '../components/Avatar'
import { AchievementsPanel } from '../components/AchievementsPanel'
import { ICONS } from '../components/Icons'
import { LiveFeedView } from '../components/LiveFeedView'
import { PartidosView } from '../components/PartidosView'
import { TablaView } from '../components/TablaView'
import { GrupoView } from '../components/GrupoView'
import { useNotificationBadge } from '../hooks/useNotifications'
import { usePushSubscription } from '../hooks/usePushSubscription'

import { useTheme } from '../hooks/useTheme'
import { usePWAInstall } from '../hooks/usePWAInstall'
import { useLocale } from '../contexts/LocaleContext'
import type { Fixture, Group, GroupMember, GroupPrediction, MatchPick, Prediction, ReactionSummary, Standing } from '../lib/types'

type DashboardPageProps = { session: Session; displayName: string }
type View = 'partidos' | 'tabla' | 'grupo' | 'en-vivo'

export function DashboardPage({ session, displayName }: DashboardPageProps) {
  const [view, setView] = useState<View>('partidos')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => localStorage.getItem('selectedGroupId'))
  const [showGroupMenu, setShowGroupMenu] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<number, Prediction>>({})
  const [members, setMembers] = useState<GroupMember[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [groupPredictions, setGroupPredictions] = useState<GroupPrediction[]>([])
  const [reactionsByMatch, setReactionsByMatch] = useState<Record<number, ReactionSummary[]>>({})
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
  const { isSubscribed, isSupported: pushSupported, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushSubscription(session.user.id)
  const { locale, setLocale, t } = useLocale()
  const navigate = useNavigate()
  const hasLive = fixtures.some(f => f.status === 'live')
  const groupMenuRef = useRef<HTMLDivElement>(null)

  // Persist selected group to localStorage
  useEffect(() => {
    if (selectedGroupId) localStorage.setItem('selectedGroupId', selectedGroupId)
    else localStorage.removeItem('selectedGroupId')
  }, [selectedGroupId])

  // Close group menu on click outside
  useEffect(() => {
    if (!showGroupMenu) return
    function handleClick(e: MouseEvent) {
      if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showGroupMenu])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 1900)
  }

  async function reloadBaseData() {
    setLoading(true)
    setError(null)
    try {
      const [nextGroups, nextFixtures] = await Promise.all([
        getGroupsForUser(session.user),
        getFixtures(),
      ])
      setGroups(nextGroups)
      setFixtures(nextFixtures)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('dash.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void reloadBaseData()
    const timer = window.setInterval(() => { void reloadBaseData() }, 30_000)
    return () => window.clearInterval(timer)
  }, [session.user.id])

  // Validate selectedGroupId against current groups list
  useEffect(() => {
    if (groups.length === 0) return
    if (selectedGroupId && groups.some(g => g.id === selectedGroupId)) return
    setSelectedGroupId(groups[0].id)
  }, [groups, selectedGroupId])

  useEffect(() => {
    if (!selectedGroupId) {
      setMembers([]); setStandings([]); setGroupPredictions([]); setReactionsByMatch({}); setPredictionsByMatch({})
      return
    }
    const groupId = selectedGroupId
    let mounted = true
    // Clear stale per-group predictions while we fetch fresh ones
    setPredictionsByMatch({})
    async function loadGroupData() {
      try {
        const [nextMembers, nextStandings, nextGroupPredictions, nextReactions, nextPredictions] = await Promise.all([
          getGroupMembers(groupId),
          getStandings(groupId),
          getGroupPredictions(groupId),
          getGroupReactions(groupId),
          getUserPredictions(session.user.id, groupId),
        ])
        if (!mounted) return
        setMembers(nextMembers)
        setStandings(nextStandings)
        setGroupPredictions(nextGroupPredictions)
        setReactionsByMatch(nextReactions)
        const predictionMap = nextPredictions.reduce<Record<number, Prediction>>((acc, p) => { acc[p.match_id] = p; return acc }, {})
        setPredictionsByMatch(predictionMap)
      } catch (caughtError) {
        if (!mounted) return
        setError(caughtError instanceof Error ? caughtError.message : t('dash.groupError'))
      }
    }
    void loadGroupData()
    return () => { mounted = false }
  }, [selectedGroupId, session.user.id])

  async function handleCreateGroup(event: FormEvent) {
    event.preventDefault()
    const name = newGroupName.trim()
    if (!name) return
    setError(null)
    try {
      const created = await createGroup(name)
      setNewGroupName('')
      setShowCreateGroup(false)
      await reloadBaseData()
      setSelectedGroupId(created.id)
      setView('partidos')
      window.scrollTo({ top: 0 })
      showToast(t('dash.groupCreated'))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('dash.createError'))
    }
  }

  async function handleLeaveGroup() {
    if (!selectedGroupId || isOwner) return
    if (!window.confirm(t('grupo.leaveConfirm'))) return
    setError(null)
    try {
      await leaveGroup(selectedGroupId)
      showToast(t('grupo.left'))
      await reloadBaseData()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('grupo.leaveError'))
    }
  }

  async function handleDeleteGroup() {
    if (!selectedGroupId || !isOwner) return
    if (!window.confirm(t('grupo.deleteConfirm'))) return
    setError(null)
    try {
      await deleteGroup(selectedGroupId)
      showToast(t('grupo.deleted'))
      await reloadBaseData()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('grupo.deleteError'))
    }
  }

  async function handlePick(matchId: number, pick: MatchPick) {
    if (!selectedGroupId) return
    setError(null)
    // Cancel any pending score save — manual pick takes priority
    clearTimeout(scoreTimers.current[matchId])
    const groupId = selectedGroupId
    try {
      // Clear scores: manual row tap = "just winner" mode
      await savePrediction(session.user.id, groupId, matchId, pick, null, null)
      setPredictionsByMatch(current => ({
        ...current,
        [matchId]: {
          id: current[matchId]?.id ?? `local-${matchId}`,
          match_id: matchId,
          group_id: groupId,
          pick,
          score_home: null,
          score_away: null,
          updated_at: new Date().toISOString(),
        },
      }))
      showToast(t('dash.predSaved'))
      const refreshedStandings = await getStandings(groupId)
      setStandings(refreshedStandings)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('dash.predError'))
    }
  }

  const scoreTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const saveScore = useCallback(async (matchId: number, scoreHome: number | null, scoreAway: number | null) => {
    if (!selectedGroupId) return
    const existing = predictionsByMatch[matchId]
    const pick = scoreHome !== null && scoreAway !== null
      ? (scoreHome > scoreAway ? 'HOME' : scoreHome < scoreAway ? 'AWAY' : 'DRAW') as MatchPick
      : existing?.pick
    if (!pick) return
    setError(null)
    const groupId = selectedGroupId
    try {
      await savePrediction(session.user.id, groupId, matchId, pick, scoreHome, scoreAway)
      setPredictionsByMatch(current => ({
        ...current,
        [matchId]: {
          id: current[matchId]?.id ?? `local-${matchId}`,
          match_id: matchId,
          group_id: groupId,
          pick,
          score_home: scoreHome,
          score_away: scoreAway,
          updated_at: new Date().toISOString(),
        },
      }))
      if (scoreHome !== null && scoreAway !== null) {
        showToast(t('dash.scoreSaved'))
      }
      const refreshedStandings = await getStandings(groupId)
      setStandings(refreshedStandings)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('dash.predError'))
    }
  }, [predictionsByMatch, session.user.id, selectedGroupId])

  function handleScoreChange(matchId: number, scoreHome: number | null, scoreAway: number | null) {
    if (!selectedGroupId) return
    // Update UI immediately
    setPredictionsByMatch(current => ({
      ...current,
      [matchId]: {
        id: current[matchId]?.id ?? `local-${matchId}`,
        match_id: matchId,
        group_id: selectedGroupId,
        pick: current[matchId]?.pick ?? (scoreHome !== null && scoreAway !== null
          ? (scoreHome > scoreAway ? 'HOME' : scoreHome < scoreAway ? 'AWAY' : 'DRAW') as MatchPick
          : 'HOME'),
        score_home: scoreHome,
        score_away: scoreAway,
        updated_at: new Date().toISOString(),
      },
    }))

    // Debounce API call — only save when both scores are filled
    clearTimeout(scoreTimers.current[matchId])
    if (scoreHome !== null && scoreAway !== null) {
      scoreTimers.current[matchId] = setTimeout(() => {
        void saveScore(matchId, scoreHome, scoreAway)
      }, 600)
    }
  }

  async function handleRegenerateInvite() {
    if (!selectedGroup) return
    setError(null)
    try {
      await regenerateInvite(selectedGroup.id)
      await reloadBaseData()
      showToast(t('dash.inviteRegen'))
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('dash.regenError'))
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
      setError(caughtError instanceof Error ? caughtError.message : t('dash.removeError'))
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
              <div className="brand-txt"><b>{t('brand.name')}</b><em>{t('brand.subtitle')}</em></div>
            </div>
            <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 24, textTransform: 'uppercase', marginBottom: 8 }}>{t('dash.createGroup')}</h2>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 16 }}>{t('dash.createGroupDesc')}</p>
            <form onSubmit={handleCreateGroup}>
              <div className="field">
                <label>{t('dash.groupNameLabel')}</label>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder={t('dash.groupNamePlaceholder')} required />
              </div>
              <button className="btn btn-primary btn-block" type="submit" style={{ marginTop: 8 }}>{t('dash.createBtn')}</button>
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
          <div className="brand" ref={groupMenuRef}>
            <div className="brand-mark"><span>LP</span></div>
            <div className="brand-txt">
              <b>{t('brand.name')}</b>
              <button className="group-switcher" onClick={() => setShowGroupMenu(v => !v)}>
                {selectedGroup?.name ?? t('brand.subtitle')}
                <svg className={'group-switcher-chevron' + (showGroupMenu ? ' open' : '')} viewBox="0 0 12 7" width="10" height="6"><path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" /></svg>
              </button>
            </div>
            {showGroupMenu && (
              <div className="group-menu">
                {groups.map(g => (
                  <button key={g.id} className={'group-menu-item' + (g.id === selectedGroupId ? ' active' : '')}
                    onClick={() => { setSelectedGroupId(g.id); setShowGroupMenu(false) }}>
                    <span>{g.name}</span>
                    {g.id === selectedGroupId && <span className="group-menu-check">{'\u2713'}</span>}
                  </button>
                ))}
                <div className="group-menu-divider" />
                <button className="group-menu-item group-menu-create"
                  onClick={() => { setShowGroupMenu(false); setShowCreateGroup(true) }}>
                  + {t('dash.createGroup')}
                </button>
              </div>
            )}
          </div>
          <nav className="nav-desk">
            <button className={view === 'partidos' ? 'on' : ''} onClick={() => go('partidos')}>
              {ICONS.dash} {t('nav.partidos')}
              {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
            </button>
            <button className={view === 'tabla' ? 'on' : ''} onClick={() => go('tabla')}>{ICONS.board} {t('nav.tabla')}</button>
            <button className={view === 'grupo' ? 'on' : ''} onClick={() => go('grupo')}>{ICONS.group} {t('nav.grupo')}</button>
            <button className={view === 'en-vivo' ? 'on' : ''} onClick={() => go('en-vivo')} style={{ position: 'relative' }}>
              {ICONS.dash} {t('nav.envivo')}
              {hasLive && <span className="live-dot-nav" />}
            </button>
          </nav>
          <div className="topbar-right">
            <a
              href="/games/penales/canvas.html"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost btn-sm"
              title={t('dash.penales')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-label={t('dash.penales')}>
                <rect x="2" y="6" width="20" height="12" rx="4" />
                <circle cx="9" cy="12" r="2" fill="currentColor" stroke="none" />
                <circle cx="15" cy="10" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="17" cy="12" r="1.2" fill="currentColor" stroke="none" />
                <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
              </svg>
            </a>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setLocale(locale === 'es' ? 'en' : 'es')}
              title={locale === 'es' ? 'English' : 'Español'}
              style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: 12, letterSpacing: '.04em' }}
            >
              {locale === 'es' ? 'EN' : 'ES'}
            </button>
            {pushSupported && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void (isSubscribed ? pushUnsubscribe() : pushSubscribe())}
                title={isSubscribed ? t('dash.notifOff') : t('dash.notifOn')}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {isSubscribed && <span className="bell-active-dot" />}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAchievements(true)} title={t('dash.achievements')}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M8 21h8M12 17v4M5 4h14v6a7 7 0 0 1-14 0zM5 7H3v1a3 3 0 0 0 3 3M19 7h2v1a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title={theme === 'dark' ? t('dash.lightMode') : t('dash.darkMode')}>
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
            <div className="me-chip" style={{ cursor: 'pointer' }} onClick={() => navigate(`/profile/${session.user.id}`)}>
              <span className="me-name">{displayName}</span>
              <Avatar name={displayName} size={30} />
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => void signOut()} title={t('dash.logout')}>
              {ICONS.logout}
            </button>
          </div>
        </div>
      </header>

      <nav className="nav-mob">
        <button className={view === 'partidos' ? 'on' : ''} onClick={() => go('partidos')} style={{ position: 'relative' }}>
          {ICONS.dash}<span>{t('nav.partidos')}</span>
          {badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
        </button>
        <button className={view === 'tabla' ? 'on' : ''} onClick={() => go('tabla')}>{ICONS.board}<span>{t('nav.tabla')}</span></button>
        <button className={view === 'grupo' ? 'on' : ''} onClick={() => go('grupo')}>{ICONS.group}<span>{t('nav.grupo')}</span></button>
        <button className={view === 'en-vivo' ? 'on' : ''} onClick={() => go('en-vivo')} style={{ position: 'relative' }}>
          {ICONS.dash}<span>{t('nav.vivoShort')}</span>
          {hasLive && <span className="live-dot-nav" />}
        </button>
      </nav>

      <main className="page page-mob-pad">
        {canInstall && (
          <div className="wrap" style={{ marginBottom: 12 }}>
            <div className="pwa-banner card">
              <span>{t('dash.pwaBanner')}</span>
              <button className="btn btn-primary btn-sm" onClick={promptInstall}>{t('dash.install')}</button>
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
            onScoreChange={handleScoreChange}
            groupId={selectedGroupId ?? undefined}
            userId={session.user.id}
            reactionsByMatch={reactionsByMatch}
            lockMinutesBefore={selectedGroup?.lock_minutes_before ?? 0}
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
            groupName={selectedGroup?.name ?? 'Mundial 2026'}
          />
        )}

        {view === 'en-vivo' && (
          <LiveFeedView fixtures={fixtures} />
        )}

        {view === 'grupo' && (
          <GrupoView
            selectedGroup={selectedGroup}
            isOwner={isOwner}
            members={members}
            session={session}
            onRegenerateInvite={handleRegenerateInvite}
            onRemoveMember={handleRemoveMember}
            onLeaveGroup={handleLeaveGroup}
            onDeleteGroup={handleDeleteGroup}
            toast={showToast}
            onGroupUpdated={() => void reloadBaseData()}
          />
        )}
      </main>

      {showCreateGroup && (
        <div className="create-group-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowCreateGroup(false) }}>
          <div className="create-group-modal card fade-in">
            <div className="brand" style={{ marginBottom: 16 }}>
              <div className="brand-mark"><span>LP</span></div>
              <div className="brand-txt"><b>{t('brand.name')}</b><em>{t('brand.subtitle')}</em></div>
            </div>
            <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, textTransform: 'uppercase', marginBottom: 8 }}>{t('dash.createGroup')}</h2>
            <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 16 }}>{t('dash.createGroupDesc')}</p>
            <form onSubmit={handleCreateGroup}>
              <div className="field">
                <label>{t('dash.groupNameLabel')}</label>
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder={t('dash.groupNamePlaceholder')} required autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <button className="btn btn-primary" type="submit" style={{ flex: 1 }}>{t('dash.createBtn')}</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowCreateGroup(false)} style={{ flex: 0 }}>✕</button>
              </div>
            </form>
            {error && <p className="error-msg" style={{ marginTop: 12 }}>{error}</p>}
          </div>
        </div>
      )}

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
