import { FormEvent, useState } from 'react'
import { signIn, signInWithGoogle, signUp } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'

type AuthFormProps = {
  onDone: () => void
}

const FLAG_CODES = ['mx','br','ar','fr','de','es','us','jp','ma','nl','pt','kr','ca','au','gb-sct','cw']

export function AuthForm({ onDone }: AuthFormProps) {
  const { t } = useLocale()
  const [showEmail, setShowEmail] = useState(false)
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGoogle() {
    setError(null)
    setLoading(true)
    try {
      const { error: oauthError } = await signInWithGoogle()
      if (oauthError) throw oauthError
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : t('auth.error'))
      setLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    setError(null)

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await signUp(email, password)
        if (signUpError) throw signUpError
        setMessage(t('auth.signupSuccess'))
      } else {
        const { error: signInError } = await signIn(email, password)
        if (signInError) throw signInError
        onDone()
      }
    } catch (caughtError) {
      const nextMessage = caughtError instanceof Error ? caughtError.message : t('auth.error')
      setError(nextMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-stage">
      <div className="auth-art">
        <div className="brand">
          <div className="brand-mark"><span>LP</span></div>
          <div className="brand-txt"><b>{t('brand.name')}</b><em>{t('brand.subtitle')}</em></div>
        </div>
        <div>
          <div className="big-word">{t('auth.tagline1')}<br />{t('auth.tagline2')}<br /><span className="hl">{t('auth.tagline3')}</span></div>
          <p className="tagline">{t('auth.description')}</p>
        </div>
        <div>
          <div className="flag-strip" style={{ marginBottom: 26 }}>
            {FLAG_CODES.map((c) => (
              <img key={c} className="flag flag-ring" src={`https://flagcdn.com/w80/${c}.png`} alt="" width={38} height={26} style={{ borderRadius: 5 }} />
            ))}
          </div>
          <div className="art-foot">
            <div className="art-stat"><b>48</b><em>{t('auth.statTeams')}</em></div>
            <div className="art-stat"><b>104</b><em>{t('auth.statMatches')}</em></div>
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-box fade-in">
          <div className="brand" style={{ marginBottom: 26 }}>
            <div className="brand-mark"><span>LP</span></div>
            <div className="brand-txt"><b>{t('brand.name')}</b><em>{t('brand.subtitle')}</em></div>
          </div>

          <h1>{t('auth.signinHeading')}</h1>
          <p className="lead">{t('auth.signinDesc')}</p>

          <button
            className="btn btn-google btn-block"
            onClick={handleGoogle}
            disabled={loading}
            style={{ marginTop: 8 }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {t('auth.googleBtn')}
          </button>

          <div className="auth-divider">
            <span>{t('auth.orDivider')}</span>
          </div>

          {!showEmail ? (
            <button
              className="btn btn-ghost btn-block"
              onClick={() => setShowEmail(true)}
            >
              {t('auth.emailOption')}
            </button>
          ) : (
            <>
              <div className="seg-tabs">
                <button className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setError(null); setMessage(null) }}>
                  {t('auth.signinTab')}
                </button>
                <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(null); setMessage(null) }}>
                  {t('auth.signupTab')}
                </button>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="field">
                  <label>{t('auth.emailLabel')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailPlaceholder')}
                  />
                </div>
                <div className="field">
                  <label>{t('auth.passwordLabel')}</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? t('auth.loading') : mode === 'signin' ? t('auth.signinBtn') : t('auth.signupBtn')}
                </button>
              </form>
            </>
          )}

          {message && <p className="success-msg" style={{ marginTop: 14, textAlign: 'center' }}>{message}</p>}
          {error && <p className="error-msg" style={{ marginTop: 14, textAlign: 'center' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
