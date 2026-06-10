import { useMemo } from 'react'
import { Avatar } from './Avatar'
import { FlagImg } from './FlagImg'
import { useLocale } from '../contexts/LocaleContext'
import type { Fixture, GroupPrediction, MatchPick, Prediction } from '../lib/types'

export function HeadToHeadView({ userId, opponentId, opponentName, fixtures, groupPredictions, predictionsByMatch, onClose }: {
  userId: string
  opponentId: string
  opponentName: string
  fixtures: Fixture[]
  groupPredictions: GroupPrediction[]
  predictionsByMatch: Record<number, Prediction>
  onClose: () => void
}) {
  const { t } = useLocale()
  const pickLabel: Record<MatchPick, string> = { HOME: t('pick.home'), DRAW: 'X', AWAY: t('pick.away') }

  const opponentPicks = useMemo(() => {
    const map: Record<number, GroupPrediction> = {}
    for (const gp of groupPredictions) {
      if (gp.user_id === opponentId) map[gp.match_id] = gp
    }
    return map
  }, [groupPredictions, opponentId])

  const finishedMatches = useMemo(() => {
    return fixtures.filter(f => f.status === 'finished' && f.outcome !== null)
  }, [fixtures])

  const stats = useMemo(() => {
    let myPoints = 0
    let theirPoints = 0
    for (const f of finishedMatches) {
      const myPred = predictionsByMatch[f.id]
      const theirPred = opponentPicks[f.id]
      if (myPred) {
        const myExact = myPred.score_home !== null && myPred.score_away !== null
          && myPred.score_home === f.ft_home && myPred.score_away === f.ft_away
        if (myExact) myPoints += 3
        else if (myPred.pick === f.outcome) myPoints += 1
      }
      if (theirPred) {
        const theirExact = theirPred.score_home !== null && theirPred.score_away !== null
          && theirPred.score_home === f.ft_home && theirPred.score_away === f.ft_away
        if (theirExact) theirPoints += 3
        else if (theirPred.pick === f.outcome) theirPoints += 1
      }
    }
    return { myPoints, theirPoints, total: finishedMatches.length }
  }, [finishedMatches, predictionsByMatch, opponentPicks])

  return (
    <div className="h2h-overlay" onClick={onClose}>
      <div className="h2h-panel card" onClick={e => e.stopPropagation()}>
        <div className="h2h-header">
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ position: 'absolute', top: 14, right: 14 }}>{'\u2715'}</button>
          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 22, textTransform: 'uppercase', marginBottom: 16 }}>{t('h2h.heading')}</h2>
          <div className="h2h-vs">
            <div className="h2h-player">
              <Avatar name={t('h2h.you')} size={48} />
              <span className="h2h-name">{t('h2h.you')}</span>
              <span className="h2h-score">{stats.myPoints} {t('tabla.pts')}</span>
            </div>
            <span style={{ fontFamily: 'var(--font-disp)', fontSize: 18, color: 'var(--ink-3)' }}>{t('common.vs')}</span>
            <div className="h2h-player">
              <Avatar name={opponentName} size={48} />
              <span className="h2h-name">{opponentName}</span>
              <span className="h2h-score">{stats.theirPoints} {t('tabla.pts')}</span>
            </div>
          </div>
          <p style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center', marginTop: 8 }}>
            {stats.total} {t('h2h.finishedMatches')}
          </p>
        </div>

        <div className="h2h-matches">
          {finishedMatches.map(f => {
            const myPred = predictionsByMatch[f.id]
            const theirPred = opponentPicks[f.id]
            const myPick = myPred?.pick
            const theirPick = theirPred?.pick as MatchPick | undefined
            const myExact = myPred && myPred.score_home !== null && myPred.score_away !== null
              && myPred.score_home === f.ft_home && myPred.score_away === f.ft_away
            const theirExact = theirPred && theirPred.score_home !== null && theirPred.score_away !== null
              && theirPred.score_home === f.ft_home && theirPred.score_away === f.ft_away
            const myRight = myPick === f.outcome
            const theirRight = theirPick === f.outcome

            return (
              <div key={f.id} className="h2h-match-row">
                <div className={'h2h-pick' + (myExact ? ' exact' : myRight ? ' correct' : myPick ? ' wrong' : '')}>
                  {myPred?.score_home !== null && myPred?.score_away !== null
                    ? <span className="h2h-pred-score">{myPred.score_home}-{myPred.score_away}</span>
                    : (myPick ? pickLabel[myPick] : '\u2014')}
                </div>
                <div className="h2h-match-info">
                  <div className="h2h-teams">
                    <FlagImg teamId={f.home_team_id} w={18} />
                    <span className="h2h-score-mid">{f.ft_home} - {f.ft_away}</span>
                    <FlagImg teamId={f.away_team_id} w={18} />
                  </div>
                </div>
                <div className={'h2h-pick' + (theirExact ? ' exact' : theirRight ? ' correct' : theirPick ? ' wrong' : '')}>
                  {theirPred?.score_home !== null && theirPred?.score_away !== null
                    ? <span className="h2h-pred-score">{theirPred.score_home}-{theirPred.score_away}</span>
                    : (theirPick ? pickLabel[theirPick] : '\u2014')}
                </div>
              </div>
            )
          })}
          {finishedMatches.length === 0 && (
            <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>
              {t('h2h.noMatches')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
