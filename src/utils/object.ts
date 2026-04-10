/**
 * Recebe um objeto aninhado e retorna um novo objeto com todas as propriedades
 * aninhadas achatadas em um único nível, usando notação de ponto para as chaves.
 *
 * @param obj O objeto a ser achatado
 * @param parentKey A chave base a ser usada para o nível atual de recursão (usado internamente)
 * @returns Um novo objeto com todas as propriedades aninhadas achatadas
 */
export const flattenObject = <T extends Record<string, unknown>>(
  obj: T,
  parentKey = ''
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key]
      const newKey = parentKey ? `${parentKey}.${key}` : key

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value as Record<string, unknown>, newKey))
      } else {
        result[newKey] = value
      }
    }
  }

  return result
}
