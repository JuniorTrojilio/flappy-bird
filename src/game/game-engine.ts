/**
 * Motor do jogo: loop de frames, desenho no canvas, turbo (×1–×10), treino com população.
 * No fim de cada geração avalia fitness, evolui redes e salva no localStorage.
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import { GAME_HEIGHT, GAME_WIDTH } from '@/game/constants'
import {
  clampPopulationSize,
  PopulationMode,
  POPULATION_MAX,
  POPULATION_MIN,
  type WorldState,
} from '@/game/population-mode'
import {
  BIRD_SPRITE_H,
  BIRD_SPRITE_W,
  BIRD_YELLOW_FRAMES,
  type BirdSpriteVariant,
  birdSpriteFrame,
} from '@/game/bird-sprites'
import {
  architectureLabel,
  defaultArchitecture,
  type EvalSeedOption,
  type NnArchitecture,
} from '@/lib/nn-config'
import {
  aggregatedInputWeightsFromSnapshot,
  NeuralNetwork,
  type NetworkSnapshot,
} from '@/lib/neural-network'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'
import {
  clearTrainingState,
  loadNnPrefs,
  loadTrainingState,
  saveNnPrefs,
  saveTrainingState,
} from '@/lib/training-storage'
import { computeNnInputs } from '@/game/nn-inputs'
import {
  drawPlayerMedal,
  drawPlayerScore,
  GAME_OVER_SPRITE,
  GET_READY_SPRITE,
  isInsideStartBtn,
} from '@/game/player-ui-sprites'
import { getEvolutionLayout } from '@/lib/population-evolution'
import { roundScore } from '@/lib/score'
import type { PanelEvolucao } from '@/lib/panel-types'

const DEGREE = Math.PI / 180
/** Turbo do treino: até ×10 passos de simulação por frame desenhado. */
export const MAX_GAME_SPEED = 10

export type RestoredTrainingInfo = {
  populationSize: number
  generation: number
  recorde: number
  historicoLength: number
  architecture: NnArchitecture
  evalSeeds: EvalSeedOption
}

export type NnConfigState = {
  architecture: NnArchitecture
  evalSeeds: EvalSeedOption
}

export type GameEngineCallbacks = {
  onState: (state: PanelState) => void
  onUiEvent: (patch: Partial<PanelUiEvents>) => void
  onRestored?: (info: RestoredTrainingInfo) => void
}

export type GameMode = 'ai' | 'player'

export { POPULATION_MAX, POPULATION_MIN, clampPopulationSize }

export class GameEngine {
  private ctx: CanvasRenderingContext2D
  private displayNn: NeuralNetwork
  private population: PopulationMode
  private lastGeneralizacao: {
    evalSeeds: number
    melhorVisual: number
    melhorFitness: number
    mediaFitness: number
  } | null = null
  private world: WorldState = { pipes: [], spawnTimer: 0, fgX: 0, frame: 0 }

  private frames = 0
  private lastTime = 0
  private raf = 0
  private started = false

  /**
   * Turbo do treino (×1–×10): quantos passos de simulação por frame desenhado.
   * Não altera física nem evolução por passo — só encurta o tempo de relógio por geração.
   * Modo jogador ignora turbo (sempre ×1).
   */
  gameSpeed = 1
  paused = false
  playerMode = false
  playerAwaitingStart = false
  /** true após morte no modo jogador → painel Game Over (mesmo com 0 pontos). */
  private playerShowGameOver = false
  private lastPlayerScore = 0
  private flapQueued = false
  private simAccumulator = 0
  private generationEnding = false
  /** false após “Limpar” — evita regravar no localStorage (beforeunload / saveTraining). */
  private persistTrainingEnabled = true
  private hallOfFameScore = 0
  private hallOfFameSnapshot: NetworkSnapshot | null = null

  private training = {
    recorde: 0,
    historico: [] as number[],
    pesoMudou: false,
    lastAvg: 0,
    lastBest: 0,
    vivos: 0,
  }

  private sprite = new Image()
  private callbacks: GameEngineCallbacks

  private bird = {
    frame: 0,
    animTimer: 0,
  }

  private fg = { sX: 276, sY: 0, w: 224, h: 112, y: GAME_HEIGHT - 112 }

  constructor(canvas: HTMLCanvasElement, callbacks: GameEngineCallbacks) {
    this.ctx = canvas.getContext('2d')!
    this.callbacks = callbacks
    this.population = new PopulationMode(1, defaultArchitecture())
    this.displayNn = new NeuralNetwork(this.population.getArchitecture())
    this.sprite.src = '/img/sprite.png'
    this.sprite.onload = () => this.boot()
    if (this.sprite.complete) this.boot()
  }

  setSpeed(speed: number) {
    if (this.playerMode) {
      this.gameSpeed = 1
      return
    }
    this.gameSpeed = Math.max(1, Math.min(MAX_GAME_SPEED, Math.round(speed) || 1))
    this.simAccumulator = Math.min(this.simAccumulator, 1)
  }

  setPaused(paused: boolean) {
    this.paused = paused
  }

  setPopulationSize(size: number) {
    if (this.playerMode) return
    const hadTraining = this.population.size > 0
    this.population.resize(clampPopulationSize(size), {
      preserveChampion: hadTraining,
    })
    this.startFreshRun()
    this.saveTraining()
  }

  getPopulationSize() {
    return this.population.size
  }

  setPlayerMode(enabled: boolean) {
    this.playerMode = enabled
    this.flapQueued = false
    this.playerAwaitingStart = enabled
    this.simAccumulator = 0
    this.paused = false
    this.generationEnding = false

    if (enabled) {
      this.gameSpeed = 1
      this.population.resize(1)
      this.lastPlayerScore = 0
      this.playerShowGameOver = false
    }

    this.startFreshRun()
    this.restartLoopIfNeeded()
  }

  /** O loop pode ter parado após erro na evolução; religa ao trocar de modo. */
  private restartLoopIfNeeded() {
    if (!this.started) return
    cancelAnimationFrame(this.raf)
    this.lastTime = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  playerFlap(pointerX?: number, pointerY?: number) {
    if (!this.playerMode) return
    if (this.playerAwaitingStart) {
      if (this.lastPlayerScore > 0) {
        const fromPointer = pointerX !== undefined && pointerY !== undefined
        if (fromPointer && !isInsideStartBtn(pointerX, pointerY)) return
        this.lastPlayerScore = 0
        this.playerShowGameOver = false
        this.startFreshRun()
        return
      }
      this.startPlayerRun()
      return
    }
    if (this.paused) return
    this.flapQueued = true
  }

  private startPlayerRun() {
    this.playerAwaitingStart = false
    this.playerShowGameOver = false
    this.paused = false
    this.simAccumulator = 0
    this.gameSpeed = 1
    this.startFreshRun()
    const i = this.population.championIndex
    this.population.y[i] = 150
    this.population.speed[i] = 0
    this.flapQueued = true
    this.callbacks.onUiEvent({ genScoreMsg: null })
  }

  clearTraining() {
    this.persistTrainingEnabled = false
    clearTrainingState()
    this.training = {
      recorde: 0,
      historico: [],
      pesoMudou: false,
      lastAvg: 0,
      lastBest: 0,
      vivos: 0,
    }
    this.playerMode = false
    this.playerAwaitingStart = false
    this.lastPlayerScore = 0
    this.playerShowGameOver = false
    this.flapQueued = false
    this.paused = false
    this.gameSpeed = 1
    this.simAccumulator = 0
    this.generationEnding = false
    this.hallOfFameScore = 0
    this.hallOfFameSnapshot = null
    this.lastGeneralizacao = null
    this.population.setGeneration(1)
    this.population.clearLineage()
    this.population.resize(1, { preserveChampion: false })
    this.startFreshRun()
    this.syncDisplayFromChampion()
    this.restartLoopIfNeeded()
    this.callbacks.onUiEvent({
      genScoreMsg: 'Aprendizado zerado — treino recomeçou do zero',
    })
    setTimeout(() => this.callbacks.onUiEvent({ genScoreMsg: null }), 2500)
  }

  /** Preferências de arquitetura (localStorage) antes do treino completo. */
  private applyStoredNnPrefs() {
    const prefs = loadNnPrefs()
    if (!prefs) return
    const arch = {
      inputMode: prefs.inputMode,
      hiddenSize: prefs.hiddenSize,
    }
    this.population.setArchitecture(arch)
    this.population.setEvalSeedCount(prefs.evalSeeds)
    this.displayNn = new NeuralNetwork(arch)
  }

  private boot() {
    if (this.started) return
    this.started = true
    this.applyStoredNnPrefs()
    this.tryRestoreFromStorage()
    if (this.world.pipes.length === 0 && this.world.frame === 0) {
      this.startFreshRun()
    } else {
      this.population.resetBirds()
      this.syncDisplayFromChampion()
    }
    this.loop()
    window.addEventListener('beforeunload', this.persistTraining)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    window.removeEventListener('beforeunload', this.persistTraining)
  }

  private persistTraining = () => {
    this.saveTraining()
  }

  private saveTraining() {
    if (this.playerMode || !this.persistTrainingEnabled) return
    saveTrainingState({
      populationSize: this.population.size,
      generation: this.population.getGeneration(),
      recorde: this.training.recorde,
      historico: this.training.historico,
      lastAvg: this.training.lastAvg,
      lastBest: this.training.lastBest,
      championIndex: this.population.championIndex,
      rngState: this.population.getRngState(),
      networks: this.population.exportSnapshots(),
      hallOfFame: this.hallOfFameScore,
      hallOfFameSnapshot: this.hallOfFameSnapshot,
      inputMode: this.population.getArchitecture().inputMode,
      hiddenSize: this.population.getArchitecture().hiddenSize,
      evalSeeds: this.population.getEvalSeedCount(),
    })
  }

  getNnConfig(): NnConfigState {
    return {
      architecture: { ...this.population.getArchitecture() },
      evalSeeds: this.population.getEvalSeedCount(),
    }
  }

  /**
   * Troca tamanho da rede / entradas / seeds de avaliação.
   * Reinicia aprendizado salvo se a arquitetura mudar (incompatível com snapshots).
   */
  applyNnConfig(config: NnConfigState, opts?: { skipConfirm?: boolean }): boolean {
    const cur = this.getNnConfig()
    const archChanged =
      cur.architecture.inputMode !== config.architecture.inputMode ||
      cur.architecture.hiddenSize !== config.architecture.hiddenSize

    if (archChanged) {
      const hasProgress =
        this.persistTrainingEnabled &&
        (this.training.historico.length > 0 || this.hallOfFameScore > 0)
      if (
        hasProgress &&
        !opts?.skipConfirm &&
        !window.confirm(
          'Mudar neurônios ou entradas reinicia o treino (pesos incompatíveis). Continuar?'
        )
      ) {
        return false
      }
      this.persistTrainingEnabled = false
      clearTrainingState()
      this.training = {
        recorde: 0,
        historico: [],
        pesoMudou: false,
        lastAvg: 0,
        lastBest: 0,
        vivos: 0,
      }
      this.hallOfFameScore = 0
      this.hallOfFameSnapshot = null
      this.lastGeneralizacao = null
      this.population.setGeneration(1)
      this.population.clearLineage()
    }

    this.population.setArchitecture(config.architecture)
    this.population.setEvalSeedCount(config.evalSeeds)
    this.displayNn = new NeuralNetwork(config.architecture)
    if (archChanged) {
      this.population.resize(this.population.size, { preserveChampion: false })
      this.startFreshRun()
    }
    this.syncDisplayFromChampion()
    this.persistTrainingEnabled = true
    saveNnPrefs({
      inputMode: config.architecture.inputMode,
      hiddenSize: config.architecture.hiddenSize,
      evalSeeds: config.evalSeeds,
    })
    this.callbacks.onUiEvent({
      genScoreMsg: `Rede ${architectureLabel(config.architecture)} · ${config.evalSeeds} mapa(s)/pássaro`,
    })
    setTimeout(() => this.callbacks.onUiEvent({ genScoreMsg: null }), 2200)
    return true
  }

  private tryRestoreFromStorage() {
    if (this.playerMode) {
      this.world = this.population.createWorld()
      return
    }

    const saved = loadTrainingState()
    if (!saved) {
      this.world = this.population.createWorld()
      return
    }

    const arch = {
      inputMode: saved.inputMode,
      hiddenSize: saved.hiddenSize,
    }
    this.population.setArchitecture(arch)
    this.population.setEvalSeedCount(saved.evalSeeds)
    this.displayNn = new NeuralNetwork(arch)

    const ok = this.population.importFromSnapshots(
      saved.populationSize,
      saved.networks,
      {
        generation: saved.generation,
        championIndex: saved.championIndex,
        rngState: saved.rngState,
      }
    )
    if (!ok) return

    this.training.recorde = roundScore(saved.recorde)
    this.training.historico = saved.historico.map(roundScore)
    this.training.lastAvg = saved.lastAvg
    this.training.lastBest = saved.lastBest
    if (typeof saved.hallOfFame === 'number' && saved.hallOfFame > 0) {
      this.hallOfFameScore = saved.hallOfFame
      this.hallOfFameSnapshot = saved.hallOfFameSnapshot ?? null
      this.installHallOfFameChampion(saved.lastBest)
    }

    // Padrão: 1 pássaro na UI/motor; mantém o campeão do treino salvo
    if (this.population.size !== 1) {
      this.population.resize(1, { preserveChampion: true })
    }

    this.callbacks.onRestored?.({
      populationSize: 1,
      generation: saved.generation,
      recorde: saved.recorde,
      historicoLength: saved.historico.length,
      architecture: arch,
      evalSeeds: saved.evalSeeds,
    })

    this.callbacks.onUiEvent({
      genScoreMsg: `💾 Progresso restaurado — G${saved.generation} · recorde ${saved.recorde}`,
    })
    setTimeout(() => this.callbacks.onUiEvent({ genScoreMsg: null }), 2500)
  }

  /** Primeira geração ou troca de população — mundo novo. */
  private startFreshRun() {
    this.world = this.population.createWorld()
    this.population.resetBirds()
    this.syncDisplayFromChampion()
  }

  private syncDisplayFromChampion() {
    this.displayNn.copyFrom(this.population.getChampionNetwork())
  }

  private inputsFromState(y: number, speed: number) {
    return computeNnInputs(
      y,
      speed,
      this.world.pipes,
      { w: 53, h: 400, gap: 85 },
      undefined,
      this.population.getArchitecture().inputMode
    )
  }

  private buildChartSeries(): number[] {
    const hist = this.training.historico
    let atual = 0
    for (let i = 0; i < this.population.size; i++) {
      if (this.population.score[i] > atual) atual = this.population.score[i]
    }
    if (hist.length === 0) return atual > 0 ? [atual] : []
    return [...hist, atual]
  }

  private currentBestScore() {
    let best = 0
    for (let i = 0; i < this.population.size; i++) {
      if (this.population.score[i] > best) best = this.population.score[i]
    }
    return best
  }

  private currentAvgScore() {
    let sum = 0
    let n = 0
    for (let i = 0; i < this.population.size; i++) {
      if (this.population.alive[i]) {
        sum += this.population.score[i]
        n++
      }
    }
    if (n === 0) return 0
    return roundScore(sum / n)
  }

  private buildEvolucaoInfo(): PanelEvolucao {
    const hist = this.training.historico
    const melhorUltimaGeracao = hist[hist.length - 1] ?? 0
    const melhorPenultima = hist.length >= 2 ? hist[hist.length - 2]! : 0
    const melhorRodada = this.currentBestScore()
    const mediaRodada = this.currentAvgScore() || this.training.lastAvg
    const layout = getEvolutionLayout(this.population.size)
    const referencia =
      hist.length >= 2 ? melhorPenultima : melhorUltimaGeracao
    const estagnado = Math.max(melhorRodada, melhorUltimaGeracao, this.training.recorde) <= 5

    return {
      geracao: this.population.getGeneration(),
      melhorRodada,
      mediaRodada,
      melhorUltimaGeracao,
      deltaVsAnterior: melhorRodada - referencia,
      recorde: this.training.recorde,
      populacao: this.population.size,
      vivos: this.training.vivos,
      elites: layout.eliteCount,
      imigrantes: layout.immigrantCount,
      filhosMutados: layout.children,
      soloBird: layout.soloBird,
      estagnado,
      modoMutacao: layout.soloBird
        ? estagnado
          ? 'Forte (buscar novo comportamento)'
          : 'Suave (refinar campeão)'
        : estagnado
          ? 'Alta (15% elites + mutação forte)'
          : 'Normal (elites + filhos mutados)',
    }
  }

  private buildPanelState(): PanelState {
    const idx = this.population.championIndex
    const inp = this.inputsFromState(this.population.y[idx], this.population.speed[idx])
    this.displayNn.setInputVector(inp.vector)
    this.displayNn.forward()
    const calculo = this.displayNn.getPanelCalculo()
    const arch = this.population.getArchitecture()

    const hiddenDetail = []
    for (let i = 0; i < arch.hiddenSize; i++) {
      hiddenDetail.push(this.displayNn.getHiddenNeuronDetail(i))
    }

    const campeaoHistorico =
      this.hallOfFameScore > 0 && this.hallOfFameSnapshot
        ? {
            score: this.hallOfFameScore,
            pesos: aggregatedInputWeightsFromSnapshot(
              this.hallOfFameSnapshot,
              arch
            ),
          }
        : null

    const panelInputs: PanelState['inputs'] = {
      distancia_cano: inp.distancia_cano,
      altura_passaro: inp.altura_passaro,
      velocidade: inp.velocidade,
    }
    if (arch.inputMode === 'extended' && 'distancia_segundo' in inp) {
      panelInputs.distancia_segundo = inp.distancia_segundo
      panelInputs.altura_segundo = inp.altura_segundo
    }

    return {
      inputs: panelInputs,
      arquitetura: {
        label: architectureLabel(arch),
        inputMode: arch.inputMode,
        inputSize: this.displayNn.inputSize,
        hiddenSize: arch.hiddenSize,
        evalSeeds: this.population.getEvalSeedCount(),
      },
      generalizacao: this.lastGeneralizacao,
      pesos: this.displayNn.getAggregatedInputWeights(),
      campeaoHistorico,
      calculo,
      progresso: {
        geracao: this.population.getGeneration(),
        pontuacao: this.playerAwaitingStart
          ? this.lastPlayerScore
          : this.population.score[idx],
        recorde: this.training.recorde,
        historico: [...this.training.historico],
        serieGrafico: this.buildChartSeries(),
        populacao: this.population.size,
        vivos: this.training.vivos,
        melhorGeracao: this.currentBestScore(),
        mediaGeracao: this.currentAvgScore() || this.training.lastAvg,
        hallOfFame: this.hallOfFameScore,
      },
      diagram: this.displayNn.getActivationsForDiagram(),
      weights: this.displayNn.getAllWeights(),
      hiddenDetail,
      evolucao: this.buildEvolucaoInfo(),
      pesoMudou: this.training.pesoMudou,
      modoPopulacao: !this.playerMode && this.population.size > 1,
      modoJogador: this.playerMode,
      playerAguardandoInicio: this.playerMode && this.playerAwaitingStart,
    }
  }

  private onPlayerDeath() {
    const idx = this.population.championIndex
    const score = this.population.score[idx] ?? 0
    this.lastPlayerScore = score
    this.playerShowGameOver = true

    if (score > this.training.recorde) {
      this.training.recorde = score
      this.callbacks.onUiEvent({
        flashRecord: Date.now(),
        recordBanner: `🏆 NOVO RECORDE: ${score}`,
      })
      setTimeout(() => this.callbacks.onUiEvent({ recordBanner: null }), 2000)
    }

    this.playerAwaitingStart = true
  }

  /** Telas Get Ready / Game Over do sprite original (modo jogador). */
  private drawClassicPlayerScreen() {
    const { ctx } = this

    if (this.playerShowGameOver) {
      const g = GAME_OVER_SPRITE
      ctx.drawImage(
        this.sprite,
        g.sX,
        g.sY,
        g.w,
        g.h,
        g.x,
        g.y,
        g.w,
        g.h
      )
      drawPlayerScore(
        ctx,
        'gameover',
        this.lastPlayerScore,
        this.training.recorde
      )
      drawPlayerMedal(ctx, this.sprite, this.lastPlayerScore)
    } else {
      const r = GET_READY_SPRITE
      ctx.drawImage(
        this.sprite,
        r.sX,
        r.sY,
        r.w,
        r.h,
        r.x,
        r.y,
        r.w,
        r.h
      )
    }
  }

  private syncPlayerIdleBird() {
    if (!this.playerMode || !this.playerAwaitingStart) return
    const i = this.population.championIndex
    this.population.y[i] = 150
    this.population.speed[i] = 0
  }

  private updateHallOfFame(score: number, snapshot: NetworkSnapshot | null) {
    const pts = roundScore(score)
    if (!snapshot || pts <= this.hallOfFameScore) return
    this.hallOfFameScore = pts
    this.hallOfFameSnapshot = snapshot
  }

  /** Campeão = melhor genoma histórico (explora mutação leve só com 1 pássaro no recorde). */
  private installHallOfFameChampion(generationBest: number) {
    const snap = this.hallOfFameSnapshot
    if (!snap || this.population.size === 0) return

    const champ = new NeuralNetwork(this.population.getArchitecture())
    champ.loadSnapshot(snap)
    if (
      this.population.size === 1 &&
      generationBest >= this.hallOfFameScore &&
      this.hallOfFameScore >= 15
    ) {
      champ.mutate(0.035, 0.09)
    }
    this.population.networks[0] = champ
    this.population.championIndex = 0
    this.population.setRankedSnapshot(0, snap)
    this.syncDisplayFromChampion()
  }

  private async onGenerationComplete() {
    if (this.playerMode || this.generationEnding) return

    this.generationEnding = true
    const previousBest =
      this.training.historico[this.training.historico.length - 1] ??
      this.training.lastBest ??
      0

    const evalSeeds = this.population.getEvalSeedCount()
    const pop = this.population.size
    if (evalSeeds > 1) {
      this.callbacks.onUiEvent({
        backpropDeath: true,
        backpropAdjusting: `Avaliando fitness (${evalSeeds} mapas × ${pop} pássaros)…`,
      })
    }

    let result: Awaited<ReturnType<PopulationMode['endGeneration']>>
    try {
      result = await this.population.endGeneration(previousBest)
    } catch (err) {
      console.error('[Flappy] Falha ao evoluir geração:', err)
      this.generationEnding = false
      this.callbacks.onUiEvent({ backpropDeath: false, backpropAdjusting: '' })
      this.startFreshRun()
      this.restartLoopIfNeeded()
      return
    }

    const visualBest = roundScore(result.bestScore)
    if (result.visualBestSnapshot) {
      this.updateHallOfFame(visualBest, result.visualBestSnapshot)
    }
    this.installHallOfFameChampion(visualBest)

    this.simAccumulator = 0
    // Mundo novo + pássaros no início (evita renascer dentro de cano antigo)
    this.startFreshRun()
    this.generationEnding = false
    // Recorde e gráfico = partida visível (o que aparece no canvas)
    const chartScore = visualBest
    this.training.lastBest =
      result.evalSeeds > 1 ? roundScore(result.fitnessBest) : chartScore
    this.training.lastAvg = roundScore(result.fitnessAvg)
    this.training.historico.push(chartScore)
    this.lastGeneralizacao = {
      evalSeeds: result.evalSeeds,
      melhorVisual: roundScore(result.bestScore),
      melhorFitness: roundScore(result.fitnessBest),
      mediaFitness: roundScore(result.fitnessAvg),
    }

    if (visualBest > this.training.recorde) {
      this.training.recorde = visualBest
      this.callbacks.onUiEvent({
        flashRecord: Date.now(),
        recordBanner: `🏆 NOVO RECORDE: ${visualBest}`,
      })
      setTimeout(() => this.callbacks.onUiEvent({ recordBanner: null }), 2000)
    }

    const genMsg =
      result.evalSeeds > 1
        ? `G${result.generation - 1}: fitness ${roundScore(result.fitnessBest)} (${result.evalSeeds} mapas) · visual ${roundScore(result.bestScore)}`
        : `G${result.generation - 1}: melhor ${roundScore(result.bestScore)} · média ${roundScore(result.avgScore)}`
    this.callbacks.onUiEvent({
      genScoreMsg: `${genMsg} (${this.population.size} pássaros)`,
    })
    setTimeout(() => this.callbacks.onUiEvent({ genScoreMsg: null }), 1200)

    this.training.pesoMudou = true
    setTimeout(() => {
      this.training.pesoMudou = false
    }, 400)

    const layout = getEvolutionLayout(this.population.size)
    const g = result.generation - 1
    const evolveMsg = layout.soloBird
      ? `G${g}: mutando campeão (${result.bestScore} canos)`
      : `G${g}: ${layout.eliteCount} elites · ${layout.children} filhos · ${layout.immigrantCount} novos`

    this.callbacks.onUiEvent({
      backpropDeath: true,
      backpropAdjusting: evolveMsg,
    })
    setTimeout(() => {
      this.callbacks.onUiEvent({
        backpropDeath: false,
        backpropAdjusting: `✓ G${g} · melhor ${roundScore(result.bestScore)} · média ${roundScore(result.avgScore)}`,
      })
    }, 600)
    setTimeout(() => {
      this.callbacks.onUiEvent({ backpropAdjusting: '' })
    }, 1400)

    this.persistTrainingEnabled = true
    queueMicrotask(() => this.saveTraining())
  }

  private drawBirdSprite(
    x: number,
    y: number,
    speed: number,
    variant: BirdSpriteVariant,
    animIndex: number,
    highlight = false
  ) {
    const { ctx } = this
    const rotation = speed >= 4.6 ? 90 * DEGREE : -25 * DEGREE
    const frame = birdSpriteFrame(variant, animIndex)
    const w = BIRD_SPRITE_W
    const h = BIRD_SPRITE_H

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rotation)
    ctx.drawImage(
      this.sprite,
      frame.sX,
      frame.sY,
      w,
      h,
      -w / 2,
      -h / 2,
      w,
      h
    )
    if (highlight) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.strokeRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2)
    }
    ctx.restore()
  }

  private drawAllBirds() {
    const pop = this.population
    const champion = pop.championIndex
    const baseFrame = this.bird.frame

    for (let i = 0; i < pop.size; i++) {
      if (!pop.alive[i] || i === champion) continue
      const variant: BirdSpriteVariant = i % 2 === 0 ? 'yellow' : 'gray'
      this.drawBirdSprite(
        50,
        pop.y[i],
        pop.speed[i],
        variant,
        baseFrame + i
      )
    }

    if (pop.alive[champion]) {
      this.drawBirdSprite(
        50,
        pop.y[champion],
        pop.speed[champion],
        'yellow',
        baseFrame + champion,
        true
      )
    }
  }

  /** Modo jogador: um pássaro sem destaque de campeão (visual original). */
  private drawPlayerBird() {
    const pop = this.population
    const i = pop.championIndex
    if (!pop.alive[i]) return
    this.drawBirdSprite(
      50,
      pop.y[i],
      pop.speed[i],
      'yellow',
      this.bird.frame,
      false
    )
  }

  private draw() {
    const { ctx } = this

    ctx.fillStyle = '#70c5ce'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const bg = { sX: 0, sY: 0, w: 275, h: 226, y: GAME_HEIGHT - 226 }
    ctx.drawImage(this.sprite, bg.sX, bg.sY, bg.w, bg.h, 0, bg.y, bg.w, bg.h)
    ctx.drawImage(this.sprite, bg.sX, bg.sY, bg.w, bg.h, bg.w, bg.y, bg.w, bg.h)

    for (const p of this.world.pipes) {
      const bottomY = p.y + 400 + 85
      ctx.drawImage(this.sprite, 553, 0, 53, 400, p.x, p.y, 53, 400)
      ctx.drawImage(this.sprite, 502, 0, 53, 400, p.x, bottomY, 53, 400)
    }

    const fgX = this.world.fgX
    ctx.drawImage(this.sprite, 276, 0, 224, 112, fgX, this.fg.y, 224, 112)
    ctx.drawImage(this.sprite, 276, 0, 224, 112, fgX + 224, this.fg.y, 224, 112)

    this.syncPlayerIdleBird()

    if (this.playerMode) {
      this.drawPlayerBird()
    } else {
      this.drawAllBirds()
    }

    const idx = this.population.championIndex
    const awaiting = this.playerMode && this.playerAwaitingStart

    if (this.playerMode) {
      if (awaiting) {
        this.drawClassicPlayerScreen()
      } else {
        drawPlayerScore(ctx, 'playing', this.population.score[idx], this.training.recorde)
      }
    } else {
      const score = this.population.score[idx]
      ctx.fillStyle = '#FFF'
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 1
      ctx.font = '35px Teko, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(score), GAME_WIDTH / 2, 50)
      ctx.strokeText(String(score), GAME_WIDTH / 2, 50)
      ctx.textAlign = 'left'

      ctx.font = '14px monospace'
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.fillRect(4, GAME_HEIGHT - 22, 130, 18)
      ctx.fillStyle = '#e2e8f0'
      ctx.fillText(
        `${this.training.vivos}/${this.population.size} vivos · ×${this.gameSpeed}`,
        8,
        GAME_HEIGHT - 8
      )
    }
  }

  /**
   * dt em “frames de 60fps” (16,67ms).
   * ×1 ≈ 1 passo de simulação por frame desenhado (~60 passos/s).
   * ×N ≈ N passos por frame (turbo visual) — cada passo igual ao ×1 (scaled=1).
   */
  private runSimulationSteps(dt: number) {
    if (this.playerMode) {
      if (this.playerAwaitingStart) return
    }

    this.simAccumulator += dt * this.gameSpeed
    const maxSteps = Math.max(8, this.gameSpeed * 8)
    let steps = 0

    while (this.simAccumulator >= 1 && steps < maxSteps) {
      this.simAccumulator -= 1
      steps++

      const flap = this.playerMode && this.flapQueued
      if (this.playerMode) this.flapQueued = false

      const result = this.population.step(this.world, 1, {
        playerControl: this.playerMode,
        playerFlap: flap,
      })
      this.training.vivos = result.alive
      this.syncDisplayFromChampion()

      if (result.allDead) {
        if (this.playerMode) {
          this.onPlayerDeath()
        } else {
          void this.onGenerationComplete()
        }
        break
      }
    }

    this.bird.animTimer += dt
    if (this.bird.animTimer >= 5) {
      this.bird.frame = (this.bird.frame + 1) % BIRD_YELLOW_FRAMES.length
      this.bird.animTimer = 0
    }
  }

  private shouldSyncPanel() {
    const interval = this.paused ? 6 : 3
    return this.frames % interval === 0
  }

  private loop = (now = 0) => {
    try {
      const dt = this.lastTime ? Math.min((now - this.lastTime) / 16.67, 2) : 1
      this.lastTime = now

      const awaitingStart = this.playerMode && this.playerAwaitingStart

      if (awaitingStart) {
        this.bird.animTimer += dt
        if (this.bird.animTimer >= 10) {
          this.bird.frame =
            (this.bird.frame + 1) % BIRD_YELLOW_FRAMES.length
          this.bird.animTimer = 0
        }
      } else if (!this.paused) {
        this.runSimulationSteps(dt)
      }

      this.draw()

      this.frames++
      if (this.shouldSyncPanel()) {
        this.callbacks.onState(this.buildPanelState())
      }
    } catch (err) {
      console.error('[Flappy] Erro no loop do jogo:', err)
      this.generationEnding = false
      this.startFreshRun()
    }

    this.raf = requestAnimationFrame(this.loop)
  }
}
