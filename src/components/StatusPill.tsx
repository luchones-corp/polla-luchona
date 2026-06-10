import { formatLocalKickoff } from '../lib/date'
import type { Fixture } from '../lib/types'

export function StatusPill({ fixture }: { fixture: Fixture }) {
  if (fixture.status === 'live') return <span className="badge-live"><span className="dot" /> EN VIVO</span>
  if (fixture.status === 'finished') return <span className="chip" style={{ padding: '5px 10px' }}>FINAL</span>
  return <span className="chip" style={{ padding: '5px 10px' }}>{formatLocalKickoff(fixture.kickoff_at)}</span>
}
