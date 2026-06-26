import { useEffect, useState } from 'react'
import { isBeforeKickoff, isBeforeLockTime } from '../lib/date'
import { formatCountdown } from '../lib/countdown'
import { useLocale } from '../contexts/LocaleContext'
import { FlagImg } from './FlagImg'
import { StatusPill } from './StatusPill'
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
  if (isExact) return { pts: 2, isExact: true }
  if (prediction.pick === fixture.outcome) return { pts: 1, isExact: false }
  return { pts: 0, isExact: false }
}

function ScoreStepper({ value, onChange, disabled }: {
  value: number | null
  onChange: (v: number | null) => void
  disabled?: boolean
}) {
  function step(d: number) {
    if (disabled) return
    const cur = value ?? 0
    const next = cur + d
    if (next < 0) return
    if (next > 9) return
    onChange(next)
  }

  return (
    <div className={'stepper' + (value === null ? ' empty' : '')} onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => step(-1)} disabled={disabled} aria-label="minus">&minus;</button>
      <span className="stepper-val">{value ?? '\u00B7'}</span>
      <button type="button" onClick={() => step(1)} disabled={disabled} aria-label="plus">+</button>
    </div>
  )
}

export function FixtureCard({ fixture, prediction, groupPicks, onPick, onScoreChange, groupId, userId, reactions, lockMinutesBefore = 0, hideGroupTag = false }: {
  fixture: Fixture
  prediction?: Prediction
  groupPicks?: GroupPrediction[]
  onPick: (matchId: number, pick: MatchPick) => void
  onScoreChange?: (matchId: number, home: number | null, away: number | null) => void
  groupId?: string
  userId?: string
  reactions?: ReactionSummary[]
  lockMinutesBefore?: number
  hideGroupTag?: boolean
}) {
  const { t } = useLocale()
  const [showReveals, setShowReveals] = useState(false)
  const isFinished = fixture.status === 'finished'
  const [collapsed, setCollapsed] = useState(isFinished)
  const currentPick = prediction?.pick
  const hasScore = fixture.ft_home !== null && fixture.ft_away !== null
  const isCorrect = isFinished && fixture.outcome !== null && currentPick === fixture.outcome
  const isIncorrect = isFinished && fixture.outcome !== null && !!currentPick && currentPick !== fixture.outcome
  const canReveal = !isBeforeKickoff(fixture.kickoff_at) && groupPicks && groupPicks.length > 0
  const { pts, isExact } = getPointsEarned(fixture, prediction)
  const locked = !isBeforeLockTime(fixture.kickoff_at, lockMinutesBefore)
  const pickLabel: Record<MatchPick, string> = { HOME: t('pick.home'), DRAW: 'X', AWAY: t('pick.away') }

  let cardCls = 'mc'
  if (fixture.status === 'live') cardCls += ' is-live'
  if (isExact) cardCls += ' exact'
  else if (isCorrect) cardCls += ' correct'
  if (isIncorrect) cardCls += ' incorrect'
  if (collapsed) cardCls += ' mc-collapsed'

  function handleRowClick(pick: MatchPick) {
    if (locked) return
    onPick(fixture.id, pick)
  }

  function handleScoreHome(v: number | null) {
    const away = prediction?.score_away ?? (v !== null ? 0 : null)
    onScoreChange?.(fixture.id, v, away)
  }

  function handleScoreAway(v: number | null) {
    const home = prediction?.score_home ?? (v !== null ? 0 : null)
    onScoreChange?.(fixture.id, home, v)
  }

  const pickLabelShort: Record<MatchPick, string> = { HOME: fixture.home_team_name ?? t('pick.home'), DRAW: t('pick.draw'), AWAY: fixture.away_team_name ?? t('pick.away') }

  return (
    <div className={cardCls}>
      {/* header */}
      <div className="mc-head" onClick={isFinished ? () => setCollapsed(c => !c) : undefined} style={isFinished ? { cursor: 'pointer' } : undefined}>
        <span className="mc-grp">
          {!hideGroupTag && fixture.stage === 'group' && fixture.group_label && (
            <><span className="mc-gtag">{t('partidos.groupLabel')} {fixture.group_label}</span><span className="mc-dot" /></>
          )}
          {fixture.stage === 'group' ? t('fx.groupStage') : fixture.stage.toUpperCase()}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isFinished && currentPick && (
            <span className={isExact ? 'chip chip-gold' : isCorrect ? 'chip chip-lime' : 'chip'}>
              {isExact ? t('fx.exactPts') : isCorrect ? t('fx.correctPt') : t('fx.wrongPts')}
            </span>
          )}
          {fixture.status === 'scheduled' && isBeforeKickoff(fixture.kickoff_at) && (
            <CountdownLabel kickoffIso={fixture.kickoff_at} />
          )}
          <StatusPill fixture={fixture} />
          {isFinished && (
            <svg className="mc-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform .2s', flexShrink: 0 }}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      </div>

      {/* collapsed summary for finished matches */}
      {collapsed && isFinished ? (
        <div className="mc-summary" onClick={() => setCollapsed(false)}>
          <div className="mc-summary-score">
            <FlagImg teamId={fixture.home_team_id} w={20} />
            <span className="mc-summary-team">{fixture.home_team_name}</span>
            <span className="mc-fs-val">{fixture.ft_home}</span>
            <span className="mc-fs-dash">&ndash;</span>
            <span className="mc-fs-val">{fixture.ft_away}</span>
            <span className="mc-summary-team">{fixture.away_team_name}</span>
            <FlagImg teamId={fixture.away_team_id} w={20} />
          </div>
          {currentPick && (
            <div className="mc-summary-pick">
              {t('fx.yourPick')}: <span className={isExact ? 'txt-gold' : isCorrect ? 'txt-lime' : 'txt-muted'}>{pickLabelShort[currentPick]}</span>
              {prediction?.score_home != null && prediction?.score_away != null && (
                <span className="mc-summary-pscore">({prediction.score_home}-{prediction.score_away})</span>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* final score banner for finished matches */}
          {hasScore && (
            <div className="mc-final-score">
              <FlagImg teamId={fixture.home_team_id} w={22} />
              <span className="mc-fs-val">{fixture.ft_home}</span>
              <span className="mc-fs-dash">&ndash;</span>
              <span className="mc-fs-val">{fixture.ft_away}</span>
              <FlagImg teamId={fixture.away_team_id} w={22} />
            </div>
          )}

          {/* tap-a-team rows */}
          <div className="rows">
            <button
              type="button"
              className={'trow' + (currentPick === 'HOME' ? ' sel' : '')}
              onClick={() => handleRowClick('HOME')}
              disabled={locked}
            >
              <span className="trow-id">
                <FlagImg teamId={fixture.home_team_id} w={34} />
                <span className="trow-name">{fixture.home_team_name}</span>
              </span>
              {onScoreChange && !locked && (
                <ScoreStepper value={prediction?.score_home ?? null} onChange={handleScoreHome} disabled={locked} />
              )}
              {locked && prediction?.score_home != null && (
                <span className="trow-locked-score">{prediction.score_home}</span>
              )}
              <span className="pickdot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </button>

            <div className="draw-strip">
              <span className="draw-ln" />
              <button
                type="button"
                className={'draw-btn' + (currentPick === 'DRAW' ? ' sel' : '')}
                onClick={() => handleRowClick('DRAW')}
                disabled={locked}
              >
                <span className="draw-xm">{'\u2715'}</span> {t('pick.draw')}
              </button>
              <span className="draw-ln" />
            </div>

            <button
              type="button"
              className={'trow' + (currentPick === 'AWAY' ? ' sel' : '')}
              onClick={() => handleRowClick('AWAY')}
              disabled={locked}
            >
              <span className="trow-id">
                <FlagImg teamId={fixture.away_team_id} w={34} />
                <span className="trow-name">{fixture.away_team_name}</span>
              </span>
              {onScoreChange && !locked && (
                <ScoreStepper value={prediction?.score_away ?? null} onChange={handleScoreAway} disabled={locked} />
              )}
              {locked && prediction?.score_away != null && (
                <span className="trow-locked-score">{prediction.score_away}</span>
              )}
              <span className="pickdot">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
            </button>
          </div>

          {/* group prediction reveals */}
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

          {/* reactions */}
          {groupId && userId && !isBeforeKickoff(fixture.kickoff_at) && (
            <ReactionBar matchId={fixture.id} groupId={groupId} userId={userId} reactions={reactions ?? []} />
          )}
        </>
      )}

      {/* correct badge */}
      {(isCorrect || isExact) && (
        <div className={'mc-badge' + (isExact ? ' exact' : '')}>
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
