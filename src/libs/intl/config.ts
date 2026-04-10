import { ptBRMessages } from '@/lang/pt_BR'
import { flattenObject } from '@/utils/objects'

export const defaultLocale = 'pt-BR'

export const messagesByLocale = {
  'pt-BR': flattenObject(ptBRMessages) as Record<string, string>,
} as const

export type SupportedLocale = keyof typeof messagesByLocale

export const localesMeta: Record<SupportedLocale, { nativeLabel: string; flag: string }> = {
  'pt-BR': { nativeLabel: 'Português', flag: 'br' },
}

export const supportedLocales = Object.keys(localesMeta) as SupportedLocale[]

const hasSupportedLocale = (locale: string): locale is SupportedLocale => {
  return locale in messagesByLocale
}

export const resolveLocale = (requestedLocale?: string): SupportedLocale => {
  if (!requestedLocale) {
    return defaultLocale
  }

  if (hasSupportedLocale(requestedLocale)) {
    return requestedLocale
  }

  const languageCode = requestedLocale.split('-')[0]
  const fallback = Object.keys(messagesByLocale).find((locale) =>
    locale.startsWith(`${languageCode}-`)
  )

  return (fallback as SupportedLocale | undefined) ?? defaultLocale
}
