import { useState } from 'react'
import { createPortal } from 'react-dom'
import { isBeforeKickoff } from '../lib/date'
import { useLocale } from '../contexts/LocaleContext'
import { FlagImg } from './FlagImg'
import type { Fixture, MatchPick, Prediction } from '../lib/types'

function ScoreStepper({ value, onChange }: {
  value: number | null
  onChange: (v: number | null) => void
}) {
  function step(d: number) {
    const cur = value ?? 0
    const next = cur + d
    if (next < 0 || next > 9) return
    onChange(next)
  }

  return (
    <div className={'stepper' + (value === null ? ' empty' : '')} onClick={e => e.stopPropagation()}>
      <button type="button" onClick={() => step(-1)} aria-label="minus">&minus;</button>
      <span className="stepper-val">{value ?? '\u00B7'}</span>
      <button type="button" onClick={() => step(1)} aria-label="plus">+</button>
    </div>
  )
}

export function PredictAllFlow({ fixtures, predictionsByMatch, onPick, onScoreChange, onClose }: {
  fixtures: Fixture[]
  predictionsByMatch: Record<number, Prediction>
  onPick: (matchId: number, pick: MatchPick) => void
  onScoreChange: (matchId: number, home: number | null, away: number | null) => void
  onClose: () => void
}) {
  const { t } = useLocale()
  const [unpredicted] = useState(
    () => fixtures.filter(f => isBeforeKickoff(f.kickoff_at) && !predictionsByMatch[f.id]),
  )

  const [index, setIndex] = useState(0)
  const [predicted, setPredicted] = useState(0)
  const [localPicks, setLocalPicks] = useState<Record<number, MatchPick>>({})
  const [localScores, setLocalScores] = useState<Record<number, { home: number | null; away: number | null }>>({})

  if (unpredicted.length === 0 || index >= unpredicted.length) {
    return createPortal(
      <div className="h2h-overlay" onClick={onClose}>
        <div className="card predict-all-card" onClick={e => e.stopPropagation()}>
          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 24, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
            {predicted > 0 ? t('predictAll.done') : t('predictAll.noMatches')}
          </h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
            {predicted > 0
              ? `${t('predictAll.predicted')} ${predicted} ${predicted > 1 ? t('predictAll.matches') : t('predictAll.match')}.`
              : t('predictAll.alreadyDone')
            }
          </p>
          <button className="btn btn-primary btn-block" onClick={onClose}>{t('predictAll.close')}</button>
        </div>
      </div>,
      document.body,
    )
  }

  const fixture = unpredicted[index]
  const currentPick = localPicks[fixture.id] ?? predictionsByMatch[fixture.id]?.pick
  const scores = localScores[fixture.id] ?? { home: null, away: null }
  const hasPick = !!currentPick

  function handlePick(pick: MatchPick) {
    setLocalPicks(p => ({ ...p, [fixture.id]: pick }))
    onPick(fixture.id, pick)
    if (!hasPick) setPredicted(p => p + 1)
  }

  function handleScoreHome(v: number | null) {
    const newScores = { home: v, away: scores.away }
    setLocalScores(s => ({ ...s, [fixture.id]: newScores }))
    onScoreChange(fixture.id, v, scores.away)
  }

  function handleScoreAway(v: number | null) {
    const newScores = { home: scores.home, away: v }
    setLocalScores(s => ({ ...s, [fixture.id]: newScores }))
    onScoreChange(fixture.id, scores.home, v)
  }

  function handleNext() {
    setIndex(i => i + 1)
  }

  return createPortal(
    <div className="h2h-overlay" onClick={onClose}>
      <div className="card predict-all-card" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 20, textTransform: 'uppercase' }}>{t('predictAll.title')}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>{'\u2715'}</button>
        </div>

        <div className="predict-all-progress">
          <div className="predict-all-bar">
            <div className="predict-all-fill" style={{ width: `${((index) / unpredicted.length) * 100}%` }} />
          </div>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' }}>
            {index + 1} {t('predictAll.of')} {unpredicted.length}
          </span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span className="chip" style={{ marginBottom: 8 }}>
            {fixture.stage === 'group' ? t('fx.groupStage') : fixture.stage.toUpperCase()}
          </span>
        </div>

        <div className="rows">
          <button
            type="button"
            className={'trow' + (currentPick === 'HOME' ? ' sel' : '')}
            onClick={() => handlePick('HOME')}
          >
            <span className="trow-id">
              <FlagImg teamId={fixture.home_team_id} w={34} />
              <span className="trow-name">{fixture.home_team_name}</span>
            </span>
            <ScoreStepper value={scores.home} onChange={handleScoreHome} />
            <span className="pickdot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>

          <div className="draw-strip">
            <span className="draw-ln" />
            <button
              type="button"
              className={'draw-btn' + (currentPick === 'DRAW' ? ' sel' : '')}
              onClick={() => handlePick('DRAW')}
            >
              <span className="draw-xm">{'\u2715'}</span> {t('pick.draw')}
            </button>
            <span className="draw-ln" />
          </div>

          <button
            type="button"
            className={'trow' + (currentPick === 'AWAY' ? ' sel' : '')}
            onClick={() => handlePick('AWAY')}
          >
            <span className="trow-id">
              <FlagImg teamId={fixture.away_team_id} w={34} />
              <span className="trow-name">{fixture.away_team_name}</span>
            </span>
            <ScoreStepper value={scores.away} onChange={handleScoreAway} />
            <span className="pickdot">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={handleNext}>
            {t('predictAll.skip')}
          </button>
          {hasPick && (
            <button className="btn btn-primary btn-sm" onClick={handleNext}>
              {t('predictAll.next')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
