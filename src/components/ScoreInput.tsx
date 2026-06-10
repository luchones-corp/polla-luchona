import type { Fixture } from '../lib/types'

export function ScoreInput({ fixture, scoreHome, scoreAway, onChange, disabled }: {
  fixture: Fixture
  scoreHome: number | null
  scoreAway: number | null
  onChange: (home: number | null, away: number | null) => void
  disabled?: boolean
}) {
  function handleChange(side: 'home' | 'away', raw: string) {
    const val = raw === '' ? null : Math.max(0, Math.min(20, parseInt(raw, 10)))
    if (raw !== '' && isNaN(val as number)) return
    if (side === 'home') onChange(val, scoreAway)
    else onChange(scoreHome, val)
  }

  return (
    <div className="score-input-row">
      <span className="score-input-team">{fixture.home_team_name}</span>
      <input
        className="score-input"
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={scoreHome ?? ''}
        onChange={e => handleChange('home', e.target.value)}
        disabled={disabled}
        placeholder="-"
        aria-label={`Goles ${fixture.home_team_name}`}
      />
      <span className="score-input-sep">-</span>
      <input
        className="score-input"
        type="number"
        inputMode="numeric"
        min={0}
        max={20}
        value={scoreAway ?? ''}
        onChange={e => handleChange('away', e.target.value)}
        disabled={disabled}
        placeholder="-"
        aria-label={`Goles ${fixture.away_team_name}`}
      />
      <span className="score-input-team">{fixture.away_team_name}</span>
    </div>
  )
}
