import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { t as translate, type Locale } from '../lib/i18n'

type LocaleContextValue = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem('polla-locale')
    return (stored === 'en' || stored === 'es') ? stored : 'es'
  })

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('polla-locale', l)
    setLocaleState(l)
  }, [])

  const t = useCallback((key: string) => translate(key, locale), [locale])

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
