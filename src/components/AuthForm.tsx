import { FormEvent, useState } from 'react'
import { signIn, signUp } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'

type AuthFormProps = {
  onDone: () => void
}

const FLAG_CODES = ['mx','br','ar','fr','de','es','us','jp','ma','nl','pt','kr','ca','au','gb-sct','cw']

export function AuthForm({ onDone }: AuthFormProps) {
  const { t } = useLocale()
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

          <div className="seg-tabs">
            <button className={mode === 'signin' ? 'on' : ''} onClick={() => { setMode('signin'); setError(null); setMessage(null) }}>
              {t('auth.signinTab')}
            </button>
            <button className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(null); setMessage(null) }}>
              {t('auth.signupTab')}
            </button>
          </div>

          <h1>{mode === 'signin' ? t('auth.signinHeading') : t('auth.signupHeading')}</h1>
          <p className="lead">
            {mode === 'signin' ? t('auth.signinDesc') : t('auth.signupDesc')}
          </p>

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

          {message && <p className="success-msg" style={{ marginTop: 14, textAlign: 'center' }}>{message}</p>}
          {error && <p className="error-msg" style={{ marginTop: 14, textAlign: 'center' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
