/** Dimensões nativas do Flappy Bird original */
export const GAME_WIDTH = 320
export const GAME_HEIGHT = 480

/** Sprite do pássaro (mesmo tamanho do desenho no canvas) */
export const BIRD_W = 34
export const BIRD_H = 26
export const FG_HEIGHT = 112

/** Topo do chão (grama) — abaixo disso é colisão fatal */
export const GROUND_Y = GAME_HEIGHT - FG_HEIGHT

/** Metade da maior dimensão do sprite (quando cai de bico, 34px vira altura) */
export const BIRD_HALF_EXTENT = Math.max(BIRD_W, BIRD_H) / 2

