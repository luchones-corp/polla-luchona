import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthForm } from './components/AuthForm'
import { DisplayNameGate } from './components/DisplayNameGate'
import { missingSupabaseEnvVars, supabase } from './lib/supabase'
import { getProfileDisplayName } from './lib/api'
import { useLocale } from './contexts/LocaleContext'
import { DashboardPage } from './pages/DashboardPage'
import { JoinGroupPage } from './pages/JoinGroupPage'
import { ArchivePage } from './pages/ArchivePage'
import { ProfilePage } from './pages/ProfilePage'
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/react"

export function App() {
  const { t } = useLocale()
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (missingSupabaseEnvVars.length > 0) {
    return (
      <>
        <div className="stage-bg" />
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <div className="card" style={{ padding: 24, maxWidth: 420 }}>
            <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 24, textTransform: 'uppercase', marginBottom: 12 }}>
              {t('app.configPending')}
            </h2>
            <p style={{ color: 'var(--ink-2)', marginBottom: 12 }}>{t('app.configDesc')}</p>
            <code style={{ display: 'block', padding: 12, borderRadius: 8, background: 'var(--bg-2)', border: '1px solid var(--line)', marginBottom: 12 }}>
              {missingSupabaseEnvVars.join(', ')}
            </code>
            <p style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('app.configHint')}</p>
          </div>
        </div>
      </>
    )
  }

  useEffect(() => {
    let mounted = true

    async function bootstrap() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
      } catch (caughtError) {
        if (!mounted) return
        const message = caughtError instanceof Error ? caughtError.message : t('app.sessionError')
        setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void bootstrap()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadProfile() {
      if (!session) {
        setDisplayName(null)
        return
      }

      try {
        const nextDisplayName = await getProfileDisplayName(session.user.id)
        if (!mounted) return
        setDisplayName(nextDisplayName)
      } catch (caughtError) {
        if (!mounted) return
        const message = caughtError instanceof Error ? caughtError.message : t('app.profileError')
        setError(message)
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [session?.user.id])

  if (loading) {
    return (
      <>
        <div className="stage-bg" />
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, color: 'var(--ink-2)' }}>{t('app.loading')}</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="stage-bg" />
      <Routes>
        <Route path="/join/:token" element={<JoinGroupPage session={session} />} />
        <Route
          path="/profile/:userId"
          element={
            session ? (
              <ProfilePage session={session} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            !session ? (
              <AuthForm onDone={() => undefined} />
            ) : !displayName ? (
              <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '1rem' }}>
                <DisplayNameGate userId={session.user.id} onSaved={(value) => setDisplayName(value)} />
                {error && <p className="error-msg">{error}</p>}
              </div>
            ) : (
              <DashboardPage session={session} displayName={displayName} />
            )
          }
        />
        <Route
          path="/archive/:groupId/:season"
          element={
            session ? <ArchivePage /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/archive/:groupId"
          element={
            session ? <ArchivePage /> : <Navigate to="/" replace />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
