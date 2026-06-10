import { useEffect, useState } from 'react'
import { getTodayMatchEvents } from '../lib/api'
import { formatCountdown } from '../lib/countdown'
import { useLocale } from '../contexts/LocaleContext'
import { FlagImg } from './FlagImg'
import { useRealtimeMatchEvents } from '../hooks/useRealtimeMatchEvents'
import type { Fixture, MatchEvent } from '../lib/types'

const EVENT_ICONS: Record<string, string> = {
  goal: '\u26BD',
  kickoff: '\uD83D\uDFE2',
  halftime: '\u23F8\uFE0F',
  fulltime: '\uD83C\uDFC1',
  red_card: '\uD83D\uDFE5',
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function LiveFeedView({ fixtures }: { fixtures: Fixture[] }) {
  const { t } = useLocale()
  const [initialEvents, setInitialEvents] = useState<MatchEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    getTodayMatchEvents()
      .then(d => { if (mounted) setInitialEvents(d) })
      .catch(() => {})
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const events = useRealtimeMatchEvents(initialEvents)

  const liveMatches = fixtures.filter(f => f.status === 'live')
  const todayFinished = fixtures.filter(f => {
    if (f.status !== 'finished') return false
    const d = new Date(f.kickoff_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  })
  const upcomingToday = fixtures.filter(f => {
    if (f.status !== 'scheduled') return false
    const d = new Date(f.kickoff_at)
    const now = new Date()
    return d.toDateString() === now.toDateString() && d.getTime() > now.getTime()
  }).sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())

  const fixtureMap = new Map(fixtures.map(f => [f.id, f]))

  const nextMatch = fixtures
    .filter(f => f.status === 'scheduled' && new Date(f.kickoff_at).getTime() > Date.now())
    .sort((a, b) => new Date(a.kickoff_at).getTime() - new Date(b.kickoff_at).getTime())[0]

  return (
    <div className="wrap fade-in">
      <div className="sec-head">
        <h2>{t('live.heading')}</h2>
        {liveMatches.length > 0 && <span className="badge-live">{t('live.badge')}</span>}
      </div>

      {liveMatches.length > 0 && (
        <div className="live-now-section">
          {liveMatches.map(f => (
            <div key={f.id} className="card live-match-card">
              <div className="live-match-teams">
                <div className="live-match-team">
                  <FlagImg teamId={f.home_team_id} w={30} />
                  <span>{f.home_team_name}</span>
                </div>
                <div className="live-match-score">{f.ft_home ?? 0} - {f.ft_away ?? 0}</div>
                <div className="live-match-team right">
                  <FlagImg teamId={f.away_team_id} w={30} />
                  <span>{f.away_team_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {upcomingToday.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 className="live-section-title">{t('live.upcoming')}</h3>
          <div className="live-upcoming-list">
            {upcomingToday.map(f => (
              <div key={f.id} className="card live-upcoming-row">
                <div className="live-upcoming-teams">
                  <FlagImg teamId={f.home_team_id} w={22} />
                  <span className="live-upcoming-name">{f.home_team_name}</span>
                  <span className="live-upcoming-vs">vs</span>
                  <span className="live-upcoming-name">{f.away_team_name}</span>
                  <FlagImg teamId={f.away_team_id} w={22} />
                </div>
                <span className="countdown">{formatCountdown(f.kickoff_at) ?? t('live.soon')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {todayFinished.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 className="live-section-title">{t('live.finished')}</h3>
          <div className="live-upcoming-list">
            {todayFinished.map(f => (
              <div key={f.id} className="card live-upcoming-row">
                <div className="live-upcoming-teams">
                  <FlagImg teamId={f.home_team_id} w={22} />
                  <span className="live-upcoming-name">{f.home_team_name}</span>
                  <span className="live-upcoming-score">{f.ft_home} - {f.ft_away}</span>
                  <span className="live-upcoming-name">{f.away_team_name}</span>
                  <FlagImg teamId={f.away_team_id} w={22} />
                </div>
                <span className="chip" style={{ fontSize: 10 }}>{t('live.final')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3 className="live-section-title">{t('live.timeline')}</h3>
      {loading ? (
        <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 24 }}>{t('live.loadingEvents')}</p>
      ) : events.length === 0 ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ color: 'var(--ink-2)', marginBottom: 8 }}>
            {liveMatches.length === 0 ? t('live.noLive') : t('live.noEvents')}
          </p>
          {nextMatch && (
            <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
              {t('live.nextMatch')} {nextMatch.home_team_name} vs {nextMatch.away_team_name} — {formatCountdown(nextMatch.kickoff_at) ?? t('live.soon')}
            </p>
          )}
        </div>
      ) : (
        <div className="live-timeline">
          {events.map(ev => {
            const f = fixtureMap.get(ev.match_id)
            return (
              <div key={ev.id} className={`live-event live-event-${ev.event_type}`}>
                <div className="live-event-time">{formatEventTime(ev.created_at)}</div>
                <div className="live-event-icon">{EVENT_ICONS[ev.event_type] ?? '\u26A1'}</div>
                <div className="live-event-body">
                  <div className="live-event-desc">{ev.description}</div>
                  {f && (
                    <div className="live-event-match">
                      <FlagImg teamId={f.home_team_id} w={14} />
                      <span>{f.home_team_name} vs {f.away_team_name}</span>
                      <FlagImg teamId={f.away_team_id} w={14} />
                      {ev.minute !== null && <span className="live-event-min">{ev.minute}'</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
