import { useLocaleStore } from '@/stores/LocaleStore'

/**
 * Obtém o locale formatado para ser utilizado com a biblioteca Day.js.
 *
 * @returns {string} O locale formatado para Day.js.
 */
export const getDayJsLocale = (): string => {
  const locale = useLocaleStore((s) => s.locale)

  return locale.toLowerCase().replace('_', '-')
}
