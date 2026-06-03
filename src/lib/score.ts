/** Pontuação = canos passados (sempre inteiro). */
export function roundScore(n: number): number {
  return Math.max(0, Math.round(n))
}

export function formatScore(n: number): string {
  return String(roundScore(n))
}
