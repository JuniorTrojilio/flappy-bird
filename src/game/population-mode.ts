import {
  BIRD_H,
  BIRD_HALF_EXTENT,
  GAME_WIDTH,
  GROUND_Y,
} from '@/game/constants'
import {
  birdHitsPipeAlongPath,
  type PipeCollisionConfig,
} from '@/game/collision'
import { computeNnInputs } from '@/game/nn-inputs'
import { evolvePopulation } from '@/lib/population-evolution'
import type { NetworkSnapshot } from '@/lib/neural-network'
import { NeuralNetwork } from '@/lib/neural-network'

const GRAVITY = 0.25
const JUMP = 4.6
const MIN_Y = BIRD_H / 2

function touchesGround(centerY: number) {
  return centerY + BIRD_HALF_EXTENT >= GROUND_Y
}

export type Pipe = { x: number; y: number }

export type WorldState = {
  pipes: Pipe[]
  spawnTimer: number
  fgX: number
  frame: number
}

export type PopulationStepResult = {
  alive: number
  championIndex: number
  allDead: boolean
}

export type PopulationStepOptions = {
  /** Modo jogador ativo (não usar rede para bater asa) */
  playerControl?: boolean
  /** Neste passo o jogador pediu asa (tecla/clique) */
  playerFlap?: boolean
}

export type ChampionContinueState = {
  y: number
  score: number
}

export type GenerationEndResult = {
  bestScore: number
  avgScore: number
  bestIndex: number
  generation: number
  /** Rede do melhor pássaro desta geração (antes da mutação). */
  generationBestSnapshot: NetworkSnapshot | null
}

export const POPULATION_MIN = 1
export const POPULATION_MAX = 5000

export function clampPopulationSize(size: number) {
  return Math.min(POPULATION_MAX, Math.max(POPULATION_MIN, Math.round(size) || POPULATION_MIN))
}

export class PopulationMode {
  size = 0
  networks: NeuralNetwork[] = []
  y = new Float32Array(0)
  speed = new Float32Array(0)
  alive = new Uint8Array(0)
  score = new Uint32Array(0)

  championIndex = 0
  private rngState = 1
  private generation = 1
  /** Melhores redes da geração (ordem: campeão → demais), capturadas antes da evolução */
  private rankedSnapshots: NetworkSnapshot[] = []
  private pipeConfig = { w: 53, h: 400, gap: 85, maxYPos: -150, dx: 2 }

  constructor(size: number) {
    this.resize(size)
  }

  /** Atualiza elites se a geração atual já pontuou (redes ainda batem com score[]). */
  private syncRankedSnapshotsFromCurrentRun() {
    if (this.size === 0) return
    const scores = Array.from(this.score)
    const best = Math.max(0, ...scores)
    if (best === 0) return

    const ranked = scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score || a.index - b.index)

    this.rankedSnapshots = ranked.map((r) =>
      this.networks[r.index].toSnapshot()
    )
  }

  private captureRankedSnapshots(scores: number[]) {
    const ranked = scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score || a.index - b.index)

    this.rankedSnapshots = ranked.map((r) =>
      this.networks[r.index].toSnapshot()
    )
  }

  private buildNetworksFromEliteSnapshots(newSize: number): NeuralNetwork[] {
    const next: NeuralNetwork[] = []

    if (this.rankedSnapshots.length > 0) {
      const keep = Math.min(newSize, this.rankedSnapshots.length)
      for (let i = 0; i < keep; i++) {
        const net = new NeuralNetwork()
        net.loadSnapshot(this.rankedSnapshots[i]!)
        next.push(net)
      }
    } else if (this.size > 0) {
      next.push(this.getChampionNetwork().clone())
    }

    if (next.length === 0) {
      return Array.from({ length: newSize }, () => new NeuralNetwork())
    }

    const seed = next[0]!
    while (next.length < newSize) {
      const variant = seed.clone()
      variant.mutate(0.05, 0.15)
      next.push(variant)
    }

    return next
  }

  resize(size: number, opts?: { preserveChampion?: boolean }) {
    const newSize = size
    const oldSize = this.size
    const preserve = opts?.preserveChampion === true && oldSize > 0

    this.y = new Float32Array(newSize)
    this.speed = new Float32Array(newSize)
    this.alive = new Uint8Array(newSize)
    this.score = new Uint32Array(newSize)

    if (newSize <= 0) {
      this.size = 0
      this.networks = []
      this.championIndex = 0
      return
    }

    if (preserve && newSize === oldSize) {
      this.size = newSize
      return
    }

    if (!preserve || oldSize === 0) {
      this.size = newSize
      this.networks = Array.from({ length: newSize }, () => new NeuralNetwork())
      this.championIndex = 0
      this.rankedSnapshots = []
      return
    }

    // Partida em andamento: redes ainda correspondem a score[] desta geração
    this.syncRankedSnapshotsFromCurrentRun()

    this.size = newSize
    this.networks = this.buildNetworksFromEliteSnapshots(newSize)
    this.championIndex = 0
  }

  clearLineage() {
    this.rankedSnapshots = []
  }

  setRankedSnapshot(index: number, snapshot: NetworkSnapshot) {
    const next = [...this.rankedSnapshots]
    next[index] = snapshot
    this.rankedSnapshots = next
  }

  getChampionNetwork() {
    return this.networks[this.championIndex] ?? this.networks[0]
  }

  getAliveCount() {
    let n = 0
    for (let i = 0; i < this.size; i++) {
      if (this.alive[i]) n++
    }
    return n
  }

  createWorld(): WorldState {
    this.rngState = (this.rngState + this.generation * 7919) >>> 0
    return { pipes: [], spawnTimer: 0, fgX: 0, frame: 0 }
  }

  resetBirds(continueChampion?: ChampionContinueState) {
    for (let i = 0; i < this.size; i++) {
      if (i === 0 && continueChampion) {
        this.y[i] = continueChampion.y
        this.speed[i] = -JUMP
        this.alive[i] = 1
        this.score[i] = continueChampion.score
      } else {
        this.y[i] = 150
        this.speed[i] = -JUMP
        this.alive[i] = 1
        this.score[i] = 0
      }
    }
    this.championIndex = 0
  }

  private randomPipeY() {
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0
    return this.pipeConfig.maxYPos * ((this.rngState / 0xffffffff) + 1)
  }

  private canSpawn(world: WorldState) {
    return !world.pipes.some((p) => p.x > GAME_WIDTH - 120)
  }

  private spawnPipe(world: WorldState) {
    if (!this.canSpawn(world)) return
    world.pipes.push({ x: GAME_WIDTH, y: this.randomPipeY() })
  }

  private inputsFor(y: number, speed: number, world: WorldState) {
    return computeNnInputs(y, speed, world.pipes, this.pipeConfig, JUMP)
  }

  private pickChampion() {
    let best = 0
    let bestScore = -1
    let anyAlive = false
    for (let i = 0; i < this.size; i++) {
      if (this.alive[i]) anyAlive = true
      if (this.score[i] >= bestScore) {
        bestScore = this.score[i]
        best = i
      }
    }
    if (!anyAlive) {
      for (let i = 0; i < this.size; i++) {
        if (this.score[i] > bestScore) {
          bestScore = this.score[i]
          best = i
        }
      }
    }
    this.championIndex = best
  }

  step(
    world: WorldState,
    scaled: number,
    opts?: PopulationStepOptions
  ): PopulationStepResult {
    world.frame += scaled
    world.fgX = (world.fgX - this.pipeConfig.dx * scaled) % 112

    world.spawnTimer += scaled
    if (world.spawnTimer >= 100) {
      world.spawnTimer = 0
      this.spawnPipe(world)
    }

    const pipeDx = this.pipeConfig.dx * scaled
    const pipeHitCfg: PipeCollisionConfig = {
      w: this.pipeConfig.w,
      h: this.pipeConfig.h,
      gap: this.pipeConfig.gap,
    }

    for (let j = world.pipes.length - 1; j >= 0; j--) {
      const p = world.pipes[j]
      p.x -= pipeDx
      if (p.x + this.pipeConfig.w <= 0) {
        world.pipes.splice(j, 1)
        for (let i = 0; i < this.size; i++) {
          if (this.alive[i]) this.score[i]++
        }
      }
    }

    let aliveCount = 0

    for (let i = 0; i < this.size; i++) {
      if (!this.alive[i]) continue
      aliveCount++

      const inp = this.inputsFor(this.y[i], this.speed[i], world)
      const nn = this.networks[i]
      nn.setInputs(inp.distancia_cano, inp.altura_passaro, inp.velocidade)
      nn.forward()

      const shouldFlap = opts?.playerControl
        ? !!opts.playerFlap &&
          this.y[i] > MIN_Y &&
          !touchesGround(this.y[i])
        : nn.decide() === 'bate' &&
          this.y[i] > MIN_Y &&
          !touchesGround(this.y[i])

      if (shouldFlap) {
        this.speed[i] = -JUMP
      }

      this.speed[i] += GRAVITY * scaled
      const startY = this.y[i]
      let endY = startY + this.speed[i] * scaled

      if (endY < MIN_Y) {
        endY = MIN_Y
        if (this.speed[i] < 0) this.speed[i] = 0
      }

      if (touchesGround(endY)) {
        this.y[i] = GROUND_Y - BIRD_HALF_EXTENT
        this.alive[i] = 0
        aliveCount--
        continue
      }

      if (birdHitsPipeAlongPath(startY, endY, world.pipes, pipeHitCfg)) {
        this.alive[i] = 0
        aliveCount--
        continue
      }

      this.y[i] = endY
    }

    this.pickChampion()

    return {
      alive: aliveCount,
      championIndex: this.championIndex,
      allDead: aliveCount === 0,
    }
  }

  endGeneration(previousBest = 0): GenerationEndResult {
    const scores = Array.from(this.score)
    // Antes de evoluir: índices de score[] ainda batem com networks[]
    this.captureRankedSnapshots(scores)
    const evolved = evolvePopulation(this.networks, scores, { previousBest })
    this.networks = evolved.population
    this.generation++
    this.championIndex = 0
    // Com vários pássaros, garante networks[0] = melhor pré-evolução (filhos podem ter sido reordenados)
    if (this.size > 1 && this.rankedSnapshots[0]) {
      const champ = new NeuralNetwork()
      champ.loadSnapshot(this.rankedSnapshots[0])
      this.networks[0] = champ
    } else if (this.networks[0]) {
      // 1 pássaro: mantém rede já mutada e atualiza snapshot para resize
      this.rankedSnapshots = [this.networks[0].toSnapshot()]
    }
    return {
      bestScore: evolved.bestScore,
      avgScore: evolved.avgScore,
      bestIndex: evolved.bestIndex,
      generation: this.generation,
      generationBestSnapshot: this.rankedSnapshots[0] ?? null,
    }
  }

  getGeneration() {
    return this.generation
  }

  setGeneration(generation: number) {
    this.generation = Math.max(1, generation)
  }

  getRngState() {
    return this.rngState
  }

  setRngState(state: number) {
    this.rngState = state >>> 0
  }

  exportSnapshots(): NetworkSnapshot[] {
    return this.networks.map((n) => n.toSnapshot())
  }

  importFromSnapshots(
    size: number,
    snapshots: NetworkSnapshot[],
    opts: { generation: number; championIndex: number; rngState: number }
  ) {
    if (snapshots.length !== size) return false
    this.size = size
    this.networks = snapshots.map((s) => {
      const net = new NeuralNetwork()
      net.loadSnapshot(s)
      return net
    })
    this.y = new Float32Array(size)
    this.speed = new Float32Array(size)
    this.alive = new Uint8Array(size)
    this.score = new Uint32Array(size)
    this.generation = Math.max(1, opts.generation)
    this.championIndex = Math.min(
      Math.max(0, opts.championIndex),
      size - 1
    )
    this.rngState = opts.rngState >>> 0
    const champ = this.networks[this.championIndex]
    this.rankedSnapshots = champ
      ? [
          champ.toSnapshot(),
          ...this.networks
            .filter((_, i) => i !== this.championIndex)
            .map((n) => n.toSnapshot()),
        ]
      : this.networks.map((n) => n.toSnapshot())
    return true
  }
}
