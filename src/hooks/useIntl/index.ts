import { useIntl as vanillaUseIntl } from 'react-intl'

import type { MessageId } from '@/libs/intl/types'
import { useLocaleStore } from '@/stores/LocaleStore'

type FormatValues = Record<string, string | number>

/**
 * Wrapper tipado em torno do `useIntl` do react-intl.
 *
 * - `t(id)` — chave tipada estaticamente com autocomplete completo.
 * - `td(id)` — escape hatch para chaves construídas dinamicamente (ex: enum lookups).
 *    Prefira `t()` sempre que possível; use `td()` apenas quando a chave é construída em tempo de execução.
 * - `locale` — local ativo atual.
 * - `setLocale(locale)` — alternar local (persistido no localStorage).
 */
export function useIntl() {
  const intl = vanillaUseIntl()
  const locale = useLocaleStore((s) => s.locale)
  const setLocale = useLocaleStore((s) => s.setLocale)

  return {
    intl,
    locale,
    setLocale,
    t: (id: MessageId, values?: FormatValues) => intl.formatMessage({ id }, values),
    td: (id: string, values?: FormatValues) => intl.formatMessage({ id: id as MessageId }, values),
  }
}
