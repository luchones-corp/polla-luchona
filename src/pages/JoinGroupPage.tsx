import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { getGroupByInviteToken, joinGroupByToken } from '../lib/api'
import { AuthForm } from '../components/AuthForm'

type JoinGroupPageProps = {
  session: Session | null
}

export function JoinGroupPage({ session }: JoinGroupPageProps) {
  const { token = '' } = useParams()
  const [groupName, setGroupName] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const group = await getGroupByInviteToken(token)
        if (!mounted) return
        if (!group) {
          setError('Este enlace de invitación ya no es válido.')
        } else {
          setGroupName(group.name)
          setGroupId(group.id)
        }
      } catch (caughtError) {
        if (!mounted) return
        const message = caughtError instanceof Error ? caughtError.message : 'No se pudo validar el enlace'
        setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void load()

    return () => {
      mounted = false
    }
  }, [token])

  async function handleJoin() {
    setError(null)
    try {
      await joinGroupByToken(token)
      setJoined(true)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo unir al grupo'
      setError(message)
    }
  }

  if (loading) {
    return <div className="card">Validando enlace...</div>
  }

  if (!session) {
    return (
      <main className="center-page">
        <AuthForm onDone={() => undefined} />
        <p className="hint">Después de iniciar sesión podrás unirte al grupo.</p>
      </main>
    )
  }

  return (
    <main className="center-page">
      <div className="card auth-card">
        <h2>Invitación a grupo</h2>
        {groupName && <p>Te invitaron a <strong>{groupName}</strong>.</p>}

        {!joined ? (
          <button onClick={() => void handleJoin()} disabled={!groupId}>Unirme al grupo</button>
        ) : (
          <>
            <p className="success">¡Listo! Ya eres miembro del grupo.</p>
            <Link to="/">Ir al dashboard</Link>
          </>
        )}

        {error && <p className="error">{error}</p>}
      </div>
    </main>
  )
}
