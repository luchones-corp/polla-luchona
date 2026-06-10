import { useEffect, useState } from 'react'
import { isBeforeKickoff, isBeforeLockTime } from '../lib/date'
import { formatCountdown } from '../lib/countdown'
import { useLocale } from '../contexts/LocaleContext'
import { FlagImg } from './FlagImg'
import { StatusPill } from './StatusPill'
import { PickSelector } from './PickSelector'
import { ReactionBar } from './ReactionBar'
import type { Fixture, GroupPrediction, MatchPick, Prediction, ReactionSummary } from '../lib/types'

function CountdownLabel({ kickoffIso }: { kickoffIso: string }) {
  const [label, setLabel] = useState(() => formatCountdown(kickoffIso))

  useEffect(() => {
    const diff = new Date(kickoffIso).getTime() - Date.now()
    if (diff <= 0) { setLabel(null); return }
    const interval = diff < 5 * 60_000 ? 1_000 : 60_000
    const timer = window.setInterval(() => setLabel(formatCountdown(kickoffIso)), interval)
    return () => window.clearInterval(timer)
  }, [kickoffIso])

  if (!label) return null
  const urgent = new Date(kickoffIso).getTime() - Date.now() < 2 * 60 * 60_000
  return <span className={'countdown' + (urgent ? ' countdown-urgent' : '')}>{label}</span>
}

function getPointsEarned(fixture: Fixture, prediction: Prediction | undefined): { pts: number; isExact: boolean } {
  if (!prediction || fixture.status !== 'finished' || fixture.outcome === null) return { pts: 0, isExact: false }
  const isExact = prediction.score_home !== null && prediction.score_away !== null
    && prediction.score_home === fixture.ft_home && prediction.score_away === fixture.ft_away
  if (isExact) return { pts: 3, isExact: true }
  if (prediction.pick === fixture.outcome) return { pts: 1, isExact: false }
  return { pts: 0, isExact: false }
}

export function FixtureCard({ fixture, prediction, groupPicks, onPick, onScoreChange, groupId, userId, reactions, lockMinutesBefore = 0 }: {
  fixture: Fixture
  prediction?: Prediction
  groupPicks?: GroupPrediction[]
  onPick: (matchId: number, pick: MatchPick) => void
  onScoreChange?: (matchId: number, home: number | null, away: number | null) => void
  groupId?: string
  userId?: string
  reactions?: ReactionSummary[]
  lockMinutesBefore?: number
}) {
  const { t } = useLocale()
  const [showReveals, setShowReveals] = useState(false)
  const currentPick = prediction?.pick
  const hasScore = fixture.ft_home !== null && fixture.ft_away !== null
  const isCorrect = fixture.status === 'finished' && fixture.outcome !== null && currentPick === fixture.outcome
  const isIncorrect = fixture.status === 'finished' && fixture.outcome !== null && !!currentPick && currentPick !== fixture.outcome
  const canReveal = !isBeforeKickoff(fixture.kickoff_at) && groupPicks && groupPicks.length > 0
  const { pts, isExact } = getPointsEarned(fixture, prediction)
  const pickLabel: Record<MatchPick, string> = { HOME: t('pick.home'), DRAW: 'X', AWAY: t('pick.away') }

  let cardCls = 'fx-card'
  if (fixture.status === 'live') cardCls += ' is-live'
  if (isExact) cardCls += ' exact'
  else if (isCorrect) cardCls += ' correct'
  if (isIncorrect) cardCls += ' incorrect'

  return (
    <div className={cardCls}>
      <div className="fx-top">
        <span className="grp">{fixture.stage === 'group' ? t('fx.groupStage') : fixture.stage.toUpperCase()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fixture.status === 'finished' && currentPick && (
            <span className={isExact ? 'chip chip-gold' : isCorrect ? 'chip chip-lime' : 'chip'}>
              {isExact ? t('fx.exactPts') : isCorrect ? t('fx.correctPt') : t('fx.wrongPts')}
            </span>
          )}
          <StatusPill fixture={fixture} />
        </div>
      </div>
      <div className="fx-main">
        <div className="fx-team">
          <FlagImg teamId={fixture.home_team_id} w={38} />
          <span className="tn">{fixture.home_team_name}</span>
        </div>
        <div className="fx-mid">
          {hasScore ? (
            <div className="fx-score">{fixture.ft_home} - {fixture.ft_away}</div>
          ) : (
            <div className="vs">{t('common.vs')}</div>
          )}
        </div>
        <div className="fx-team right">
          <FlagImg teamId={fixture.away_team_id} w={38} />
          <span className="tn">{fixture.away_team_name}</span>
        </div>
      </div>
      {prediction && prediction.score_home !== null && prediction.score_away !== null && !isBeforeLockTime(fixture.kickoff_at, lockMinutesBefore) && (
        <div className="fx-predicted-score">
          {t('fx.yourScore')} {prediction.score_home} - {prediction.score_away}
        </div>
      )}
      {fixture.status === 'scheduled' && isBeforeKickoff(fixture.kickoff_at) && (
        <div style={{ textAlign: 'center' }}>
          <CountdownLabel kickoffIso={fixture.kickoff_at} />
        </div>
      )}
      <div className="fx-pick-wrap">
        <PickSelector
          fixture={fixture}
          value={currentPick}
          onChange={(pick) => onPick(fixture.id, pick)}
          scoreHome={prediction?.score_home}
          scoreAway={prediction?.score_away}
          onScoreChange={onScoreChange ? (h, a) => onScoreChange(fixture.id, h, a) : undefined}
          lockMinutesBefore={lockMinutesBefore}
        />
      </div>

      {canReveal && (
        <div className="fx-reveals-wrap">
          <button className="btn-reveal" onClick={() => setShowReveals(v => !v)}>
            {showReveals ? t('fx.hidePredictions') : `${t('fx.showPredictions')} (${groupPicks!.length})`}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showReveals ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showReveals && (
            <div className="fx-reveals">
              {groupPicks!.map(gp => {
                const correct = fixture.outcome !== null && gp.pick === fixture.outcome
                const gpExact = fixture.ft_home !== null && fixture.ft_away !== null
                  && gp.score_home !== null && gp.score_away !== null
                  && gp.score_home === fixture.ft_home && gp.score_away === fixture.ft_away
                return (
                  <div key={gp.user_id} className={'fx-reveal-row' + (gpExact ? ' exact' : correct ? ' correct' : '')}>
                    <div className="reveal-name">{gp.display_name ?? t('fx.noName')}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {gp.score_home !== null && gp.score_away !== null && (
                        <span className="reveal-score">{gp.score_home}-{gp.score_away}</span>
                      )}
                      <span className={'chip' + (gpExact ? ' chip-gold' : correct ? ' chip-lime' : '')} style={{ fontSize: 11, padding: '3px 8px' }}>
                        {pickLabel[gp.pick as MatchPick]}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {groupId && userId && !isBeforeKickoff(fixture.kickoff_at) && (
        <ReactionBar matchId={fixture.id} groupId={groupId} userId={userId} reactions={reactions ?? []} />
      )}

      {(isCorrect || isExact) && (
        <div className={'fx-correct-badge' + (isExact ? ' exact' : '')}>
          {isExact ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          )}
        </div>
      )}
    </div>
  )
}
