import { formatLocalKickoff } from '../lib/date'
import { useLocale } from '../contexts/LocaleContext'
import type { Fixture } from '../lib/types'

export function StatusPill({ fixture }: { fixture: Fixture }) {
  const { t } = useLocale()
  if (fixture.status === 'live') return <span className="badge-live"><span className="dot" /> {t('status.live')}</span>
  if (fixture.status === 'finished') return <span className="chip" style={{ padding: '5px 10px' }}>{t('status.finished')}</span>
  return <span className="chip" style={{ padding: '5px 10px' }}>{formatLocalKickoff(fixture.kickoff_at)}</span>
}
