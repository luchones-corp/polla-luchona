import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { getGroupByInviteToken, getProfileDisplayName, joinGroupByToken } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'
import { AuthForm } from '../components/AuthForm'
import { DisplayNameGate } from '../components/DisplayNameGate'

type JoinGroupPageProps = {
  session: Session | null
}

export function JoinGroupPage({ session }: JoinGroupPageProps) {
  const { token = '' } = useParams()
  const { t } = useLocale()
  const [groupName, setGroupName] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }

    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [group, name] = await Promise.all([
          getGroupByInviteToken(token),
          getProfileDisplayName(session!.user.id),
        ])
        if (!mounted) return
        if (!group) {
          setError(t('join.invalidLink'))
        } else {
          setGroupName(group.name)
          setGroupId(group.id)
        }
        setDisplayName(name)
      } catch (caughtError) {
        if (!mounted) return
        const message = caughtError instanceof Error ? caughtError.message : t('join.validationError')
        setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()
    return () => { mounted = false }
  }, [token, session])

  async function handleJoin() {
    setError(null)
    try {
      await joinGroupByToken(token)
      setJoined(true)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('join.joinError')
      setError(message)
    }
  }

  if (!session) {
    return <AuthForm onDone={() => undefined} />
  }

  if (loading) {
    return (
      <>
        <div className="stage-bg" />
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, color: 'var(--ink-2)' }}>{t('join.validating')}</p>
        </div>
      </>
    )
  }

  if (!displayName) {
    return (
      <>
        <div className="stage-bg" />
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div>
            <DisplayNameGate
              userId={session.user.id}
              onSaved={(value) => setDisplayName(value)}
            />
            {groupName && (
              <p style={{ textAlign: 'center', color: 'var(--ink-2)', fontSize: 14, marginTop: 14 }}>
                {t('join.afterSetup')} <strong style={{ color: 'var(--ink-1)' }}>{groupName}</strong>.
              </p>
            )}
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="stage-bg" />
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
        <div className="card fade-in" style={{ padding: 28, width: 'min(420px, 95vw)', textAlign: 'center' }}>
          <div className="brand" style={{ marginBottom: 20, justifyContent: 'center' }}>
            <div className="brand-mark"><span>LP</span></div>
            <div className="brand-txt"><b>{t('brand.name')}</b><em>{t('brand.subtitle')}</em></div>
          </div>

          {groupName && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center',
              marginBottom: 20, padding: '14px 18px', borderRadius: 12,
              background: 'var(--bg-2)', border: '1px solid var(--line)',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, background: 'var(--lime)',
                color: '#0a0d10', display: 'grid', placeItems: 'center',
                fontFamily: 'var(--font-disp)', fontSize: 17, transform: 'skewX(-6deg)', flexShrink: 0,
              }}>
                <span style={{ transform: 'skewX(6deg)' }}>🏆</span>
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontFamily: 'var(--font-disp)', fontSize: 18, textTransform: 'uppercase' }}>{groupName}</h3>
                <div style={{ color: 'var(--ink-3)', fontSize: 12, fontWeight: 600 }}>{t('brand.subtitle')}</div>
              </div>
            </div>
          )}

          <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 24, textTransform: 'uppercase', marginBottom: 8 }}>
            {t('join.heading')}
          </h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 20 }}>
            {t('join.desc')}
          </p>

          {!joined ? (
            <button
              className="btn btn-primary btn-block"
              onClick={() => void handleJoin()}
              disabled={!groupId}
            >
              {t('join.btn')}
            </button>
          ) : (
            <>
              <div style={{
                padding: '14px 18px', borderRadius: 10,
                background: 'rgba(198,255,50,.08)', border: '1px solid rgba(198,255,50,.2)',
                marginBottom: 14,
              }}>
                <p style={{ color: 'var(--lime)', fontWeight: 700, fontSize: 15 }}>
                  {t('join.success')}
                </p>
              </div>
              <Link to="/" className="btn btn-primary btn-block" style={{ textDecoration: 'none', display: 'block' }}>
                {t('join.goToDash')}
              </Link>
            </>
          )}

          {error && <p className="error-msg" style={{ marginTop: 14 }}>{error}</p>}
        </div>
      </div>
    </>
  )
}
