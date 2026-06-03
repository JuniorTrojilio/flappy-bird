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
import { HIDDEN_SIZE } from '@/lib/nn-architecture'
import { NeuralNetwork } from '@/lib/neural-network'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'
import {
  clearTrainingState,
  loadTrainingState,
  saveTrainingState,
} from '@/lib/training-storage'
import { computeNnInputs } from '@/game/nn-inputs'
import { getEvolutionLayout } from '@/lib/population-evolution'
import type { PanelEvolucao } from '@/lib/panel-types'

const DEGREE = Math.PI / 180
export type RestoredTrainingInfo = {
  populationSize: number
  generation: number
  recorde: number
  historicoLength: number
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
  private displayNn = new NeuralNetwork()
  private population: PopulationMode
  private world: WorldState = { pipes: [], spawnTimer: 0, fgX: 0, frame: 0 }

  private frames = 0
  private lastTime = 0
  private raf = 0
  private started = false

  gameSpeed = 1
  paused = false
  playerMode = false
  playerAwaitingStart = false
  private lastPlayerScore = 0
  private flapQueued = false
  private simAccumulator = 0
  private generationEnding = false

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
    this.population = new PopulationMode(1)
    this.sprite.src = '/img/sprite.png'
    this.sprite.onload = () => this.boot()
    if (this.sprite.complete) this.boot()
  }

  setSpeed(speed: number) {
    this.gameSpeed = Math.max(1, Math.min(10, Math.round(speed) || 1))
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
    this.playerAwaitingStart = false
    this.simAccumulator = 0
    this.paused = false
    this.generationEnding = false

    if (enabled) {
      this.population.resize(1)
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

  playerFlap() {
    if (!this.playerMode) return
    if (this.playerAwaitingStart) {
      this.startPlayerRun()
      return
    }
    if (this.paused) return
    this.flapQueued = true
  }

  private startPlayerRun() {
    this.playerAwaitingStart = false
    this.paused = false
    this.simAccumulator = 0
    this.startFreshRun()
    this.callbacks.onUiEvent({ genScoreMsg: null })
  }

  clearTraining() {
    clearTrainingState()
    this.training = {
      recorde: 0,
      historico: [],
      pesoMudou: false,
      lastAvg: 0,
      lastBest: 0,
      vivos: 0,
    }
    this.population.setGeneration(1)
    this.population.clearLineage()
    if (!this.playerMode) {
      this.population.resize(1, { preserveChampion: false })
    }
    this.startFreshRun()
    this.callbacks.onUiEvent({
      genScoreMsg: 'Aprendizado zerado — treino recomeçou do zero',
    })
    setTimeout(() => this.callbacks.onUiEvent({ genScoreMsg: null }), 2500)
  }

  private boot() {
    if (this.started) return
    this.started = true
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
    if (this.playerMode) return
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
    })
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

    this.training.recorde = saved.recorde
    this.training.historico = [...saved.historico]
    this.training.lastAvg = saved.lastAvg
    this.training.lastBest = saved.lastBest

    this.callbacks.onRestored?.({
      populationSize: saved.populationSize,
      generation: saved.generation,
      recorde: saved.recorde,
      historicoLength: saved.historico.length,
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
    return computeNnInputs(y, speed, this.world.pipes, {
      w: 53,
      h: 400,
      gap: 85,
    })
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
    return Math.round((sum / n) * 10) / 10
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
    this.displayNn.setInputs(inp.distancia_cano, inp.altura_passaro, inp.velocidade)
    this.displayNn.forward()
    const calculo = this.displayNn.getPanelCalculo()

    const hiddenDetail = []
    for (let i = 0; i < HIDDEN_SIZE; i++) {
      hiddenDetail.push(this.displayNn.getHiddenNeuronDetail(i))
    }

    return {
      inputs: inp,
      pesos: this.displayNn.getAggregatedInputWeights(),
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
    const score = this.population.score[0] ?? 0
    this.lastPlayerScore = score

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

  private drawPlayerStartOverlay() {
    const { ctx } = this
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    const score = this.lastPlayerScore
    ctx.textAlign = 'center'
    ctx.fillStyle = '#e2e8f0'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 3

    ctx.font = 'bold 42px Teko, sans-serif'
    const title = score > 0 ? 'FIM DE JOGO' : 'FLAPPY BIRD'
    ctx.strokeText(title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 56)
    ctx.fillText(title, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 56)

    if (score > 0) {
      ctx.font = '28px Teko, sans-serif'
      const pts = `${score} ponto${score === 1 ? '' : 's'}`
      ctx.strokeText(pts, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12)
      ctx.fillText(pts, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 12)
    }

    ctx.font = '18px Teko, sans-serif'
    const hint = 'Clique ou Espaço para jogar'
    ctx.strokeText(hint, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36)
    ctx.fillText(hint, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 36)

    ctx.textAlign = 'left'
  }

  private onGenerationComplete() {
    if (this.playerMode || this.generationEnding) return

    this.generationEnding = true
    const previousBest =
      this.training.historico[this.training.historico.length - 1] ??
      this.training.lastBest ??
      0
    let result: ReturnType<PopulationMode['endGeneration']>
    try {
      result = this.population.endGeneration(previousBest)
    } catch (err) {
      console.error('[Flappy] Falha ao evoluir geração:', err)
      this.generationEnding = false
      this.startFreshRun()
      this.restartLoopIfNeeded()
      return
    }

    this.simAccumulator = 0
    // Mundo novo + pássaros no início (evita renascer dentro de cano antigo)
    this.startFreshRun()
    this.generationEnding = false

    this.training.lastBest = result.bestScore
    this.training.lastAvg = result.avgScore
    this.training.historico.push(result.bestScore)

    if (result.bestScore > this.training.recorde) {
      this.training.recorde = result.bestScore
      this.callbacks.onUiEvent({
        flashRecord: Date.now(),
        recordBanner: `🏆 NOVO RECORDE: ${result.bestScore}`,
      })
      setTimeout(() => this.callbacks.onUiEvent({ recordBanner: null }), 2000)
    }

    this.callbacks.onUiEvent({
      genScoreMsg: `G${result.generation - 1}: melhor ${result.bestScore} · média ${result.avgScore.toFixed(1)} (${this.population.size} pássaros)`,
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
        backpropAdjusting: `✓ G${g} · melhor ${result.bestScore} · média ${result.avgScore.toFixed(1)}`,
      })
    }, 600)
    setTimeout(() => {
      this.callbacks.onUiEvent({ backpropAdjusting: '' })
    }, 1400)

    this.saveTraining()
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

    this.drawAllBirds()

    const idx = this.population.championIndex
    const score = this.playerAwaitingStart
      ? this.lastPlayerScore
      : this.population.score[idx]

    ctx.fillStyle = '#FFF'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 1
    ctx.font = '35px Teko, sans-serif'
    ctx.fillText(String(score), GAME_WIDTH / 2, 50)
    ctx.strokeText(String(score), GAME_WIDTH / 2, 50)

    ctx.font = '14px monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(4, GAME_HEIGHT - 22, 130, 18)
    ctx.fillStyle = '#e2e8f0'
    const hud = this.playerMode
      ? `Jogador · rec ${this.training.recorde} · ×${this.gameSpeed}`
      : `${this.training.vivos}/${this.population.size} vivos · ×${this.gameSpeed}`
    ctx.fillText(hud, 8, GAME_HEIGHT - 8)

    if (this.playerMode && this.playerAwaitingStart) {
      this.drawPlayerStartOverlay()
    }
  }

  /**
   * dt em “frames de 60fps” (16,67ms).
   * ×1 acumula ~1 unidade por frame real → ~60 passos/s em qualquer monitor.
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
        playerFlap: flap,
      })
      this.training.vivos = result.alive
      this.syncDisplayFromChampion()

      if (result.allDead) {
        if (this.playerMode) {
          this.onPlayerDeath()
        } else {
          this.onGenerationComplete()
        }
        break
      }
    }

    this.bird.animTimer += steps
    if (this.bird.animTimer >= 5) {
      this.bird.frame = (this.bird.frame + 1) % BIRD_YELLOW_FRAMES.length
      this.bird.animTimer = 0
    }
  }

  private shouldSyncPanel() {
    const interval = this.paused ? 3 : this.gameSpeed >= 10 ? 8 : this.gameSpeed >= 5 ? 5 : 3
    return this.frames % interval === 0
  }

  private loop = (now = 0) => {
    try {
      const dt = this.lastTime ? Math.min((now - this.lastTime) / 16.67, 2) : 1
      this.lastTime = now

      const awaitingStart = this.playerMode && this.playerAwaitingStart

      if (!this.paused && !awaitingStart) {
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
