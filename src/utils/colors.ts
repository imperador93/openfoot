import type { CSSProperties } from 'react'

/**
 * Converte um código hexadecimal de cor para RGB e calcula a cor de contraste (preto ou branco) para garantir legibilidade.
 *
 * @param hex Código hexadecimal da cor (ex: "#ff0000")
 * @returns Cor de contraste (preto ou branco) para garantir legibilidade
 */
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return [0, 0, 0]
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
}

/**
 * Calcula a luminância relativa de uma cor RGB para determinar se a cor de contraste deve ser preta ou branca.
 *
 * @param r Valor do componente vermelho (0-255)
 * @param g Valor do componente verde (0-255)
 * @param b Valor do componente azul (0-255)
 * @returns Luminância relativa da cor (0-1)
 */
const relativeLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Calcula a cor de contraste (preto ou branco) para garantir legibilidade com base na luminância relativa.
 *
 * @param hex Código hexadecimal da cor (ex: "#ff0000")
 * @returns Cor de contraste (preto ou branco) para garantir legibilidade
 */
const contrastColor = (hex: string): string => {
  const [r, g, b] = hexToRgb(hex)
  return relativeLuminance(r, g, b) > 0.179 ? '#1a1a1a' : '#f5f5f5'
}

/**
 * Converte uma cor RGB para código hexadecimal.
 *
 * @param r Valor do componente vermelho (0-255)
 * @param g Valor do componente verde (0-255)
 * @param b Valor do componente azul (0-255)
 * @returns Código hexadecimal da cor (ex: "#ff0000")
 */
const rgbToHex = (r: number, g: number, b: number): string => {
  return `#${[r, g, b]
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

/**
 * Aplica um efeito de escurecimento a uma cor hexadecimal.
 *
 * @param hex Código hexadecimal da cor (ex: "#ff0000")
 * @param amount Quantidade de escurecimento (0-1)
 * @returns Código hexadecimal da cor escurecida
 */
const tintDark = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex)
  const base: [number, number, number] = [18, 22, 20]
  return rgbToHex(
    base[0] + (r - base[0]) * amount,
    base[1] + (g - base[1]) * amount,
    base[2] + (b - base[2]) * amount
  )
}

/**
 * Gera um tema de cores para um clube com base nas cores primária, secundária e terciária fornecidas.
 *
 * @param primary Cor primária do clube (ex: "#ff0000")
 * @param secondary Cor secundária do clube (ex: "#00ff00")
 * @param tertiary Cor terciária do clube (ex: "#0000ff")
 * @returns Objeto CSSProperties com as cores do tema do clube
 */
export const generateClubTheme = (
  primary: string,
  secondary: string,
  tertiary: string | null
): CSSProperties => {
  return {
    '--color-primary': primary,
    '--color-primary-content': contrastColor(primary),
    '--color-secondary': secondary,
    '--color-secondary-content': contrastColor(secondary),
    ...(tertiary && {
      '--color-accent': tertiary,
      '--color-accent-content': contrastColor(tertiary),
    }),
    '--color-base-100': tintDark(primary, 0.04),
    '--color-base-200': tintDark(primary, 0.07),
    '--color-base-300': tintDark(primary, 0.11),
  } as CSSProperties
}
