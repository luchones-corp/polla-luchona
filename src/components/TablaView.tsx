import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { HeadToHeadView } from './HeadToHeadView'
import { LeaderboardChart } from './LeaderboardChart'
import { StandingsExport } from './StandingsExport'
import { getLeaderboardHistory, getStageStandings } from '../lib/api'
import { computeStreak } from '../lib/streaks'
import { rankStandings, type RankedStanding } from '../lib/ranking'
import { useLocale } from '../contexts/LocaleContext'
import type { Fixture, GroupPrediction, LeaderboardSnapshot, MatchPick, Prediction, Standing } from '../lib/types'

type StageTab = 'general' | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'

export function TablaView({ rankedStandings, userId, fixtures, groupPredictions, predictionsByMatch, groupId, groupName }: {
  rankedStandings: RankedStanding[]
  userId: string
  fixtures: Fixture[]
  groupPredictions: GroupPrediction[]
  predictionsByMatch: Record<number, Prediction>
  groupId: string | null
  groupName: string
}) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [h2hOpponent, setH2hOpponent] = useState<{ id: string; name: string } | null>(null)
  const [stageTab, setStageTab] = useState<StageTab>('general')
  const [stageStandings, setStageStandings] = useState<RankedStanding[] | null>(null)
  const [stageLoading, setStageLoading] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [chartData, setChartData] = useState<LeaderboardSnapshot[] | null>(null)
  const [chartLoading, setChartLoading] = useState(false)

  const stageTabs: { value: StageTab; label: string }[] = [
    { value: 'general', label: t('tabla.general') },
    { value: 'group', label: t('tabla.groups') },
    { value: 'r32', label: 'R32' },
    { value: 'r16', label: 'R16' },
    { value: 'qf', label: t('tabla.qf') },
    { value: 'sf', label: t('tabla.sf') },
    { value: 'final', label: t('tabla.final') },
  ]

  useEffect(() => {
    if (!showChart || !groupId || chartData !== null) return
    let mounted = true
    setChartLoading(true)
    getLeaderboardHistory(groupId)
      .then(d => { if (mounted) setChartData(d) })
      .catch(() => { if (mounted) setChartData([]) })
      .finally(() => { if (mounted) setChartLoading(false) })
    return () => { mounted = false }
  }, [showChart, groupId, chartData])

  const memberStreaks = useMemo(() => {
    const streakMap: Record<string, number> = {}
    const memberIds = new Set(groupPredictions.map(gp => gp.user_id))
    for (const uid of memberIds) {
      const memberPreds: Record<number, Prediction> = {}
      for (const gp of groupPredictions) {
        if (gp.user_id === uid) {
          memberPreds[gp.match_id] = { id: 'x', match_id: gp.match_id, pick: gp.pick as MatchPick, score_home: gp.score_home, score_away: gp.score_away, updated_at: '' }
        }
      }
      const { current } = computeStreak(fixtures, memberPreds)
      if (current >= 3) streakMap[uid] = current
    }
    return streakMap
  }, [fixtures, groupPredictions])

  useEffect(() => {
    if (stageTab === 'general' || !groupId) {
      setStageStandings(null)
      return
    }
    let mounted = true
    setStageLoading(true)
    getStageStandings(groupId, stageTab)
      .then((data: Standing[]) => {
        if (!mounted) return
        setStageStandings(rankStandings(data))
      })
      .catch(() => { if (mounted) setStageStandings(null) })
      .finally(() => { if (mounted) setStageLoading(false) })
    return () => { mounted = false }
  }, [stageTab, groupId])

  const activeStandings = stageTab === 'general' ? rankedStandings : (stageStandings ?? [])

  const podiumOrder = activeStandings.length >= 3
    ? [
        { s: activeStandings[1], cls: 'p2' },
        { s: activeStandings[0], cls: 'p1' },
        { s: activeStandings[2], cls: 'p3' },
      ]
    : null

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <h2>{t('tabla.heading')}</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StandingsExport standings={activeStandings} groupName={groupName} />
          <button className={'chip' + (showChart ? ' chip-lime' : '')} onClick={() => setShowChart(v => !v)}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: 4 }}>
              <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 16l4-8 4 4 5-10" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {showChart ? t('tabla.showTable') : t('tabla.showChart')}
          </button>
          <span className="chip">{activeStandings.length} {t('tabla.players')}</span>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="filter-group">
          {stageTabs.map(tab => (
            <button
              key={tab.value}
              className={'chip' + (stageTab === tab.value ? ' chip-lime' : '')}
              onClick={() => setStageTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {showChart ? (
        chartLoading ? (
          <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>{t('tabla.loadingChart')}</p>
        ) : (
          <LeaderboardChart data={chartData ?? []} userId={userId} />
        )
      ) : stageLoading ? (
        <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>{t('tabla.loading')}</p>
      ) : (
        <>
          {podiumOrder && (
            <div className="lb-podium">
              {podiumOrder.map(({ s, cls }) => (
                <div
                  className={'podium-card ' + cls}
                  key={s.user_id}
                  style={{ cursor: s.user_id !== userId ? 'pointer' : undefined }}
                  onClick={() => s.user_id !== userId && setH2hOpponent({ id: s.user_id, name: s.display_name ?? '?' })}
                >
                  <div className="rk">{s.rank}</div>
                  {s.rank === 1 && <div style={{ fontSize: 20 }}>{'\uD83D\uDC51'}</div>}
                  <Avatar name={s.display_name ?? '?'} size={s.rank === 1 ? 56 : 46} />
                  <div className="pname">
                    {s.display_name ?? t('tabla.noName')}
                    {s.user_id === userId && <span className="you-tag" style={{ marginLeft: 6 }}>{t('tabla.you')}</span>}
                  </div>
                  <div className="ppts tabnum">{s.points}<i> {t('tabla.pts')}</i></div>
                </div>
              ))}
            </div>
          )}

          <div className="lb-table">
            {activeStandings.map((s) => (
              <div
                key={s.user_id}
                className={'lb-row' + (s.user_id === userId ? ' me' : '')}
                style={{ cursor: s.user_id !== userId ? 'pointer' : undefined }}
                onClick={() => s.user_id !== userId && setH2hOpponent({ id: s.user_id, name: s.display_name ?? '?' })}
              >
                <div className={'lb-rank' + (s.rank <= 3 ? ' top' : '')}>{s.rank}</div>
                <div className="lb-user">
                  <Avatar name={s.display_name ?? '?'} size={38} />
                  <div style={{ minWidth: 0 }}>
                    <div className="un">
                      {s.display_name ?? t('tabla.noName')}
                      {s.user_id === userId && <span className="you-tag" style={{ marginLeft: 8 }}>{t('tabla.you')}</span>}
                      {memberStreaks[s.user_id] && <span className="streak-flame">{'\uD83D\uDD25'}{memberStreaks[s.user_id]}</span>}
                    </div>
                    {s.user_id !== userId && (
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                        <span>{t('tabla.compare')}</span>
                        <span
                          className="profile-link"
                          onClick={(e) => { e.stopPropagation(); navigate(`/profile/${s.user_id}`) }}
                        >
                          {t('tabla.viewProfile')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="lb-pts tabnum">
                  {s.points}<i>{t('tabla.pts')}</i>
                  {s.exact_count > 0 && <span className="lb-exact">{s.exact_count} {s.exact_count > 1 ? t('tabla.exacts') : t('tabla.exact')}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {h2hOpponent && (
        <HeadToHeadView
          userId={userId}
          opponentId={h2hOpponent.id}
          opponentName={h2hOpponent.name}
          fixtures={fixtures}
          groupPredictions={groupPredictions}
          predictionsByMatch={predictionsByMatch}
          onClose={() => setH2hOpponent(null)}
        />
      )}
    </div>
  )
}
