import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { SupportedLocale } from '@/libs/intl/config'
import { resolveLocale } from '@/libs/intl/config'

const STORAGE_KEY = 'openfoot-locale'

interface LocaleState {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
}

/**
 * Resolve o locale inicial de forma síncrona (sem flicker):
 * 1. localStorage (preferência salva do usuário)
 * 2. navigator.language (padrão do navegador)
 * 3. pt-BR (fallback)
 */
const getInitialLocale = (): SupportedLocale => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { locale?: string } }
      if (parsed.state?.locale) {
        return resolveLocale(parsed.state.locale)
      }
    }
  } catch {
    // LocalStorage corrompido ou indisponível — continuar para resolver via navigator.language
  }

  return resolveLocale(navigator.language)
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: getInitialLocale(),
      setLocale: (locale) => set({ locale }),
    }),
    { name: STORAGE_KEY }
  )
)
