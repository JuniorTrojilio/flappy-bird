import { GAME_WIDTH } from '@/game/constants'

export type PlayerScorePhase = 'playing' | 'gameover'

/** Recortes do sprite.png — Flappy Bird original (index.html legado) */
export const GET_READY_SPRITE = {
  sX: 0,
  sY: 228,
  w: 173,
  h: 152,
  x: GAME_WIDTH / 2 - 173 / 2,
  y: 80,
} as const

export const GAME_OVER_SPRITE = {
  sX: 175,
  sY: 228,
  w: 225,
  h: 202,
  x: GAME_WIDTH / 2 - 225 / 2,
  y: 90,
} as const

/** Posições do placar desenhadas sobre o painel de game over */
export const GAME_OVER_SCORE = { x: 225, y: 186 } as const
export const GAME_OVER_BEST = { x: 225, y: 228 } as const

/** Botão “restart” no sprite de game over */
export const START_BTN = { x: 120, y: 263, w: 83, h: 29 } as const

/**
 * Medalhas no sprite.png — grade 2×2 de ícones 22×22 (escala 2× no canvas).
 * (Prata/platina em y:202 estavam vazias; por isso nada aparecia em 20+ pontos.)
 */
export const MEDAL_SPRITES = {
  bronze: { sX: 360, sY: 158, w: 22, h: 22 },
  silver: { sX: 312, sY: 130, w: 22, h: 22 },
  gold: { sX: 312, sY: 158, w: 22, h: 22 },
  platinum: { sX: 360, sY: 130, w: 22, h: 22 },
} as const

export type MedalTier = keyof typeof MEDAL_SPRITES

/** Círculo “MEDAL” no painel de game over — clones usam ~(73, 181). */
export const GAME_OVER_MEDAL = {
  x: 73,
  y: 181,
  w: 44,
  h: 44,
} as const

/** Limiares do Flappy Bird original: bronze 10+, prata 20+, ouro 30+, platina 40+. */
export function medalTierForScore(score: number): MedalTier | null {
  if (score < 10) return null
  if (score >= 40) return 'platinum'
  if (score >= 30) return 'gold'
  if (score >= 20) return 'silver'
  return 'bronze'
}

export function drawPlayerMedal(
  ctx: CanvasRenderingContext2D,
  sprite: HTMLImageElement,
  score: number
) {
  const tier = medalTierForScore(score)
  if (!tier || !sprite.complete || sprite.naturalWidth === 0) return
  const m = MEDAL_SPRITES[tier]
  const d = GAME_OVER_MEDAL
  ctx.save()
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(sprite, m.sX, m.sY, m.w, m.h, d.x, d.y, d.w, d.h)
  ctx.restore()
}

export function isInsideStartBtn(px: number, py: number) {
  return (
    px >= START_BTN.x &&
    px <= START_BTN.x + START_BTN.w &&
    py >= START_BTN.y &&
    py <= START_BTN.y + START_BTN.h
  )
}

/** Placar no estilo do jogo original (Teko sobre o canvas / painel game over). */
export function drawPlayerScore(
  ctx: CanvasRenderingContext2D,
  phase: PlayerScorePhase,
  score: number,
  best: number
) {
  ctx.fillStyle = '#FFF'
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 1

  if (phase === 'playing') {
    ctx.font = '35px Teko, sans-serif'
    ctx.textAlign = 'center'
    const text = String(score)
    ctx.fillText(text, GAME_WIDTH / 2, 50)
    ctx.strokeText(text, GAME_WIDTH / 2, 50)
    ctx.textAlign = 'left'
    return
  }

  ctx.font = '25px Teko, sans-serif'
  ctx.textAlign = 'left'
  const pts = String(score)
  const rec = String(best)
  ctx.fillText(pts, GAME_OVER_SCORE.x, GAME_OVER_SCORE.y)
  ctx.strokeText(pts, GAME_OVER_SCORE.x, GAME_OVER_SCORE.y)
  ctx.fillText(rec, GAME_OVER_BEST.x, GAME_OVER_BEST.y)
  ctx.strokeText(rec, GAME_OVER_BEST.x, GAME_OVER_BEST.y)
}
