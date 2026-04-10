import type { ButtonHTMLAttributes } from 'react'
import { forwardRef } from 'react'

import { cn } from '@/utils/styles'

export type ButtonColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export type ButtonVariant = 'solid' | 'outline' | 'dash' | 'soft' | 'ghost' | 'link'

export type ButtonShape = 'wide' | 'block' | 'square' | 'circle'

type Breakpoint = 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Cor semântica do botão (DaisyUI color modifier) */
  color?: ButtonColor
  /** Tamanho base do botão */
  size?: ButtonSize
  /**
   * Tamanhos responsivos por breakpoint.
   * Ex: { sm: 'sm', lg: 'lg' } → aplica `sm:btn-sm lg:btn-lg`
   */
  responsiveSize?: Partial<Record<Breakpoint, ButtonSize>>
  /** Estilo/variante visual do botão */
  variant?: ButtonVariant
  /** Forma do botão */
  shape?: ButtonShape
  /** Força o estado visual de ativo (`btn-active`) */
  active?: boolean
  /** Desabilita o botão e aplica estilos de desabilitado */
  disabled?: boolean
  /** Ícone a ser exibido no botão */
  icon?: React.ReactNode
  /** Indica se o botão está em estado de carregamento */
  loading?: boolean
}

// Mapas explícitos garantem que o Tailwind v4 inclua todas as classes no bundle

const COLOR_MAP: Record<ButtonColor, string> = {
  neutral: 'btn-neutral',
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  info: 'btn-info',
  success: 'btn-success',
  warning: 'btn-warning',
  error: 'btn-error',
}

const SIZE_MAP: Record<ButtonSize, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: 'btn-md',
  lg: 'btn-lg',
  xl: 'btn-xl',
}

// Todas as combinações de breakpoint × tamanho listadas explicitamente
// para que o scanner do Tailwind v4 as detecte corretamente
const RESPONSIVE_SIZE_MAP: Record<Breakpoint, Record<ButtonSize, string>> = {
  sm: { xs: 'sm:btn-xs', sm: 'sm:btn-sm', md: 'sm:btn-md', lg: 'sm:btn-lg', xl: 'sm:btn-xl' },
  md: { xs: 'md:btn-xs', sm: 'md:btn-sm', md: 'md:btn-md', lg: 'md:btn-lg', xl: 'md:btn-xl' },
  lg: { xs: 'lg:btn-xs', sm: 'lg:btn-sm', md: 'lg:btn-md', lg: 'lg:btn-lg', xl: 'lg:btn-xl' },
  xl: { xs: 'xl:btn-xs', sm: 'xl:btn-sm', md: 'xl:btn-md', lg: 'xl:btn-lg', xl: 'xl:btn-xl' },
}

const VARIANT_MAP: Record<ButtonVariant, string> = {
  outline: 'btn-outline',
  dash: 'btn-dash',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
  link: 'btn-link',
  solid: '',
}

const SHAPE_MAP: Record<ButtonShape, string> = {
  wide: 'btn-wide',
  block: 'btn-block',
  square: 'btn-square',
  circle: 'btn-circle',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      color,
      size,
      responsiveSize,
      variant,
      shape,
      active = false,
      disabled = false,
      className,
      children,
      icon,
      loading,
      ...props
    },
    ref
  ) => {
    const responsiveClasses = responsiveSize
      ? (Object.entries(responsiveSize) as [Breakpoint, ButtonSize][])
          .map(([bp, s]) => RESPONSIVE_SIZE_MAP[bp][s])
          .join(' ')
      : ''

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'btn',
          color && COLOR_MAP[color],
          size && SIZE_MAP[size],
          responsiveClasses,
          variant && VARIANT_MAP[variant],
          shape && SHAPE_MAP[shape],
          active && 'btn-active',
          disabled && 'btn-disabled',
          className
        )}
        {...props}
      >
        {icon && !loading && <span>{icon}</span>}
        {loading && <span className='loading loading-spinner'></span>}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
