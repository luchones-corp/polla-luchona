import { FormEvent, useState } from 'react'
import { saveDisplayName } from '../lib/api'
import { useLocale } from '../contexts/LocaleContext'

type DisplayNameGateProps = {
  userId: string
  onSaved: (displayName: string) => void
}

export function DisplayNameGate({ userId, onSaved }: DisplayNameGateProps) {
  const { t } = useLocale()
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = displayName.trim()
    if (!trimmed) {
      setError(t('displayName.required'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      await saveDisplayName(userId, trimmed)
      onSaved(trimmed)
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('displayName.error')
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card fade-in" style={{ padding: 28, width: 'min(420px, 95vw)' }}>
      <div className="brand" style={{ marginBottom: 20 }}>
        <div className="brand-mark"><span>LP</span></div>
        <div className="brand-txt"><b>{t('brand.name')}</b><em>{t('brand.subtitle')}</em></div>
      </div>
      <h2 style={{ fontFamily: 'var(--font-disp)', fontSize: 26, textTransform: 'uppercase', marginBottom: 8 }}>
        {t('displayName.heading')}
      </h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 20 }}>
        {t('displayName.desc')}
      </p>
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>{t('displayName.label')}</label>
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t('displayName.placeholder')}
          />
        </div>
        <button className="btn btn-primary btn-block" disabled={loading} type="submit" style={{ marginTop: 8 }}>
          {loading ? t('displayName.saving') : t('displayName.saveBtn')}
        </button>
      </form>
      {error && <p className="error-msg" style={{ marginTop: 12, textAlign: 'center' }}>{error}</p>}
    </div>
  )
}
