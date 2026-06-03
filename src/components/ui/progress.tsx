import * as React from 'react'
import { cn } from '@/lib/utils'

interface ProgressProps extends React.ComponentProps<'div'> {
  value?: number
  indicatorClassName?: string
}

function Progress({
  className,
  value = 0,
  indicatorClassName,
  ...props
}: ProgressProps) {
  return (
    <div
      className={cn(
        'relative h-2 w-full overflow-hidden rounded-full bg-secondary',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full transition-all duration-150 ease-out bg-primary',
          indicatorClassName
        )}
        style={{ width: `${clampPct(value)}%` }}
      />
    </div>
  )
}

function clampPct(v: number) {
  return Math.max(0, Math.min(100, v))
}

export { Progress }
