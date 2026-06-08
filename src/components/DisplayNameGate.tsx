import { FormEvent, useState } from 'react'
import { saveDisplayName } from '../lib/api'

type DisplayNameGateProps = {
  userId: string
  onSaved: (displayName: string) => void
}

export function DisplayNameGate({ userId, onSaved }: DisplayNameGateProps) {
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError('Tu nombre para mostrar es obligatorio.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await saveDisplayName(userId, trimmed)
      onSaved(trimmed)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'No se pudo guardar el nombre'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card auth-card">
      <h2>Elige tu nombre para mostrar</h2>
      <p>Este nombre aparecerá en las tablas de posiciones de tus grupos.</p>
      <form onSubmit={handleSubmit} className="stack-md">
        <label>
          Nombre
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Tu apodo"
          />
        </label>
        <button disabled={loading} type="submit">
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
