import { FormEvent, useState } from 'react'
import { signIn, signUp } from '../lib/api'

type AuthFormProps = {
  onDone: () => void
}

export function AuthForm({ onDone }: AuthFormProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await signUp(email, password)
        if (signUpError) throw signUpError
        setMessage('Cuenta creada. Revisa tu correo para confirmar si tu proyecto lo requiere.')
      } else {
        const { error: signInError } = await signIn(email, password)
        if (signInError) throw signInError
        onDone()
      }
    } catch (caughtError) {
      const nextMessage = caughtError instanceof Error ? caughtError.message : 'Error de autenticación'
      setError(nextMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card auth-card">
      <h1>Mundial 2026 - Polla</h1>
      <p>Inicia sesión o crea tu cuenta para empezar.</p>

      <form onSubmit={handleSubmit} className="stack-md">
        <label>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
          />
        </label>

        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Cargando...' : mode === 'signin' ? 'Entrar' : 'Crear cuenta'}
        </button>
      </form>

      <button
        className="ghost"
        onClick={() => {
          setMode(mode === 'signin' ? 'signup' : 'signin')
          setError(null)
          setMessage(null)
        }}
      >
        {mode === 'signin' ? '¿No tienes cuenta? Crear cuenta' : '¿Ya tienes cuenta? Iniciar sesión'}
      </button>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}
