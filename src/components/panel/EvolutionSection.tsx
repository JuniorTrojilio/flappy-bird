import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import type { PanelCalculo, PanelEvolucao } from '@/lib/panel-types'
import { cn } from '@/lib/utils'

type EvolutionSectionProps = {
  evolucao: PanelEvolucao
  calculo: PanelCalculo
  evolving: boolean
  statusMsg: string
}

export function EvolutionSection({
  evolucao,
  calculo,
  evolving,
  statusMsg,
}: EvolutionSectionProps) {
  const delta = evolucao.deltaVsAnterior
  const deltaLabel =
    delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '±0'
  const deltaTone =
    delta > 0
      ? 'text-emerald-400'
      : delta < 0
        ? 'text-red-400'
        : 'text-muted-foreground'

  const confPct = Math.round(calculo.confianca * 100)

  return (
    <div className="space-y-2 text-[10px]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground">Algoritmo</span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[9px]">
          Genético
        </Badge>
      </div>

      {evolving && statusMsg && (
        <p className="rounded border border-emerald-500/30 bg-emerald-950/30 px-2 py-1 text-[10px] text-emerald-300">
          {statusMsg}
        </p>
      )}

      <StatRow label="Geração" value={String(evolucao.geracao)} />
      <StatRow
        label="Melhor (rodada)"
        value={String(evolucao.melhorRodada)}
        hint={
          evolucao.melhorUltimaGeracao > 0 ? (
            <span className={deltaTone}>
              {deltaLabel} vs última
            </span>
          ) : null
        }
      />
      <StatRow
        label="Média (vivos)"
        value={evolucao.mediaRodada.toFixed(1)}
      />
      <StatRow
        label="Última geração"
        value={`${evolucao.melhorUltimaGeracao} canos`}
      />
      <StatRow label="Recorde" value={String(evolucao.recorde)} highlight />

      <div className="border-t border-border/60 pt-1.5">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          População ({evolucao.populacao})
        </p>
        <StatRow
          label="Vivos agora"
          value={`${evolucao.vivos} / ${evolucao.populacao}`}
        />
        {evolucao.soloBird ? (
          <StatRow label="Modo" value="1 pássaro · mutação adaptativa" />
        ) : (
          <>
            <StatRow label="Elites copiados" value={String(evolucao.elites)} />
            <StatRow label="Filhos (mutação)" value={String(evolucao.filhosMutados)} />
            <StatRow label="Novatos aleatórios" value={String(evolucao.imigrantes)} />
          </>
        )}
        <StatRow
          label="Exploração"
          value={evolucao.modoMutacao}
          hint={
            evolucao.estagnado ? (
              <span className="text-amber-400">estagnado</span>
            ) : null
          }
        />
      </div>

      <div className="border-t border-border/60 pt-1.5">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Campeão (ao vivo)
        </p>
        <div
          className={cn(
            'flex items-center justify-between rounded border px-2 py-1 font-semibold',
            calculo.decisao === 'bate'
              ? 'border-emerald-500/40 text-emerald-300'
              : 'border-border text-muted-foreground'
          )}
        >
          <span>{calculo.decisao === 'bate' ? '🪶 BATE' : '⏸ Espera'}</span>
          <span className="tabular-nums font-normal text-muted-foreground">
            {confPct}%
          </span>
        </div>
      </div>
    </div>
  )
}

function StatRow({
  label,
  value,
  hint,
  highlight,
}: {
  label: string
  value: string
  hint?: ReactNode
  highlight?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 gap-y-0">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span
          className={cn(
            'tabular-nums font-medium',
            highlight && 'text-sky-400'
          )}
        >
          {value}
        </span>
        {hint && <div className="text-[9px] tabular-nums">{hint}</div>}
      </div>
    </div>
  )
}
