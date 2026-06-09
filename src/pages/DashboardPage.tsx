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
import { rankStandings, type RankedStanding } from '../lib/ranking'
import { getFlagUrl } from '../lib/flags'
import type { Fixture, Group, GroupMember, MatchPick, Prediction, Standing } from '../lib/types'

type DashboardPageProps = { session: Session; displayName: string }
type View = 'partidos' | 'tabla' | 'grupo'

const pickLabel: Record<MatchPick, string> = { HOME: 'Local', DRAW: 'Empate', AWAY: 'Visita' }
const statusLabel: Record<string, string> = { scheduled: 'Programado', live: 'En vivo', finished: 'Finalizado' }

const ICONS = {
  dash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 4v4h6V4zM4 20h6v-4H4z" strokeLinejoin="round" /></svg>,
  board: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M8 21h8M12 17v4M5 4h14v6a7 7 0 0 1-14 0zM5 7H3v1a3 3 0 0 0 3 3M19 7h2v1a3 3 0 0 1-3 3" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  group: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6a3 3 0 0 1 0 6M17.5 14.5a5.5 5.5 0 0 1 3 5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  logout: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 12H4M9 7l-5 5 5 5M14 4h5v16h-5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  copy: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" strokeLinecap="round" /></svg>,
  regen: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
}

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.replace(/[._-]/g, ' ').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('')
  return (
    <div className="avatar" style={{
      width: size, height: size, fontSize: size * 0.38,
      background: 'linear-gradient(150deg, var(--lime), var(--lime-deep))',
      boxShadow: '0 4px 14px rgba(198,255,50,.3)',
    }}>{initials}</div>
  )
}

function FlagImg({ teamId, w = 38 }: { teamId: number | null; w?: number }) {
  const url = getFlagUrl(teamId, w > 60 ? 160 : 80)
  if (!url) return null
  return <img className="flag flag-ring" src={url} alt="" width={w} height={Math.round(w * 0.68)} style={{ borderRadius: w > 40 ? 6 : 4 }} draggable={false} />
}

function StatusPill({ fixture }: { fixture: Fixture }) {
  if (fixture.status === 'live') return <span className="badge-live"><span className="dot" /> EN VIVO</span>
  if (fixture.status === 'finished') return <span className="chip" style={{ padding: '5px 10px' }}>FINAL</span>
  return <span className="chip" style={{ padding: '5px 10px' }}>{formatLocalKickoff(fixture.kickoff_at)}</span>
}

function PickSelector({ fixture, value, onChange }: { fixture: Fixture; value?: MatchPick; onChange: (pick: MatchPick) => void }) {
  const locked = !isBeforeKickoff(fixture.kickoff_at)
  const opts: { key: MatchPick; label: string; teamId: number | null }[] = [
    { key: 'HOME', label: 'Local', teamId: fixture.home_team_id },
    { key: 'DRAW', label: 'Empate', teamId: null },
    { key: 'AWAY', label: 'Visita', teamId: fixture.away_team_id },
  ]
  return (
    <div className={'pick-seg' + (locked ? ' locked' : '')}>
      {opts.map(o => {
        const sel = value === o.key
        let cls = 'pick-opt'
        if (sel) cls += ' sel'
        return (
          <button key={o.key} className={cls} disabled={locked} onClick={(e) => { e.stopPropagation(); if (!locked) onChange(o.key) }}>
            {o.teamId !== null
              ? <FlagImg teamId={o.teamId} w={24} />
              : <span className="draw-mark">X</span>}
            <span className="pick-lbl">{o.label}</span>
            {sel && !locked && <span className="pick-tick">✓</span>}
          </button>
        )
      })}
    </div>
  )
}

function FixtureCard({ fixture, currentPick, onPick }: { fixture: Fixture; currentPick?: MatchPick; onPick: (matchId: number, pick: MatchPick) => void }) {
  return (
    <div className={'fx-card' + (fixture.status === 'live' ? ' is-live' : '')}>
      <div className="fx-top">
        <span className="grp">{fixture.stage === 'group' ? 'Fase de grupos' : fixture.stage.toUpperCase()}</span>
        <StatusPill fixture={fixture} />
      </div>
      <div className="fx-main">
        <div className="fx-team">
          <FlagImg teamId={fixture.home_team_id} w={38} />
          <span className="tn">{fixture.home_team_name}</span>
        </div>
        <div className="fx-mid">
          <div className="vs">VS</div>
        </div>
        <div className="fx-team right">
          <FlagImg teamId={fixture.away_team_id} w={38} />
          <span className="tn">{fixture.away_team_name}</span>
        </div>
      </div>
      <div className="fx-pick-wrap">
        <PickSelector fixture={fixture} value={currentPick} onChange={(pick) => onPick(fixture.id, pick)} />
      </div>
    </div>
  )
}

// ---- Views ----------------------------------------------------------------

function PartidosView({ fixtures, predictionsByMatch, onPick, page, setPage }: {
  fixtures: Fixture[]
  predictionsByMatch: Record<number, Prediction>
  onPick: (matchId: number, pick: MatchPick) => void
  page: number
  setPage: (fn: (p: number) => number) => void
}) {
  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(fixtures.length / PER_PAGE))
  const paged = fixtures.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const pending = fixtures.filter(f => isBeforeKickoff(f.kickoff_at) && !predictionsByMatch[f.id]).length

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <h2>Partidos</h2>
        {pending > 0 && <span className="chip chip-gold">{pending} sin predicción</span>}
      </div>
      <div className="fx-list">
        {paged.map(f => (
          <FixtureCard key={f.id} fixture={f} currentPick={predictionsByMatch[f.id]?.pick} onPick={onPick} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="pagination-row">
          <button className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Anterior</button>
          <span>{page + 1} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Siguiente →</button>
        </div>
      )}
    </div>
  )
}

function TablaView({ rankedStandings, userId }: { rankedStandings: RankedStanding[]; userId: string }) {
  const podiumOrder = rankedStandings.length >= 3
    ? [
        { s: rankedStandings[1], cls: 'p2' },
        { s: rankedStandings[0], cls: 'p1' },
        { s: rankedStandings[2], cls: 'p3' },
      ]
    : null

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <h2>Tabla de posiciones</h2>
        <span className="chip">{rankedStandings.length} jugadores</span>
      </div>

      {podiumOrder && (
        <div className="lb-podium">
          {podiumOrder.map(({ s, cls }) => (
            <div className={'podium-card ' + cls} key={s.user_id}>
              <div className="rk">{s.rank}</div>
              {s.rank === 1 && <div style={{ fontSize: 20 }}>👑</div>}
              <Avatar name={s.display_name ?? '?'} size={s.rank === 1 ? 56 : 46} />
              <div className="pname">
                {s.display_name ?? 'Sin nombre'}
                {s.user_id === userId && <span className="you-tag" style={{ marginLeft: 6 }}>TÚ</span>}
              </div>
              <div className="ppts tabnum">{s.points}<i> pts</i></div>
            </div>
          ))}
        </div>
      )}

      <div className="lb-table">
        {rankedStandings.map((s) => (
          <div key={s.user_id} className={'lb-row' + (s.user_id === userId ? ' me' : '')}>
            <div className={'lb-rank' + (s.rank <= 3 ? ' top' : '')}>{s.rank}</div>
            <div className="lb-user">
              <Avatar name={s.display_name ?? '?'} size={38} />
              <div style={{ minWidth: 0 }}>
                <div className="un">
                  {s.display_name ?? 'Sin nombre'}
                  {s.user_id === userId && <span className="you-tag" style={{ marginLeft: 8 }}>TÚ</span>}
                </div>
              </div>
            </div>
            <div className="lb-pts tabnum">{s.points}<i>pts</i></div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GrupoView({ selectedGroup, isOwner, members, session, onRegenerateInvite, onRemoveMember, toast }: {
  selectedGroup: Group | null
  isOwner: boolean
  members: GroupMember[]
  session: Session
  onRegenerateInvite: () => void
  onRemoveMember: (id: string) => void
  toast: (msg: string) => void
}) {
  if (!selectedGroup) {
    return (
      <div className="wrap fade-in">
        <div className="sec-head"><h2>Tu grupo</h2></div>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: 'var(--ink-2)' }}>No perteneces a ningún grupo aún.</p>
        </div>
      </div>
    )
  }

  const inviteLink = `${window.location.origin}/join/${selectedGroup.invite_token}`

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <div>
          <p className="kicker" style={{ marginBottom: 6 }}>Administración</p>
          <h2>Tu grupo</h2>
        </div>
        <span className="chip chip-lime">{members.length} jugadores</span>
      </div>

      <div className="grp-grid">
        <div className="invite-card card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 11, background: 'var(--lime)',
              color: '#0a0d10', display: 'grid', placeItems: 'center',
              fontFamily: 'var(--font-disp)', fontSize: 18, transform: 'skewX(-6deg)', flexShrink: 0,
            }}>
              <span style={{ transform: 'skewX(6deg)' }}>🏆</span>
            </div>
            <div>
              <h3>{selectedGroup.name}</h3>
              <div style={{ color: 'var(--ink-3)', fontSize: 12, fontWeight: 600 }}>Mundial 2026</div>
            </div>
          </div>
          <p>Comparte este enlace y cualquiera podrá unirse a competir en tu polla.</p>
          <div className="share-row">
            <button className="btn btn-primary btn-sm" onClick={() => { navigator.clipboard.writeText(inviteLink); toast('¡Enlace copiado!') }}>
              {ICONS.copy} Copiar enlace
            </button>
            {isOwner && (
              <button className="btn btn-dark btn-sm" onClick={onRegenerateInvite}>
                {ICONS.regen} Regenerar
              </button>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '6px 18px 14px' }}>
          <div className="sec-head" style={{ margin: '16px 0 4px' }}>
            <h2 style={{ fontSize: 20 }}>Miembros</h2>
            <span className="sub">{members.length} jugadores</span>
          </div>
          <div className="member-list">
            {members.map(m => (
              <div className="member-row" key={m.user_id}>
                <Avatar name={m.display_name ?? '?'} size={42} />
                <div style={{ minWidth: 0 }}>
                  <div className="mn">
                    {m.display_name ?? 'Sin nombre'}
                    {m.user_id === selectedGroup.owner_id && <span className="admin-tag">Admin</span>}
                    {m.user_id === session.user.id && <span className="you-tag">TÚ</span>}
                  </div>
                </div>
                <div className="mright">
                  {isOwner && m.user_id !== session.user.id && (
                    <button className="btn btn-danger btn-sm" onClick={() => onRemoveMember(m.user_id)}>Quitar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Main Dashboard -------------------------------------------------------

export function DashboardPage({ session, displayName }: DashboardPageProps) {
  const [view, setView] = useState<View>('partidos')
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [predictionsByMatch, setPredictionsByMatch] = useState<Record<number, Prediction>>({})
  const [members, setMembers] = useState<GroupMember[]>([])
  const [standings, setStandings] = useState<Standing[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [fixturesPage, setFixturesPage] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const selectedGroup = useMemo(() => groups.find(g => g.id === selectedGroupId) ?? null, [groups, selectedGroupId])
  const rankedStandings = useMemo(() => rankStandings(standings), [standings])
  const isOwner = selectedGroup?.owner_id === session.user.id

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
    if (!selectedGroupId) { setMembers([]); setStandings([]); return }
    const groupId = selectedGroupId
    let mounted = true
    async function loadGroupData() {
      try {
        const [nextMembers, nextStandings] = await Promise.all([getGroupMembers(groupId), getStandings(groupId)])
        if (!mounted) return
        setMembers(nextMembers)
        setStandings(nextStandings)
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

  // No group yet — show create form
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
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-in">
          <div className="brand">
            <div className="brand-mark"><span>LP</span></div>
            <div className="brand-txt"><b>La Polla</b><em>{selectedGroup?.name ?? 'Mundial 2026'}</em></div>
          </div>
          <nav className="nav-desk">
            <button className={view === 'partidos' ? 'on' : ''} onClick={() => go('partidos')}>{ICONS.dash} Partidos</button>
            <button className={view === 'tabla' ? 'on' : ''} onClick={() => go('tabla')}>{ICONS.board} Tabla</button>
            <button className={view === 'grupo' ? 'on' : ''} onClick={() => go('grupo')}>{ICONS.group} Grupo</button>
          </nav>
          <div className="topbar-right">
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

      {/* Mobile bottom nav */}
      <nav className="nav-mob">
        <button className={view === 'partidos' ? 'on' : ''} onClick={() => go('partidos')}>{ICONS.dash}<span>Partidos</span></button>
        <button className={view === 'tabla' ? 'on' : ''} onClick={() => go('tabla')}>{ICONS.board}<span>Tabla</span></button>
        <button className={view === 'grupo' ? 'on' : ''} onClick={() => go('grupo')}>{ICONS.group}<span>Grupo</span></button>
      </nav>

      <main className="page page-mob-pad">
        {error && <div className="wrap"><p className="error-msg" style={{ marginBottom: 12 }}>{error}</p></div>}

        {view === 'partidos' && (
          <PartidosView
            fixtures={fixtures}
            predictionsByMatch={predictionsByMatch}
            onPick={handlePick}
            page={fixturesPage}
            setPage={setFixturesPage}
          />
        )}

        {view === 'tabla' && (
          <TablaView rankedStandings={rankedStandings} userId={session.user.id} />
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

      {/* Toast */}
      {toast && (
        <div className="toast pop-in">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {toast}
        </div>
      )}
    </div>
  )
}
