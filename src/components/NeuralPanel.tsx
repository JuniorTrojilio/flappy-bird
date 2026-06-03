/**
 * Painel lateral: sentidos da IA, decisão, pesos, gráfico de progresso, diagrama da rede, evolução.
 * Só mostra dados — quem calcula é o GameEngine.
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EvolutionSection } from '@/components/panel/EvolutionSection'
import { ProgressBlock } from '@/components/panel/ProgressBlock'
import { AiSensesBlock } from '@/components/panel/AiSensesBlock'
import { ChampionWeightsImporter } from '@/components/panel/ChampionWeightsImporter'
import type { ApplyChampionSnapshotOptions } from '@/game/game-engine'
import type { NetworkSnapshot } from '@/lib/neural-network'
import { NetworkConfigPicker } from '@/components/panel/NetworkConfigPicker'
import { NetworkDiagram } from '@/components/panel/NetworkDiagram'
import { PopulationInput } from '@/components/panel/PopulationInput'
import type { NnConfigState } from '@/game/game-engine'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'
import { formatScore } from '@/lib/score'
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
  nnConfig: NnConfigState
  onNnConfigApply: (config: NnConfigState) => void
  onApplyChampionWeights: (
    snapshot: NetworkSnapshot,
    options: ApplyChampionSnapshotOptions
  ) => boolean
  onCopyChampionWeights: () => string | null
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
  nnConfig,
  onNnConfigApply,
  onApplyChampionWeights,
  onCopyChampionWeights,
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

  const isPlayer = gameMode === 'player' || state.modoJogador

  return (
    <div className="panel-mono relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
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
        {!isPlayer && state.progresso.hallOfFame > 0 && (
          <span className="text-[10px] tabular-nums text-amber-400/90">
            hall {state.progresso.hallOfFame}
          </span>
        )}
        {!isPlayer && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {state.arquitetura.label}
          </span>
        )}
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
                title={
                  s === 1
                    ? '1 passo de simulação por frame — referência do treino'
                    : `${s} passos por frame — só acelera o relógio; física e evolução por passo iguais ao ×1`
                }
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
          <p className="text-2xl font-bold text-sky-400">Modo jogador</p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {state.playerAguardandoInicio ? (
              state.progresso.pontuacao > 0 ? (
                <>
                  Placar no painel <strong>Game Over</strong> do jogo. Clique em{' '}
                  <strong>restart</strong> no canvas (ou <strong>Espaço</strong>) e depois
                  toque de novo para jogar.
                </>
              ) : (
                <>
                  Tela <strong>Get Ready</strong> no canvas. Toque no jogo ou pressione{' '}
                  <strong>Espaço</strong> / <strong>↑</strong> para começar.
                </>
              )
            ) : (
              <>
                Pontuação no topo do canvas. <strong>Espaço</strong>, <strong>↑</strong> ou
                clique para bater asa.
              </>
            )}
          </p>
          <Button size="sm" className="mt-2" onClick={onPlayerRestart}>
            {state.playerAguardandoInicio
              ? state.progresso.pontuacao > 0
                ? 'Restart'
                : 'Jogar'
              : 'Reiniciar partida'}
          </Button>
          <p className="text-[10px] text-muted-foreground">
            Volte para <strong className="text-foreground">IA</strong> para treinar a rede
            neural.
          </p>
        </div>
      ) : (
      <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-[auto_1fr_1fr] gap-2 p-2">
        <PanelBlock title="🔧 Arquitetura & generalização" className="col-span-3">
          <NetworkConfigPicker config={nnConfig} onApply={onNnConfigApply} />
          {state.generalizacao && state.generalizacao.evalSeeds > 1 && (
            <p className="mt-1.5 text-[9px] tabular-nums text-muted-foreground">
              Última geração: fitness{' '}
              <span className="text-sky-400">
                {formatScore(state.generalizacao.melhorFitness)}
              </span>{' '}
              (média {state.generalizacao.evalSeeds} circuitos) · partida visível{' '}
              {formatScore(state.generalizacao.melhorVisual)}
            </p>
          )}
        </PanelBlock>

        <PanelBlock title="👁 O que a IA vê">
          <AiSensesBlock
            inputs={slow.inputs}
            inputMode={state.arquitetura.inputMode}
            inputSize={state.arquitetura.inputSize}
          />
        </PanelBlock>

        <PanelBlock title="⚡ Decisão" className="border-primary/25 bg-card/90">
          <div className="flex h-full flex-col gap-1.5">
            <p className="text-[10px] tabular-nums text-muted-foreground">
              soma = {slow.calculo.somaSaidaAntesSigmoid.toFixed(2)}
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
            <p className="text-[9px] font-medium text-muted-foreground">
              Em jogo agora
            </p>
            <WeightRow
              label="Cano"
              value={state.pesos.pesoDistancia}
              pulse={state.pesoMudou}
            />
            <WeightRow
              label="Altura"
              value={state.pesos.pesoAltura}
              pulse={state.pesoMudou}
            />
            <WeightRow
              label="Queda"
              value={state.pesos.pesoVelocidade}
              pulse={state.pesoMudou}
            />

            {state.campeaoHistorico ? (
              <>
                <p className="border-t border-border/60 pt-1.5 text-[9px] font-medium text-amber-400/90">
                  Melhor campeão (hall {state.campeaoHistorico.score})
                </p>
                <WeightRow
                  label="Cano"
                  value={state.campeaoHistorico.pesos.pesoDistancia}
                  variant="hall"
                />
                <WeightRow
                  label="Altura"
                  value={state.campeaoHistorico.pesos.pesoAltura}
                  variant="hall"
                />
                <WeightRow
                  label="Queda"
                  value={state.campeaoHistorico.pesos.pesoVelocidade}
                  variant="hall"
                />
              </>
            ) : (
              <p className="border-t border-border/60 pt-1.5 text-[9px] leading-snug text-muted-foreground">
                O melhor genoma da história aparece aqui quando o hall of fame
                registrar um campeão.
              </p>
            )}
            <ChampionWeightsImporter
              nnConfig={nnConfig}
              onApply={onApplyChampionWeights}
              onCopyCurrent={onCopyChampionWeights}
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
          />
        </PanelBlock>

        <PanelBlock title="⚙️ Rede neural" className="col-span-1">
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
  pulse = false,
  variant = 'live',
}: {
  label: string
  value: number
  pulse?: boolean
  variant?: 'live' | 'hall'
}) {
  const pct = Math.min(100, (Math.abs(value) / 2) * 100)
  const isHall = variant === 'hall'
  return (
    <div
      className={cn(
        'grid items-center gap-1 text-[10px]',
        isHall
          ? 'grid-cols-[2.5rem_1fr_1.75rem]'
          : 'grid-cols-[2.5rem_1fr_1.75rem_0.5rem]'
      )}
    >
      <span className={cn('text-muted-foreground', isHall && 'text-amber-200/70')}>
        {label}
      </span>
      <Progress
        value={pct}
        className="h-1.5"
        indicatorClassName={
          isHall
            ? 'bg-amber-500/80'
            : value >= 0
              ? 'bg-emerald-500'
              : 'bg-red-500'
        }
      />
      <span className={cn('tabular-nums', isHall && 'text-amber-200/80')}>
        {value >= 0 ? '+' : ''}
        {value.toFixed(1)}
      </span>
      {!isHall && <span className={cn(pulse && 'text-sky-400')}>●</span>}
    </div>
  )
}
