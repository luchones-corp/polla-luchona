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
    <div className="card fade-in" style={{ padding: 28, width: 'min(420px, 95vw)' }}>
      <div className="brand" style={{ marginBottom: 20 }}>
        <div className="brand-mark"><span>LP</span></div>
        <div className="brand-txt"><b>La Polla</b><em>Mundial 2026</em></div>
      </div>
      <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 26, textTransform: 'uppercase', marginBottom: 8 }}>
        Elige tu nombre
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 20 }}>
        Este nombre aparecerá en las tablas de posiciones de tus grupos.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Nombre de jugador</label>
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="ej. tu_apodo"
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading} type="submit" style={{ marginTop: 8 }}>
          {loading ? 'Guardando...' : 'Guardar y jugar'}
        </button>
      </form>
      {error && <p className="error-msg" style={{ marginTop: 12, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}
