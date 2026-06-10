import { useEffect, useMemo, useState } from 'react'
import { Avatar } from './Avatar'
import { HeadToHeadView } from './HeadToHeadView'
import { getStageStandings } from '../lib/api'
import { rankStandings, type RankedStanding } from '../lib/ranking'
import type { Fixture, GroupPrediction, Prediction, Standing } from '../lib/types'

type StageTab = 'general' | 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final'

const STAGE_TABS: { value: StageTab; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'group', label: 'Grupos' },
  { value: 'r32', label: 'R32' },
  { value: 'r16', label: 'R16' },
  { value: 'qf', label: 'Cuartos' },
  { value: 'sf', label: 'Semis' },
  { value: 'final', label: 'Final' },
]

export function TablaView({ rankedStandings, userId, fixtures, groupPredictions, predictionsByMatch, groupId }: {
  rankedStandings: RankedStanding[]
  userId: string
  fixtures: Fixture[]
  groupPredictions: GroupPrediction[]
  predictionsByMatch: Record<number, Prediction>
  groupId: string | null
}) {
  const [h2hOpponent, setH2hOpponent] = useState<{ id: string; name: string } | null>(null)
  const [stageTab, setStageTab] = useState<StageTab>('general')
  const [stageStandings, setStageStandings] = useState<RankedStanding[] | null>(null)
  const [stageLoading, setStageLoading] = useState(false)

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
        <h2>Tabla de posiciones</h2>
        <span className="chip">{activeStandings.length} jugadores</span>
      </div>

      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="filter-group">
          {STAGE_TABS.map(t => (
            <button
              key={t.value}
              className={'chip' + (stageTab === t.value ? ' chip-lime' : '')}
              onClick={() => setStageTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {stageLoading ? (
        <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>Cargando...</p>
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
                      {s.display_name ?? 'Sin nombre'}
                      {s.user_id === userId && <span className="you-tag" style={{ marginLeft: 8 }}>TÚ</span>}
                    </div>
                    {s.user_id !== userId && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Toca para comparar</div>}
                  </div>
                </div>
                <div className="lb-pts tabnum">{s.points}<i>pts</i></div>
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
