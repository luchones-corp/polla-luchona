import { es } from './translations/es'
import { en } from './translations/en'

export type Locale = 'es' | 'en'

const translations: Record<Locale, Record<string, string>> = { es, en }

export function t(key: string, locale: Locale): string {
  return translations[locale]?.[key] ?? translations.es[key] ?? key
}
