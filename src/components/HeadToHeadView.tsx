import { useMemo } from 'react'
import { Avatar } from './Avatar'
import { FlagImg } from './FlagImg'
import type { Fixture, GroupPrediction, MatchPick, Prediction } from '../lib/types'

const pickLabel: Record<MatchPick, string> = { HOME: 'Local', DRAW: 'X', AWAY: 'Visita' }

export function HeadToHeadView({ userId, opponentId, opponentName, fixtures, groupPredictions, predictionsByMatch, onClose }: {
  userId: string
  opponentId: string
  opponentName: string
  fixtures: Fixture[]
  groupPredictions: GroupPrediction[]
  predictionsByMatch: Record<number, Prediction>
  onClose: () => void
}) {
  const opponentPicks = useMemo(() => {
    const map: Record<number, MatchPick> = {}
    for (const gp of groupPredictions) {
      if (gp.user_id === opponentId) map[gp.match_id] = gp.pick as MatchPick
    }
    return map
  }, [groupPredictions, opponentId])

  const finishedMatches = useMemo(() => {
    return fixtures.filter(f => f.status === 'finished' && f.outcome !== null)
  }, [fixtures])

  const stats = useMemo(() => {
    let myCorrect = 0
    let theirCorrect = 0
    for (const f of finishedMatches) {
      const myPick = predictionsByMatch[f.id]?.pick
      const theirPick = opponentPicks[f.id]
      if (myPick === f.outcome) myCorrect++
      if (theirPick === f.outcome) theirCorrect++
    }
    return { myCorrect, theirCorrect, total: finishedMatches.length }
  }, [finishedMatches, predictionsByMatch, opponentPicks])

  return (
    <div className="h2h-overlay" onClick={onClose}>
      <div className="h2h-panel card" onClick={e => e.stopPropagation()}>
        <div className="h2h-header">
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ position: 'absolute', top: 14, right: 14 }}>✕</button>
          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, textTransform: 'uppercase', marginBottom: 16 }}>Mano a mano</h2>
          <div className="h2h-vs">
            <div className="h2h-player">
              <Avatar name="TÚ" size={48} />
              <span className="h2h-name">TÚ</span>
              <span className="h2h-score">{stats.myCorrect}</span>
            </div>
            <span style={{ fontFamily: 'var(--font-disp)', fontSize: 18, color: 'var(--ink-3)' }}>VS</span>
            <div className="h2h-player">
              <Avatar name={opponentName} size={48} />
              <span className="h2h-name">{opponentName}</span>
              <span className="h2h-score">{stats.theirCorrect}</span>
            </div>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            {stats.total} partidos finalizados
          </p>
        </div>

        <div className="h2h-matches">
          {finishedMatches.map(f => {
            const myPick = predictionsByMatch[f.id]?.pick
            const theirPick = opponentPicks[f.id]
            const myRight = myPick === f.outcome
            const theirRight = theirPick === f.outcome

            return (
              <div key={f.id} className="h2h-match-row">
                <div className={'h2h-pick' + (myRight ? ' correct' : myPick ? ' wrong' : '')}>
                  {myPick ? pickLabel[myPick] : '—'}
                </div>
                <div className="h2h-match-info">
                  <div className="h2h-teams">
                    <FlagImg teamId={f.home_team_id} w={18} />
                    <span className="h2h-score-mid">{f.ft_home} - {f.ft_away}</span>
                    <FlagImg teamId={f.away_team_id} w={18} />
                  </div>
                </div>
                <div className={'h2h-pick' + (theirRight ? ' correct' : theirPick ? ' wrong' : '')}>
                  {theirPick ? pickLabel[theirPick] : '—'}
                </div>
              </div>
            )
          })}
          {finishedMatches.length === 0 && (
            <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>
              Aún no hay partidos finalizados para comparar.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
