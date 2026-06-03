import { Badge } from '@/components/ui/badge'
import { HistoryChart } from '@/components/panel/HistoryChart'
import {
  computeProgressTrend,
  trendLabel,
  type ProgressTrend,
} from '@/lib/progress-trend'
import { formatScore } from '@/lib/score'
import { Minus, TrendingDown, TrendingUp } from 'lucide-react'

type ProgressBlockProps = {
  serieGrafico: number[]
  historico: number[]
  pontuacaoAtual: number
  recorde: number
  populacao: number
  vivos: number
  melhorGeracao: number
  mediaGeracao: number
  golden?: boolean
}

const trendStyles: Record<
  ProgressTrend,
  { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning'; icon: typeof TrendingUp }
> = {
  waiting: { variant: 'secondary', icon: Minus },
  up: { variant: 'success', icon: TrendingUp },
  flat: { variant: 'warning', icon: Minus },
  down: { variant: 'destructive', icon: TrendingDown },
}

export function ProgressBlock({
  serieGrafico,
  historico,
  pontuacaoAtual,
  recorde,
  populacao,
  vivos,
  melhorGeracao,
  mediaGeracao,
  golden,
}: ProgressBlockProps) {
  const trend = computeProgressTrend(historico.length >= 2 ? historico : serieGrafico)
  const { variant, icon: Icon } = trendStyles[trend]
  const statusLabel =
    historico.length === 0 && vivos === populacao
      ? '1ª geração…'
      : trendLabel(trend)

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Badge variant={variant} className="gap-1 text-[10px]">
          <Icon className="size-3" />
          {statusLabel}
        </Badge>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          campeão <strong className="text-foreground">{pontuacaoAtual}</strong>
          {' '}
          · melhor <strong className="text-sky-400">{formatScore(melhorGeracao)}</strong>
          {' '}
          · média <strong className="text-foreground">{formatScore(mediaGeracao)}</strong>
          {' '}
          · <strong className="text-emerald-400">{vivos}</strong>/{populacao} vivos
        </span>
      </div>

      <HistoryChart
        serie={serieGrafico}
        golden={golden}
        className="min-h-[5rem] flex-1 rounded bg-secondary/40"
      />

      <div className="flex shrink-0 justify-between text-[9px] text-muted-foreground tabular-nums">
        <span>{historico.length} gerações</span>
        <span>rec {recorde}</span>
      </div>
    </div>
  )
}
