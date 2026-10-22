import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import type { Language } from '../../../shared/types'
import { en } from './en'
import { ptBR, type TranslationKey } from './pt-BR'

export type { TranslationKey }
export type TFunction = (key: TranslationKey, params?: Record<string, string | number>) => string

const dictionaries: Record<Language, Record<TranslationKey, string>> = { 'pt-BR': ptBR, en }

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (params[name] !== undefined ? String(params[name]) : whole))
}

interface I18nValue {
  t: TFunction
  language: Language
  locale: string
}

const I18nContext = createContext<I18nValue>({
  t: (key, params) => interpolate(ptBR[key], params),
  language: 'pt-BR',
  locale: 'pt-BR'
})

export function I18nProvider({ language, children }: { language: Language; children: ReactNode }) {
  const t = useCallback<TFunction>((key, params) => interpolate(dictionaries[language][key] ?? ptBR[key] ?? key, params), [language])
  const value = useMemo(() => ({ t, language, locale: language === 'en' ? 'en-US' : 'pt-BR' }), [t, language])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}
