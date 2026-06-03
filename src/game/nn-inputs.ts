/**
 * O que a IA “enxerga” a cada frame: distância ao cano, altura na fenda, velocidade (+ 2 extras no modo extended).
 * Valores entre 0 e 1 para a rede processar.
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import { BIRD_H, BIRD_HALF_EXTENT, GAME_WIDTH, GROUND_Y } from '@/game/constants'
import { BIRD_X } from '@/game/collision'
import type { InputMode } from '@/lib/nn-config'
import { clamp } from '@/lib/utils'

const MIN_Y = BIRD_H / 2
const SKY_FLOOR_Y = GROUND_Y - BIRD_HALF_EXTENT

export type PipeLike = { x: number; y: number }

export type PipeInputConfig = {
  w: number
  h: number
  gap: number
}

/** Próximo cano à frente do pássaro (mesma regra do jogo original). */
export function getNextPipe(
  pipes: readonly PipeLike[],
  birdX = BIRD_X,
  pipeW: number
): PipeLike | null {
  for (const p of pipes) {
    if (p.x + pipeW > birdX) return p
  }
  return pipes[0] ?? null
}

/** Segundo cano à frente (lookahead). */
export function getSecondPipe(
  pipes: readonly PipeLike[],
  birdX = BIRD_X,
  pipeW: number
): PipeLike | null {
  let seen = 0
  for (const p of pipes) {
    if (p.x + pipeW > birdX) {
      seen++
      if (seen === 2) return p
    }
  }
  return null
}

function gapPosition(
  birdY: number,
  pipe: PipeLike,
  cfg: PipeInputConfig
): number {
  const gapTop = pipe.y + cfg.h
  return clamp((birdY - gapTop) / cfg.gap, 0, 1)
}

/**
 * Entradas da rede (3 básicas ou 5 com segundo cano).
 * altura = posição dentro da abertura (0 = topo, 1 = base).
 */
export function computeNnInputs(
  birdY: number,
  speed: number,
  pipes: readonly PipeLike[],
  cfg: PipeInputConfig,
  jumpForce = 4.6,
  inputMode: InputMode = 'basic'
) {
  const pipe = getNextPipe(pipes, BIRD_X, cfg.w)
  let distancia_cano = 1
  let altura_passaro = 0.5

  if (pipe) {
    distancia_cano = clamp((pipe.x - BIRD_X) / GAME_WIDTH, 0, 1)
    altura_passaro = gapPosition(birdY, pipe, cfg)
  } else {
    const span = SKY_FLOOR_Y - MIN_Y
    altura_passaro = span > 0 ? clamp((birdY - MIN_Y) / span, 0, 1) : 0.5
  }

  const base = {
    distancia_cano,
    altura_passaro,
    velocidade: clamp(speed / jumpForce, -1, 1),
  }

  if (inputMode === 'basic') {
    return { ...base, vector: [base.distancia_cano, base.altura_passaro, base.velocidade] }
  }

  const pipe2 = getSecondPipe(pipes, BIRD_X, cfg.w)
  let distancia_segundo = 1
  let altura_segundo = 0.5
  if (pipe2) {
    distancia_segundo = clamp((pipe2.x - BIRD_X) / GAME_WIDTH, 0, 1)
    altura_segundo = gapPosition(birdY, pipe2, cfg)
  }

  return {
    ...base,
    distancia_segundo,
    altura_segundo,
    vector: [
      base.distancia_cano,
      base.altura_passaro,
      base.velocidade,
      distancia_segundo,
      altura_segundo,
    ],
  }
}
