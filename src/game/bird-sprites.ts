/** Coordenadas no sprite.png (Flappy Bird original) */

export const BIRD_SPRITE_W = 34
export const BIRD_SPRITE_H = 26

/** Animação do pássaro amarelo (asa batendo) */
export const BIRD_YELLOW_FRAMES = [
  { sX: 276, sY: 112 },
  { sX: 276, sY: 139 },
  { sX: 276, sY: 164 },
  { sX: 276, sY: 139 },
] as const

/** Variante cinza no mesmo spritesheet (abaixo dos amarelos) */
export const BIRD_GRAY_FRAME = { sX: 276, sY: 191 } as const

export type BirdSpriteVariant = 'yellow' | 'gray'

export function birdSpriteFrame(
  variant: BirdSpriteVariant,
  animIndex: number
): { sX: number; sY: number } {
  if (variant === 'gray') return BIRD_GRAY_FRAME
  const frames = BIRD_YELLOW_FRAMES
  return frames[((animIndex % frames.length) + frames.length) % frames.length]
}
