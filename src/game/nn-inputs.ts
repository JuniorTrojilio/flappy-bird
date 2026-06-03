import { BIRD_H, BIRD_HALF_EXTENT, GAME_WIDTH, GROUND_Y } from '@/game/constants'
import { BIRD_X } from '@/game/collision'
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

/**
 * Entradas da rede 3→4→1.
 * altura_passaro = posição dentro da abertura (0 = topo, 0.5 = centro, 1 = base).
 */
export function computeNnInputs(
  birdY: number,
  speed: number,
  pipes: readonly PipeLike[],
  cfg: PipeInputConfig,
  jumpForce = 4.6
) {
  const pipe = getNextPipe(pipes, BIRD_X, cfg.w)
  let distancia_cano = 1
  let altura_passaro = 0.5

  if (pipe) {
    distancia_cano = clamp((pipe.x - BIRD_X) / GAME_WIDTH, 0, 1)
    const gapTop = pipe.y + cfg.h
    altura_passaro = clamp((birdY - gapTop) / cfg.gap, 0, 1)
  } else {
    // Sem cano à frente: altura no céu (0 = topo, 1 = perto do chão) para a rede saber que está caindo
    const span = SKY_FLOOR_Y - MIN_Y
    altura_passaro = span > 0 ? clamp((birdY - MIN_Y) / span, 0, 1) : 0.5
  }

  return {
    distancia_cano,
    altura_passaro,
    velocidade: clamp(speed / jumpForce, -1, 1),
  }
}
