import { BIRD_H, BIRD_W } from '@/game/constants'

export const BIRD_X = 50

const HALF_W = BIRD_W / 2
const HALF_H = BIRD_H / 2

export type PipeCollisionConfig = {
  w: number
  h: number
  gap: number
}

function rectsOverlap(
  aLeft: number,
  aRight: number,
  aTop: number,
  aBottom: number,
  bLeft: number,
  bRight: number,
  bTop: number,
  bBottom: number
) {
  return aLeft < bRight && aRight > bLeft && aTop < bBottom && aBottom > bTop
}

function birdBox(centerY: number) {
  return {
    left: BIRD_X - HALF_W,
    right: BIRD_X + HALF_W,
    top: centerY - HALF_H,
    bottom: centerY + HALF_H,
  }
}

/** Colisão AABB alinhada ao sprite (34×26), igual ao desenho no canvas. */
export function birdHitsPipe(
  centerY: number,
  pipe: { x: number; y: number },
  cfg: PipeCollisionConfig
): boolean {
  const bird = birdBox(centerY)
  const pipeLeft = pipe.x
  const pipeRight = pipe.x + cfg.w

  if (bird.right <= pipeLeft || bird.left >= pipeRight) return false

  const topPipeBottom = pipe.y + cfg.h
  if (
    rectsOverlap(
      bird.left,
      bird.right,
      bird.top,
      bird.bottom,
      pipeLeft,
      pipeRight,
      pipe.y,
      topPipeBottom
    )
  ) {
    return true
  }

  const bottomPipeTop = pipe.y + cfg.h + cfg.gap
  const bottomPipeBottom = bottomPipeTop + cfg.h
  return rectsOverlap(
    bird.left,
    bird.right,
    bird.top,
    bird.bottom,
    pipeLeft,
    pipeRight,
    bottomPipeTop,
    bottomPipeBottom
  )
}

/** Evita “túnel” quando o pássaro se move muito em um único passo de física. */
export function birdHitsPipeAlongPath(
  startY: number,
  endY: number,
  pipes: readonly { x: number; y: number }[],
  cfg: PipeCollisionConfig,
  maxStep = 4
): boolean {
  for (const pipe of pipes) {
    if (birdHitsPipe(startY, pipe, cfg) || birdHitsPipe(endY, pipe, cfg)) {
      return true
    }

    const dy = endY - startY
    if (Math.abs(dy) < 0.001) continue

    const steps = Math.max(1, Math.ceil(Math.abs(dy) / maxStep))
    for (let s = 1; s < steps; s++) {
      const y = startY + (dy * s) / steps
      if (birdHitsPipe(y, pipe, cfg)) return true
    }
  }
  return false
}
