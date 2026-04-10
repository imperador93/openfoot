import { useMemo } from 'react'

import { converter } from 'culori'

type OKLCH = { l: number; c: number; h: number }

type Input = {
  primary: string // HEX
  secondary: string // HEX
  tertiary?: string | null // HEX opcional
}

const toOklch = converter('oklch')

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function normalizeHue(h: number) {
  return (h + 360) % 360
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b) % 360
  return d > 180 ? 360 - d : d
}

function averageHue(a: number, b: number) {
  const diff = ((b - a + 540) % 360) - 180
  return normalizeHue(a + diff / 2)
}

function content(bg: OKLCH): OKLCH {
  return bg.l > 60 ? { l: 15, c: 0.02, h: bg.h } : { l: 95, c: 0, h: 0 }
}

function toStr({ l, c, h }: OKLCH) {
  return `oklch(${l}% ${c} ${h})`
}

/** Limiar abaixo do qual a cor é considerada acromática */
const ACHROMATIC_THRESHOLD = 0.04

function isAchromatic(oklch: OKLCH): boolean {
  return oklch.c < ACHROMATIC_THRESHOLD
}

function hexToOKLCH(hex: string): OKLCH {
  try {
    const c = toOklch(hex)

    if (!c) throw new Error()

    return {
      l: c.l * 100,
      c: c.c,
      h: c.h ?? 0,
    }
  } catch {
    // fallback neutro seguro
    return { l: 60, c: 0, h: 0 }
  }
}

export function useTheme({ primary, secondary, tertiary }: Input) {
  return useMemo(() => {
    const p = hexToOKLCH(primary)
    const s = hexToOKLCH(secondary)
    const t = tertiary ? hexToOKLCH(tertiary) : undefined

    const pAchromatic = isAchromatic(p)
    const sAchromatic = isAchromatic(s)

    // evita cores cromáticas muito próximas
    if (!pAchromatic && !sAchromatic && hueDistance(p.h, s.h) < 20) {
      s.h = normalizeHue(s.h + 40)
    }

    // primary
    const primaryColor: OKLCH = pAchromatic
      ? { l: clamp(p.l, 40, 80), c: 0, h: 0 }
      : { l: 68, c: clamp(p.c, 0.18, 0.26), h: p.h }

    // secondary
    const secondaryColor: OKLCH = sAchromatic
      ? { l: clamp(s.l, 40, 85), c: 0, h: 0 }
      : { l: clamp(s.l, 70, 80), c: clamp(s.c, 0.06, 0.16), h: s.h }

    // accent
    const accentColor: OKLCH = t
      ? isAchromatic(t)
        ? { l: clamp(t.l, 50, 80), c: 0, h: 0 }
        : { l: 78, c: clamp(t.c, 0.12, 0.22), h: t.h }
      : pAchromatic && sAchromatic
        ? { l: 78, c: 0, h: 0 }
        : {
            l: 78,
            c: 0.18,
            h: pAchromatic ? s.h : sAchromatic ? p.h : averageHue(p.h, s.h),
          }

    // base — usa hue da primary se cromática, senão da secondary, senão neutro
    const chromaSource = !pAchromatic ? p : !sAchromatic ? s : null
    const baseHue = chromaSource?.h ?? 0
    const baseChromaScale = chromaSource ? 1 : 0

    const base100: OKLCH = { l: 12, c: 0.08 * baseChromaScale, h: baseHue }
    const base200: OKLCH = { l: 15, c: 0.06 * baseChromaScale, h: baseHue }
    const base300: OKLCH = { l: 18, c: 0.05 * baseChromaScale, h: baseHue }

    const neutral: OKLCH = { l: 22, c: 0.02 * baseChromaScale, h: baseHue }

    return {
      '--color-base-100': toStr(base100),
      '--color-base-200': toStr(base200),
      '--color-base-300': toStr(base300),
      '--color-base-content': toStr(content(base100)),

      '--color-primary': toStr(primaryColor),
      '--color-primary-content': toStr(content(primaryColor)),

      '--color-secondary': toStr(secondaryColor),
      '--color-secondary-content': toStr(content(secondaryColor)),

      '--color-accent': toStr(accentColor),
      '--color-accent-content': toStr(content(accentColor)),

      '--color-neutral': toStr(neutral),
      '--color-neutral-content': toStr(content(neutral)),

      '--color-info': toStr({ l: 70, c: 0.15, h: 230 }),
      '--color-info-content': toStr({ l: 25, c: 0.05, h: 230 }),

      '--color-success': toStr({ l: 72, c: 0.18, h: 150 }),
      '--color-success-content': toStr({ l: 30, c: 0.08, h: 150 }),

      '--color-warning': toStr({ l: 80, c: 0.18, h: 90 }),
      '--color-warning-content': toStr({ l: 35, c: 0.1, h: 90 }),

      '--color-error': toStr({ l: 68, c: 0.22, h: 25 }),
      '--color-error-content': toStr({ l: 28, c: 0.1, h: 25 }),
    } as React.CSSProperties
  }, [primary, secondary, tertiary])
}
