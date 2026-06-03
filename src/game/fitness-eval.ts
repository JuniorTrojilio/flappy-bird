/**
 * Simula partidas “invisíveis” para medir quão boa é uma rede em vários mapas (generalização).
 * Roda no Worker quando possível para não travar a tela.
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import {
  birdHitsPipeAlongPath,
  type PipeCollisionConfig,
} from '@/game/collision'
import { computeNnInputs } from '@/game/nn-inputs'
import type { InputMode } from '@/lib/nn-config'
import type { NeuralNetwork } from '@/lib/neural-network'
import {
  BIRD_H,
  BIRD_HALF_EXTENT,
  GAME_WIDTH,
  GROUND_Y,
} from '@/game/constants'
type SimPipe = { x: number; y: number }
type SimWorld = {
  pipes: SimPipe[]
  spawnTimer: number
  fgX: number
  frame: number
}

const GRAVITY = 0.25
const JUMP = 4.6
const MIN_Y = BIRD_H / 2
const MAX_FRAMES = 14_000

function touchesGround(centerY: number) {
  return centerY + BIRD_HALF_EXTENT >= GROUND_Y
}

export type FitnessSimConfig = {
  pipe: PipeCollisionConfig & { maxYPos: number; dx: number }
  inputMode: InputMode
  jumpForce?: number
}

/** Uma partida completa em mundo isolado (para fitness multi-seed). */
export function runSilentEpisode(
  network: NeuralNetwork,
  seed: number,
  cfg: FitnessSimConfig
): number {
  let rng = (seed >>> 0) || 1
  const randomPipeY = () => {
    rng = (rng * 1664525 + 1013904223) >>> 0
    return cfg.pipe.maxYPos * ((rng / 0xffffffff) + 1)
  }
  const canSpawn = (world: SimWorld) =>
    !world.pipes.some((p) => p.x > GAME_WIDTH - 120)
  const spawnPipe = (world: SimWorld) => {
    if (!canSpawn(world)) return
    world.pipes.push({ x: GAME_WIDTH, y: randomPipeY() })
  }

  const world: SimWorld = {
    pipes: [],
    spawnTimer: 0,
    fgX: 0,
    frame: 0,
  }
  let y = 150
  let speed = -JUMP
  let score = 0
  const scaled = 1
  const pipeHitCfg: PipeCollisionConfig = {
    w: cfg.pipe.w,
    h: cfg.pipe.h,
    gap: cfg.pipe.gap,
  }
  const jumpForce = cfg.jumpForce ?? JUMP

  while (world.frame < MAX_FRAMES) {
    world.frame += scaled
    world.spawnTimer += scaled
    if (world.spawnTimer >= 100) {
      world.spawnTimer = 0
      spawnPipe(world)
    }

    const pipeDx = cfg.pipe.dx * scaled
    for (let j = world.pipes.length - 1; j >= 0; j--) {
      const p = world.pipes[j]
      p.x -= pipeDx
      if (p.x + cfg.pipe.w <= 0) {
        world.pipes.splice(j, 1)
        score++
      }
    }

    const inp = computeNnInputs(
      y,
      speed,
      world.pipes,
      { w: cfg.pipe.w, h: cfg.pipe.h, gap: cfg.pipe.gap },
      jumpForce,
      cfg.inputMode
    )
    network.setInputVector(inp.vector)
    network.forward()

    const shouldFlap =
      network.decide() === 'bate' &&
      y > MIN_Y &&
      !touchesGround(y)

    if (shouldFlap) speed = -JUMP
    speed += GRAVITY * scaled
    const startY = y
    let endY = startY + speed * scaled
    if (endY < MIN_Y) {
      endY = MIN_Y
      if (speed < 0) speed = 0
    }
    if (touchesGround(endY)) return score
    if (birdHitsPipeAlongPath(startY, endY, world.pipes, pipeHitCfg)) {
      return score
    }
    y = endY
  }

  return score
}

/** Média de pontuação em várias seeds (generalização). */
export function averageFitnessAcrossSeeds(
  network: NeuralNetwork,
  seedCount: number,
  baseSeed: number,
  cfg: FitnessSimConfig
): number {
  if (seedCount <= 1) {
    return runSilentEpisode(network, baseSeed, cfg)
  }
  let sum = 0
  for (let k = 0; k < seedCount; k++) {
    const seed = (baseSeed + k * 7937) >>> 0
    sum += runSilentEpisode(network, seed, cfg)
  }
  return sum / seedCount
}
