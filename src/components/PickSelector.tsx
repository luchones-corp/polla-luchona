import { isBeforeKickoff } from '../lib/date'
import { FlagImg } from './FlagImg'
import type { Fixture, MatchPick } from '../lib/types'

export function PickSelector({ fixture, value, onChange }: { fixture: Fixture; value?: MatchPick; onChange: (pick: MatchPick) => void }) {
  const locked = !isBeforeKickoff(fixture.kickoff_at)
  const opts: { key: MatchPick; label: string; teamId: number | null }[] = [
    { key: 'HOME', label: 'Local', teamId: fixture.home_team_id },
    { key: 'DRAW', label: 'Empate', teamId: null },
    { key: 'AWAY', label: 'Visita', teamId: fixture.away_team_id },
  ]
  return (
    <div className={'pick-seg' + (locked ? ' locked' : '')}>
      {opts.map(o => {
        const sel = value === o.key
        let cls = 'pick-opt'
        if (sel) cls += ' sel'
        return (
          <button key={o.key} className={cls} disabled={locked} onClick={(e) => { e.stopPropagation(); if (!locked) onChange(o.key) }}>
            {o.teamId !== null
              ? <FlagImg teamId={o.teamId} w={24} />
              : <span className="draw-mark">X</span>}
            <span className="pick-lbl">{o.label}</span>
            {sel && !locked && <span className="pick-tick">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
