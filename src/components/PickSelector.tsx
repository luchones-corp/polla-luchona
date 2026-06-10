import { isBeforeLockTime } from '../lib/date'
import { useLocale } from '../contexts/LocaleContext'
import { FlagImg } from './FlagImg'
import { ScoreInput } from './ScoreInput'
import type { Fixture, MatchPick } from '../lib/types'

export function PickSelector({ fixture, value, onChange, scoreHome, scoreAway, onScoreChange, lockMinutesBefore = 0 }: {
  fixture: Fixture
  value?: MatchPick
  onChange: (pick: MatchPick) => void
  scoreHome?: number | null
  scoreAway?: number | null
  onScoreChange?: (home: number | null, away: number | null) => void
  lockMinutesBefore?: number
}) {
  const { t } = useLocale()
  const locked = !isBeforeLockTime(fixture.kickoff_at, lockMinutesBefore)
  const opts: { key: MatchPick; label: string; teamId: number | null }[] = [
    { key: 'HOME', label: t('pick.home'), teamId: fixture.home_team_id },
    { key: 'DRAW', label: t('pick.draw'), teamId: null },
    { key: 'AWAY', label: t('pick.away'), teamId: fixture.away_team_id },
  ]

  function handleScoreChange(home: number | null, away: number | null) {
    onScoreChange?.(home, away)
    if (home !== null && away !== null) {
      const derived: MatchPick = home > away ? 'HOME' : home < away ? 'AWAY' : 'DRAW'
      if (derived !== value) onChange(derived)
    }
  }

  return (
    <div>
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
      {onScoreChange && !locked && (
        <ScoreInput
          fixture={fixture}
          scoreHome={scoreHome ?? null}
          scoreAway={scoreAway ?? null}
          onChange={handleScoreChange}
          disabled={locked}
        />
      )}
    </div>
  )
}
