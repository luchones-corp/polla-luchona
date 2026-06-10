import { useMemo, useState } from 'react'
import { isBeforeKickoff } from '../lib/date'
import { FlagImg } from './FlagImg'
import { PickSelector } from './PickSelector'
import type { Fixture, MatchPick, Prediction } from '../lib/types'

export function PredictAllFlow({ fixtures, predictionsByMatch, onPick, onClose }: {
  fixtures: Fixture[]
  predictionsByMatch: Record<number, Prediction>
  onPick: (matchId: number, pick: MatchPick) => void
  onClose: () => void
}) {
  const unpredicted = useMemo(
    () => fixtures.filter(f => isBeforeKickoff(f.kickoff_at) && !predictionsByMatch[f.id]),
    [fixtures, predictionsByMatch],
  )

  const [index, setIndex] = useState(0)
  const [predicted, setPredicted] = useState(0)

  if (unpredicted.length === 0 || index >= unpredicted.length) {
    return (
      <div className="h2h-overlay" onClick={onClose}>
        <div className="card predict-all-card" onClick={e => e.stopPropagation()}>
          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 24, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
            {predicted > 0 ? '¡Listo!' : 'Sin partidos pendientes'}
          </h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, textAlign: 'center', marginBottom: 16 }}>
            {predicted > 0
              ? `Has predicho ${predicted} partido${predicted > 1 ? 's' : ''}.`
              : 'Ya predijiste todos los partidos disponibles.'
            }
          </p>
          <button className="btn btn-primary btn-block" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    )
  }

  const fixture = unpredicted[index]

  function handlePick(matchId: number, pick: MatchPick) {
    onPick(matchId, pick)
    setPredicted(p => p + 1)
    setTimeout(() => setIndex(i => i + 1), 400)
  }

  return (
    <div className="h2h-overlay" onClick={onClose}>
      <div className="card predict-all-card" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 20, textTransform: 'uppercase' }}>Predicción rápida</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="predict-all-progress">
          <div className="predict-all-bar">
            <div className="predict-all-fill" style={{ width: `${((index) / unpredicted.length) * 100}%` }} />
          </div>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 12, color: 'var(--ink-3)' }}>
            {index + 1} de {unpredicted.length}
          </span>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <span className="chip" style={{ marginBottom: 8 }}>
            {fixture.stage === 'group' ? 'Fase de grupos' : fixture.stage.toUpperCase()}
          </span>
        </div>

        <div className="fx-main" style={{ marginBottom: 16 }}>
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

        <PickSelector fixture={fixture} value={predictionsByMatch[fixture.id]?.pick} onChange={(pick) => handlePick(fixture.id, pick)} />

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setIndex(i => i + 1)}>
            Saltar →
          </button>
        </div>
      </div>
    </div>
  )
}
