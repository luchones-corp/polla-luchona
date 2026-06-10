import { useEffect, useState } from 'react'
import { isBeforeKickoff } from '../lib/date'
import { formatCountdown } from '../lib/countdown'
import { FlagImg } from './FlagImg'
import { StatusPill } from './StatusPill'
import { PickSelector } from './PickSelector'
import type { Fixture, GroupPrediction, MatchPick } from '../lib/types'

const pickLabel: Record<MatchPick, string> = { HOME: 'Local', DRAW: 'X', AWAY: 'Visita' }

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

export function FixtureCard({ fixture, currentPick, groupPicks, onPick }: {
  fixture: Fixture
  currentPick?: MatchPick
  groupPicks?: GroupPrediction[]
  onPick: (matchId: number, pick: MatchPick) => void
}) {
  const [showReveals, setShowReveals] = useState(false)
  const hasScore = fixture.ft_home !== null && fixture.ft_away !== null
  const isCorrect = fixture.status === 'finished' && fixture.outcome !== null && currentPick === fixture.outcome
  const isIncorrect = fixture.status === 'finished' && fixture.outcome !== null && !!currentPick && currentPick !== fixture.outcome
  const canReveal = !isBeforeKickoff(fixture.kickoff_at) && groupPicks && groupPicks.length > 0

  let cardCls = 'fx-card'
  if (fixture.status === 'live') cardCls += ' is-live'
  if (isCorrect) cardCls += ' correct'
  if (isIncorrect) cardCls += ' incorrect'

  return (
    <div className={cardCls}>
      <div className="fx-top">
        <span className="grp">{fixture.stage === 'group' ? 'Fase de grupos' : fixture.stage.toUpperCase()}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {fixture.status === 'finished' && currentPick && (
            <span className={isCorrect ? 'chip chip-lime' : 'chip'}>{isCorrect ? '+1 pt' : '+0 pts'}</span>
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
            <div className="vs">VS</div>
          )}
        </div>
        <div className="fx-team right">
          <FlagImg teamId={fixture.away_team_id} w={38} />
          <span className="tn">{fixture.away_team_name}</span>
        </div>
      </div>
      {fixture.status === 'scheduled' && isBeforeKickoff(fixture.kickoff_at) && (
        <div style={{ textAlign: 'center' }}>
          <CountdownLabel kickoffIso={fixture.kickoff_at} />
        </div>
      )}
      <div className="fx-pick-wrap">
        <PickSelector fixture={fixture} value={currentPick} onChange={(pick) => onPick(fixture.id, pick)} />
      </div>

      {canReveal && (
        <div className="fx-reveals-wrap">
          <button className="btn-reveal" onClick={() => setShowReveals(v => !v)}>
            {showReveals ? 'Ocultar predicciones' : `Ver predicciones (${groupPicks!.length})`}
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: showReveals ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {showReveals && (
            <div className="fx-reveals">
              {groupPicks!.map(gp => {
                const correct = fixture.outcome !== null && gp.pick === fixture.outcome
                return (
                  <div key={gp.user_id} className={'fx-reveal-row' + (correct ? ' correct' : '')}>
                    <div className="reveal-name">{gp.display_name ?? 'Sin nombre'}</div>
                    <span className={'chip' + (correct ? ' chip-lime' : '')} style={{ fontSize: 11, padding: '3px 8px' }}>
                      {pickLabel[gp.pick as MatchPick]}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {isCorrect && (
        <div className="fx-correct-badge">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
      )}
    </div>
  )
}
