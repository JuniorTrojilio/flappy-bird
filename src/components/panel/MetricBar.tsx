import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type MetricBarProps = {
  label: string
  value: number
  status: string
  danger?: boolean
  displayValue?: number
}

export function MetricBar({
  label,
  value,
  status,
  danger,
  displayValue,
}: MetricBarProps) {
  const pct = (displayValue ?? value) * 100
  return (
    <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-2 text-xs">
      <span className={cn('text-muted-foreground', danger && 'text-red-400')}>
        {label}
      </span>
      <Progress
        value={pct}
        indicatorClassName={cn(danger ? 'bg-red-500' : 'bg-primary')}
      />
      <span className="text-right text-muted-foreground">{status}</span>
    </div>
  )
}

export function distStatus(v: number) {
  if (v > 0.6) return 'longe'
  if (v > 0.3) return 'chegando'
  return 'perigoso'
}

export function heightStatus(v: number) {
  if (v < 0.3) return 'muito alto'
  if (v < 0.45) return 'subindo'
  if (v > 0.7) return 'muito baixo'
  if (v > 0.55) return 'descendo'
  return 'no centro'
}

export function velStatus(v: number) {
  if (v < -0.4) return 'caindo rápido'
  if (v < -0.1) return 'caindo'
  if (v > 0.2) return 'subindo'
  return 'estável'
}
