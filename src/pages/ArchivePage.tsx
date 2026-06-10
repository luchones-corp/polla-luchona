import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getGroupArchive } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'
import { Avatar } from '../components/Avatar'
import type { GroupArchive } from '../lib/types'

export function ArchivePage() {
  const { groupId, season } = useParams<{ groupId: string; season: string }>()
  const navigate = useNavigate()
  const { locale, t } = useLocale()
  const [archive, setArchive] = useState<GroupArchive | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!groupId) return
    setLoading(true)
    getGroupArchive(groupId, season ?? '2026')
      .then(data => {
        setArchive(data)
        if (!data) setError(t('archive.notFound'))
      })
      .catch(err => setError(err instanceof Error ? err.message : t('archive.error')))
      .finally(() => setLoading(false))
  }, [groupId, season])

  if (loading) {
    return (
      <div className="shell">
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <p style={{ color: 'var(--ink-2)' }}>{t('archive.loading')}</p>
        </div>
      </div>
    )
  }

  if (error || !archive) {
    return (
      <div className="shell">
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div className="card fade-in" style={{ padding: 28, textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-2)', marginBottom: 16 }}>{error ?? t('archive.notFoundShort')}</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate(-1)}>{t('archive.back')}</button>
          </div>
        </div>
      </div>
    )
  }

  const standings = archive.final_standings
  const medals = ['', '\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']
  const dateFmt = locale === 'en' ? 'en' : 'es'

  return (
    <div className="shell">
      <div className="page" style={{ padding: '24px 16px', maxWidth: 600, margin: '0 auto' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t('archive.back')}
        </button>

        <div className="card fade-in" style={{ padding: 24, textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ fontFamily: 'var(--font-disp)', fontSize: 28, textTransform: 'uppercase', marginBottom: 4 }}>
            {t('archive.heading')} {archive.season}
          </h1>
          <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>
            {t('archive.archivedOn')} {new Date(archive.archived_at).toLocaleDateString(dateFmt, { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="card fade-in" style={{ padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{t('archive.finalStandings')}</h2>

          {standings.length >= 3 && (
            <div className="lb-podium" style={{ marginBottom: 20 }}>
              {[standings[1], standings[0], standings[2]].map((s, i) => {
                const rank = [2, 1, 3][i]
                const cls = ['p2', 'p1', 'p3'][i]
                return (
                  <div className={'podium-card ' + cls} key={s.user_id}>
                    <div className="rk">{rank}</div>
                    {rank === 1 && <div style={{ fontSize: 20 }}>{'\uD83D\uDC51'}</div>}
                    <Avatar name={s.display_name ?? '?'} size={rank === 1 ? 56 : 46} />
                    <div className="pname">{s.display_name ?? t('common.noName')}</div>
                    <div className="ppts tabnum">{s.points}<i> {t('tabla.pts')}</i></div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="lb-table">
            {standings.map((s, i) => (
              <div key={s.user_id} className="lb-row">
                <div className={'lb-rank' + (i < 3 ? ' top' : '')}>{i + 1}</div>
                <div className="lb-user">
                  <Avatar name={s.display_name ?? '?'} size={38} />
                  <div>
                    <div className="un">
                      {i < 3 && medals[i + 1]} {s.display_name ?? t('common.noName')}
                    </div>
                  </div>
                </div>
                <div className="lb-pts tabnum">
                  {s.points}<i>{t('tabla.pts')}</i>
                  {s.exact_count > 0 && <span className="lb-exact">{s.exact_count} {s.exact_count > 1 ? t('tabla.exacts') : t('tabla.exact')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card fade-in" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 800, marginBottom: 16 }}>{t('archive.stats')}</h2>
          <div className="profile-stats-grid">
            <div className="profile-stat">
              <span className="profile-stat-val">{archive.stats.total_members}</span>
              <span className="profile-stat-lbl">{t('archive.players')}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">{archive.stats.total_predictions}</span>
              <span className="profile-stat-lbl">{t('archive.predictions')}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">{standings[0]?.points ?? 0}</span>
              <span className="profile-stat-lbl">{t('archive.bestScore')}</span>
            </div>
            <div className="profile-stat">
              <span className="profile-stat-val">{standings[0]?.display_name ?? '-'}</span>
              <span className="profile-stat-lbl">{t('archive.champion')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
