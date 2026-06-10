import type { Fixture } from '../lib/types'

export function ScoreInput({ fixture, scoreHome, scoreAway, onChange, disabled }: {
  fixture: Fixture
  scoreHome: number | null
  scoreAway: number | null
  onChange: (home: number | null, away: number | null) => void
  disabled?: boolean
}) {
  function handleChange(side: 'home' | 'away', raw: string) {
    // Strip non-digits
    const digits = raw.replace(/\D/g, '')
    // Empty → null, otherwise take last digit typed (0-9)
    const val = digits === '' ? null : Math.min(Number(digits.slice(-1)), 9)
    if (side === 'home') onChange(val, scoreAway)
    else onChange(scoreHome, val)
  }

  return (
    <div className="score-input-row">
      <span className="score-input-team">{fixture.home_team_name}</span>
      <input
        className="score-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={1}
        value={scoreHome ?? ''}
        onChange={e => handleChange('home', e.target.value)}
        disabled={disabled}
        placeholder="-"
        aria-label={`${fixture.home_team_name} goals`}
      />
      <span className="score-input-sep">-</span>
      <input
        className="score-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={1}
        value={scoreAway ?? ''}
        onChange={e => handleChange('away', e.target.value)}
        disabled={disabled}
        placeholder="-"
        aria-label={`${fixture.away_team_name} goals`}
      />
      <span className="score-input-team">{fixture.away_team_name}</span>
    </div>
  )
}
