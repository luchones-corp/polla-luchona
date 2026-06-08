import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { AuthForm } from './components/AuthForm'
import { DisplayNameGate } from './components/DisplayNameGate'
import { missingSupabaseEnvVars, supabase } from './lib/supabase'
import { getProfileDisplayName } from './lib/api'
import { DashboardPage } from './pages/DashboardPage'
import { JoinGroupPage } from './pages/JoinGroupPage'

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  if (missingSupabaseEnvVars.length > 0) {
    return (
      <main className="center-page">
        <div className="card auth-card">
          <h2>Configuración pendiente</h2>
          <p>Faltan variables de entorno para conectar con Supabase:</p>
          <code>{missingSupabaseEnvVars.join(', ')}</code>
          <p className="hint">Crea `.env` desde `.env.example` y reinicia `npm run dev`.</p>
        </div>
      </main>
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
        const message = caughtError instanceof Error ? caughtError.message : 'No se pudo cargar la sesión'
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
        const message = caughtError instanceof Error ? caughtError.message : 'No se pudo cargar perfil'
        setError(message)
      }
    }

    void loadProfile()

    return () => {
      mounted = false
    }
  }, [session?.user.id])

  if (loading) {
    return <main className="center-page"><div className="card">Cargando aplicación...</div></main>
  }

  return (
    <Routes>
      <Route path="/join/:token" element={<JoinGroupPage session={session} />} />
      <Route
        path="/"
        element={
          !session ? (
            <main className="center-page">
              <AuthForm onDone={() => undefined} />
              {error && <p className="error">{error}</p>}
            </main>
          ) : !displayName ? (
            <main className="center-page">
              <DisplayNameGate userId={session.user.id} onSaved={(value) => setDisplayName(value)} />
              {error && <p className="error">{error}</p>}
            </main>
          ) : (
            <DashboardPage session={session} displayName={displayName} />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
