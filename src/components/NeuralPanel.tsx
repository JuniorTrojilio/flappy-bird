import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EvolutionSection } from '@/components/panel/EvolutionSection'
import { ProgressBlock } from '@/components/panel/ProgressBlock'
import {
  distStatus,
  heightStatus,
  MetricBar,
  velStatus,
} from '@/components/panel/MetricBar'
import { NetworkDiagram } from '@/components/panel/NetworkDiagram'
import { PopulationInput } from '@/components/panel/PopulationInput'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'
import { cn } from '@/lib/utils'
import type { GameMode } from '@/game/game-engine'
import { Pause, Play, Trash2, User, Brain } from 'lucide-react'

type NeuralPanelProps = {
  state: PanelState | null
  slowState: PanelState | null
  ui: PanelUiEvents
  paused: boolean
  speed: number
  gameMode: GameMode
  onSpeedChange: (s: number) => void
  onPauseToggle: () => void
  onModeChange: (mode: GameMode) => void
  onClearTraining: () => void
  populationSize: number
  onPopulationChange: (n: number) => void
  onPlayerRestart: () => void
}

function PanelBlock({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('flex min-h-0 min-w-0 flex-col overflow-hidden py-0', className)}>
      <div className="shrink-0 border-b border-border/60 px-2 py-1 text-[10px] font-semibold tracking-wide text-muted-foreground">
        {title}
      </div>
      <CardContent className="min-h-0 flex-1 overflow-hidden p-2">{children}</CardContent>
    </Card>
  )
}

export function NeuralPanel({
  state,
  slowState,
  ui,
  paused,
  speed,
  gameMode,
  onSpeedChange,
  onPauseToggle,
  onModeChange,
  onClearTraining,
  populationSize,
  onPopulationChange,
  onPlayerRestart,
}: NeuralPanelProps) {
  const [highlightHidden, setHighlightHidden] = useState<number | null>(null)

  if (!state) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    )
  }

  const slow = slowState ?? state
  const confPct = Math.round(slow.calculo.confianca * 100)
  const confClass =
    slow.calculo.confianca < 0.4
      ? 'bg-red-500'
      : slow.calculo.confianca > 0.6
        ? 'bg-emerald-500'
        : 'bg-amber-500'

  const flashRecord = ui.flashRecord > 0 && Date.now() - ui.flashRecord < 2000
  const isPlayer = gameMode === 'player' || state.modoJogador

  return (
    <div className="panel-mono relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {flashRecord && (
        <div
          className="pointer-events-none absolute inset-0 z-10 panel-flash-record"
          aria-hidden
        />
      )}

      {/* Barra superior: stats + controles */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2">
        <span className="text-xs font-bold text-foreground">
          {isPlayer ? '🎮 Modo jogador' : '🧠 Treino IA'}
        </span>
        {!isPlayer && (
          <span className="text-xs tabular-nums">
            <span className="text-muted-foreground">G </span>
            <span className="font-semibold text-sky-400">{state.progresso.geracao}</span>
          </span>
        )}
        <span className="text-xs tabular-nums">
          <span className="text-muted-foreground">Rec </span>
          <span className="font-semibold text-sky-400">{state.progresso.recorde}</span>
        </span>
        {!isPlayer && (
          <span className="text-[10px] text-muted-foreground">
            {state.progresso.vivos}/{state.progresso.populacao} pássaros
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Button
            variant={gameMode === 'ai' ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onModeChange('ai')}
          >
            <Brain className="size-3" />
            IA
          </Button>
          <Button
            variant={gameMode === 'player' ? 'default' : 'outline'}
            size="sm"
            className="h-7 gap-1 px-2 text-[10px]"
            onClick={() => onModeChange('player')}
          >
            <User className="size-3" />
            Jogador
          </Button>
          {!isPlayer && (
            <PopulationInput value={populationSize} onChange={onPopulationChange} />
          )}
          {!isPlayer && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 px-2 text-[10px] text-destructive hover:text-destructive"
              onClick={onClearTraining}
            >
              <Trash2 className="size-3" />
              Limpar
            </Button>
          )}
          {!isPlayer &&
            [1, 5, 10].map((s) => (
              <Button
                key={s}
                variant={speed === s ? 'default' : 'secondary'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onSpeedChange(s)}
              >
                ×{s}
              </Button>
            ))}
          <Button
            variant="secondary"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={onPauseToggle}
          >
            {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
            {paused ? 'Play' : 'Pausa'}
          </Button>
        </div>
      </header>

      {isPlayer ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          {state.playerAguardandoInicio ? (
            <>
              <p className="text-3xl font-bold text-amber-400">Fim de jogo</p>
              <p className="text-5xl font-bold tabular-nums text-sky-400">
                {state.progresso.pontuacao}
              </p>
              <p className="text-sm text-muted-foreground">
                Recorde {state.progresso.recorde}
              </p>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                Clique no jogo ou pressione <strong>Espaço</strong> /{' '}
                <strong>↑</strong> para jogar de novo.
              </p>
              <Button size="sm" className="mt-2" onClick={onPlayerRestart}>
                Jogar novamente
              </Button>
            </>
          ) : (
            <>
              <p className="text-4xl font-bold tabular-nums text-sky-400">
                {state.progresso.pontuacao}
              </p>
              <p className="text-sm text-muted-foreground">
                Pontuação atual · recorde {state.progresso.recorde}
              </p>
              <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
                Use <strong className="text-foreground">Espaço</strong>,{' '}
                <strong className="text-foreground">↑</strong> ou{' '}
                <strong className="text-foreground">clique no jogo</strong> para bater asa.
              </p>
            </>
          )}
          <p className="text-[10px] text-muted-foreground">
            Volte para <strong className="text-foreground">IA</strong> para treinar a rede
            neural (reinício automático ao morrer).
          </p>
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-2 p-2">
        <PanelBlock title="👁 O que vê">
          <div className="space-y-1.5">
            <MetricBar
              label="Cano"
              value={slow.inputs.distancia_cano}
              status={distStatus(slow.inputs.distancia_cano)}
              danger={slow.inputs.distancia_cano < 0.25}
            />
            <MetricBar
              label="Abertura"
              value={slow.inputs.altura_passaro}
              status={heightStatus(slow.inputs.altura_passaro)}
              danger={
                slow.inputs.altura_passaro < 0.2 ||
                slow.inputs.altura_passaro > 0.8
              }
            />
            <MetricBar
              label="Queda"
              value={(slow.inputs.velocidade + 1) / 2}
              displayValue={(slow.inputs.velocidade + 1) / 2}
              status={velStatus(slow.inputs.velocidade)}
              danger={slow.inputs.velocidade > 0.5}
            />
          </div>
        </PanelBlock>

        <PanelBlock title="⚡ Decisão" className="border-primary/25 bg-card/90">
          <div className="flex h-full flex-col gap-1.5">
            <p className="text-[10px] tabular-nums text-muted-foreground">
              z = {slow.calculo.z.toFixed(2)}
            </p>
            <div className="flex items-center gap-1.5 text-[10px]">
              <Progress
                value={confPct}
                className="h-1.5 flex-1"
                indicatorClassName={confClass}
              />
              <span className="w-7 tabular-nums">{confPct}%</span>
            </div>
            <div
              className={cn(
                'flex flex-1 items-center justify-center rounded border text-sm font-bold',
                slow.calculo.decisao === 'bate'
                  ? 'border-emerald-500/50 text-emerald-300'
                  : 'border-border text-muted-foreground',
                ui.decisionFeedback && 'border-red-500 bg-red-950/40'
              )}
            >
              {slow.calculo.decisao === 'bate' ? '🪶 BATE' : '⏸ PARA'}
            </div>
            {ui.decisionFeedback && (
              <p className="truncate text-center text-[10px] text-red-400">
                {ui.decisionFeedback.shouldFlap
                  ? '❌ Devia bater'
                  : '❌ Não devia'}
              </p>
            )}
          </div>
        </PanelBlock>

        <PanelBlock title="🎓 Pesos">
          <div className="space-y-1.5">
            <WeightRow
              label="Cano"
              value={state.pesos.w_distancia}
              pulse={state.pesoMudou}
            />
            <WeightRow
              label="Altura"
              value={state.pesos.w_altura}
              pulse={state.pesoMudou}
            />
            <WeightRow
              label="Queda"
              value={state.pesos.w_velocidade}
              pulse={state.pesoMudou}
            />
          </div>
        </PanelBlock>

        <PanelBlock title="📈 Progresso">
          <ProgressBlock
            serieGrafico={state.progresso.serieGrafico}
            historico={state.progresso.historico}
            pontuacaoAtual={state.progresso.pontuacao}
            recorde={state.progresso.recorde}
            populacao={state.progresso.populacao}
            vivos={state.progresso.vivos}
            melhorGeracao={state.progresso.melhorGeracao}
            mediaGeracao={state.progresso.mediaGeracao}
            golden={flashRecord}
          />
        </PanelBlock>

        <PanelBlock title="⚙️ Rede" className="col-span-1">
          <div className="flex h-full min-h-0 flex-col">
            <NetworkDiagram
              state={state}
              paused={paused}
              highlightIndex={highlightHidden}
              onHighlight={setHighlightHidden}
              backpropActive={ui.backpropDeath}
              compact
            />
          </div>
        </PanelBlock>

        <PanelBlock
          title={ui.backpropDeath ? '🧬 Evoluindo' : '🧬 Evolução genética'}
          className={cn(ui.backpropDeath && 'border-emerald-500/40 bg-emerald-950/15')}
        >
          <EvolutionSection
            evolucao={state.evolucao}
            calculo={state.calculo}
            evolving={ui.backpropDeath}
            statusMsg={ui.backpropAdjusting}
          />
        </PanelBlock>
      </div>
      )}
    </div>
  )
}

function WeightRow({
  label,
  value,
  pulse,
}: {
  label: string
  value: number
  pulse: boolean
}) {
  const pct = Math.min(100, (Math.abs(value) / 2) * 100)
  return (
    <div className="grid grid-cols-[2.5rem_1fr_1.75rem_0.5rem] items-center gap-1 text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <Progress
        value={pct}
        className="h-1.5"
        indicatorClassName={value >= 0 ? 'bg-emerald-500' : 'bg-red-500'}
      />
      <span className="tabular-nums">
        {value >= 0 ? '+' : ''}
        {value.toFixed(1)}
      </span>
      <span className={cn(pulse && 'text-sky-400')}>●</span>
    </div>
  )
}
