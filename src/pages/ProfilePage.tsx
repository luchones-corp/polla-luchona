import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { getFixtures, getPublicUserPredictions, getUserPredictions, getUserProfile } from '../lib/api'
import { computeStreak } from '../lib/streaks'
import { useLocale } from '../contexts/LocaleContext'
import { Avatar } from '../components/Avatar'
import { FlagImg } from '../components/FlagImg'
import type { Fixture, MatchPick, Prediction } from '../lib/types'

type ProfilePageProps = {
  session: Session
  groupId: string | null
}

export function ProfilePage({ session, groupId }: ProfilePageProps) {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { t } = useLocale()
  const isOwn = userId === session.user.id

  const pickLabel: Record<MatchPick, string> = { HOME: t('pick.home'), DRAW: 'X', AWAY: t('pick.away') }

  const [profile, setProfile] = useState<{ display_name: string | null; created_at: string } | null>(null)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let mounted = true
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [profileData, fixtureData, predictionData] = await Promise.all([
          getUserProfile(userId!),
          getFixtures(),
          isOwn
            ? (groupId ? getUserPredictions(userId!, groupId) : Promise.resolve([]))
            : groupId
              ? getPublicUserPredictions(userId!, groupId)
              : Promise.resolve([]),
        ])
        if (!mounted) return
        setProfile(profileData)
        setFixtures(fixtureData)
        setPredictions(predictionData)
      } catch (e) {
        if (!mounted) return
        setError(e instanceof Error ? e.message : t('profile.error'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => { mounted = false }
  }, [userId, groupId, isOwn])

  const predictionsByMatch = useMemo(() => {
    const map: Record<number, Prediction> = {}
    for (const p of predictions) map[p.match_id] = p
    return map
  }, [predictions])

  const streak = useMemo(() => computeStreak(fixtures, predictionsByMatch), [fixtures, predictionsByMatch])

  const stats = useMemo(() => {
    const finished = fixtures.filter(f => f.status === 'finished' && f.outcome !== null)
    let totalPredicted = 0
    let correct = 0
    let totalPoints = 0
    let exactCount = 0
    const pickCounts: Record<MatchPick, number> = { HOME: 0, DRAW: 0, AWAY: 0 }

    for (const f of finished) {
      const pred = predictionsByMatch[f.id]
      if (!pred) continue
      totalPredicted++
      pickCounts[pred.pick]++
      const isExact = pred.score_home !== null && pred.score_away !== null
        && pred.score_home === f.ft_home && pred.score_away === f.ft_away
      if (isExact) { totalPoints += 3; correct++; exactCount++ }
      else if (pred.pick === f.outcome) { totalPoints += 1; correct++ }
    }

    const accuracy = totalPredicted > 0 ? Math.round((correct / totalPredicted) * 100) : 0
    const favOutcome = (['HOME', 'DRAW', 'AWAY'] as MatchPick[]).reduce((a, b) => pickCounts[a] >= pickCounts[b] ? a : b)

    return { totalPredicted, correct, totalPoints, exactCount, accuracy, favOutcome, pickCounts }
  }, [fixtures, predictionsByMatch])

  const stageBreakdown = useMemo(() => {
    const stages = ['group', 'r32', 'r16', 'qf', 'sf', 'final']
    return stages.map(stage => {
      const stageFixtures = fixtures.filter(f => f.stage === stage && f.status === 'finished' && f.outcome !== null)
      let predicted = 0, correct = 0
      for (const f of stageFixtures) {
        const pred = predictionsByMatch[f.id]
        if (!pred) continue
        predicted++
        if (pred.pick === f.outcome) correct++
      }
      return { stage, total: stageFixtures.length, predicted, correct, accuracy: predicted > 0 ? Math.round((correct / predicted) * 100) : 0 }
    }).filter(s => s.total > 0)
  }, [fixtures, predictionsByMatch])

  const recentPredictions = useMemo(() => {
    return fixtures
      .filter(f => f.status === 'finished' && f.outcome !== null && predictionsByMatch[f.id])
      .sort((a, b) => new Date(b.kickoff_at).getTime() - new Date(a.kickoff_at).getTime())
      .slice(0, 20)
  }, [fixtures, predictionsByMatch])

  if (loading) {
    return (
      <div className="shell">
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, color: 'var(--ink-2)' }}>{t('profile.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="shell">
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div className="card fade-in" style={{ padding: 28, textAlign: 'center' }}>
            <p className="error-msg" style={{ marginBottom: 16 }}>{error ?? t('profile.notFound')}</p>
            <button className="btn btn-primary" onClick={() => navigate('/')}>{t('profile.back')}</button>
          </div>
        </div>
      </div>
    )
  }

  const displayName = profile.display_name ?? t('profile.noName')

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-in">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('profile.back')}
          </button>
        </div>
      </header>

      <main className="page page-mob-pad">
        <div className="wrap fade-in">
          <div className="profile-header">
            <Avatar name={displayName} size={72} />
            <h1 className="profile-name">{displayName}</h1>
            {isOwn && <span className="chip chip-lime" style={{ marginTop: 4 }}>{t('profile.you')}</span>}
            {streak.isHot && <span className="streak-badge">🔥 {streak.current}</span>}
          </div>

          <div className="profile-stats-grid">
            <div className="profile-stat card">
              <div className="profile-stat-val">{stats.totalPoints}</div>
              <div className="profile-stat-lbl">{t('profile.points')}</div>
            </div>
            <div className="profile-stat card">
              <div className="profile-stat-val">{stats.accuracy}%</div>
              <div className="profile-stat-lbl">{t('profile.accuracy')}</div>
            </div>
            <div className="profile-stat card">
              <div className="profile-stat-val">{streak.best}</div>
              <div className="profile-stat-lbl">{t('profile.bestStreak')}</div>
            </div>
            <div className="profile-stat card">
              <div className="profile-stat-val">{stats.exactCount}</div>
              <div className="profile-stat-lbl">{t('profile.exacts')}</div>
            </div>
          </div>

          <div className="profile-section">
            <h3 className="profile-section-title">{t('profile.pickDist')}</h3>
            <div className="profile-pick-dist">
              {(['HOME', 'DRAW', 'AWAY'] as MatchPick[]).map(pick => {
                const count = stats.pickCounts[pick]
                const pct = stats.totalPredicted > 0 ? Math.round((count / stats.totalPredicted) * 100) : 0
                return (
                  <div key={pick} className="profile-pick-bar">
                    <span className="profile-pick-lbl">{pickLabel[pick]}</span>
                    <div className="profile-bar-track">
                      <div className="profile-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="profile-pick-pct">{pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>

          {stageBreakdown.length > 0 && (
            <div className="profile-section">
              <h3 className="profile-section-title">{t('profile.byStage')}</h3>
              <div className="card" style={{ overflow: 'hidden' }}>
                <table className="profile-stage-table">
                  <thead>
                    <tr>
                      <th>{t('profile.stageCol')}</th>
                      <th>{t('profile.predictedCol')}</th>
                      <th>{t('profile.correctCol')}</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageBreakdown.map(s => (
                      <tr key={s.stage}>
                        <td>{t(`stage.${s.stage}`)}</td>
                        <td>{s.predicted}/{s.total}</td>
                        <td>{s.correct}</td>
                        <td>{s.accuracy}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {recentPredictions.length > 0 && (
            <div className="profile-section">
              <h3 className="profile-section-title">{t('profile.recentResults')}</h3>
              <div className="profile-history">
                {recentPredictions.map(f => {
                  const pred = predictionsByMatch[f.id]
                  const isExact = pred.score_home !== null && pred.score_away !== null
                    && pred.score_home === f.ft_home && pred.score_away === f.ft_away
                  const isCorrect = pred.pick === f.outcome
                  const pts = isExact ? 3 : isCorrect ? 1 : 0

                  return (
                    <div key={f.id} className={'profile-history-row' + (isExact ? ' exact' : isCorrect ? ' correct' : '')}>
                      <div className="profile-history-match">
                        <FlagImg teamId={f.home_team_id} w={20} />
                        <span className="profile-history-score">{f.ft_home} - {f.ft_away}</span>
                        <FlagImg teamId={f.away_team_id} w={20} />
                      </div>
                      <div className="profile-history-pred">
                        {pred.score_home !== null && pred.score_away !== null
                          ? <span>{pred.score_home}-{pred.score_away}</span>
                          : <span>{pickLabel[pred.pick]}</span>
                        }
                      </div>
                      <span className={'chip' + (isExact ? ' chip-gold' : isCorrect ? ' chip-lime' : '')} style={{ fontSize: 11, padding: '2px 7px' }}>
                        +{pts}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
