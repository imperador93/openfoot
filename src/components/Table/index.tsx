import type { TableHTMLAttributes } from 'react'
import { forwardRef } from 'react'

import { cn } from '@/utils/styles'

import type { TableBreakpoint, TableSize } from './types'

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Tamanho base da tabela */
  size?: TableSize
  /**
   * Tamanhos responsivos por breakpoint.
   * Ex: { sm: 'sm', lg: 'lg' } → aplica `sm:table-sm lg:table-lg`
   */
  responsiveSize?: Partial<Record<TableBreakpoint, TableSize>>
  /** Exibe linhas zebradas */
  zebra?: boolean
  /** Fixa as linhas de thead e tfoot ao rolar */
  pinRows?: boolean
  /** Fixa as colunas <th> ao rolar horizontalmente */
  pinCols?: boolean
  /** Classes adicionais aplicadas ao wrapper `<div>` */
  wrapperClassName?: string
}

const SIZE_MAP: Record<TableSize, string> = {
  xs: 'table-xs',
  sm: 'table-sm',
  md: 'table-md',
  lg: 'table-lg',
  xl: 'table-xl',
}

const RESPONSIVE_SIZE_MAP: Record<TableBreakpoint, Record<TableSize, string>> = {
  sm: {
    xs: 'sm:table-xs',
    sm: 'sm:table-sm',
    md: 'sm:table-md',
    lg: 'sm:table-lg',
    xl: 'sm:table-xl',
  },
  md: {
    xs: 'md:table-xs',
    sm: 'md:table-sm',
    md: 'md:table-md',
    lg: 'md:table-lg',
    xl: 'md:table-xl',
  },
  lg: {
    xs: 'lg:table-xs',
    sm: 'lg:table-sm',
    md: 'lg:table-md',
    lg: 'lg:table-lg',
    xl: 'lg:table-xl',
  },
  xl: {
    xs: 'xl:table-xs',
    sm: 'xl:table-sm',
    md: 'xl:table-md',
    lg: 'xl:table-lg',
    xl: 'xl:table-xl',
  },
}

const Table = forwardRef<HTMLTableElement, TableProps>(
  (
    {
      size,
      responsiveSize,
      zebra = false,
      pinRows = false,
      pinCols = false,
      wrapperClassName,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const responsiveClasses = responsiveSize
      ? (Object.entries(responsiveSize) as [TableBreakpoint, TableSize][])
          .map(([bp, s]) => RESPONSIVE_SIZE_MAP[bp][s])
          .join(' ')
      : ''

    return (
      <div className={cn('overflow-x-auto', wrapperClassName)}>
        <table
          ref={ref}
          className={cn(
            'table',
            size && SIZE_MAP[size],
            responsiveClasses,
            zebra && 'table-zebra',
            pinRows && 'table-pin-rows',
            pinCols && 'table-pin-cols',
            className
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    )
  }
)

Table.displayName = 'Table'

export default Table
