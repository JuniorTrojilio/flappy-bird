export type ProgressTrend = 'waiting' | 'up' | 'flat' | 'down'

export function computeProgressTrend(historico: number[]): ProgressTrend {
  if (historico.length === 0) return 'waiting'
  if (historico.length === 1) return 'waiting'

  const last = historico[historico.length - 1]
  const prev = historico[historico.length - 2]
  if (historico.length === 2) {
    if (last > prev) return 'up'
    if (last < prev) return 'down'
    return 'flat'
  }

  const recent = historico.slice(-5)
  const older = historico.slice(Math.max(0, historico.length - 10), -5)

  const avg = (arr: number[]) =>
    arr.reduce((a, b) => a + b, 0) / arr.length

  const avgRecent = avg(recent)
  if (older.length === 0) {
    if (last > prev && avgRecent >= prev) return 'up'
    if (last < prev) return 'down'
    return 'flat'
  }

  const avgOlder = avg(older)
  const delta = avgRecent - avgOlder
  if (delta >= 1.5) return 'up'
  if (delta <= -1.5) return 'down'
  return 'flat'
}

export function trendLabel(trend: ProgressTrend): string {
  switch (trend) {
    case 'up':
      return 'Melhorando'
    case 'down':
      return 'Regredindo'
    case 'flat':
      return 'Estagnada'
    case 'waiting':
      return 'Coletando dados'
  }
}
