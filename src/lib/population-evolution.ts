/**
 * Algoritmo genético: mantém elites, cria filhos mutando pesos e injeta redes novas (imigrantes).
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import { NeuralNetwork } from '@/lib/neural-network'
import { roundScore } from '@/lib/score'

export type EvolveOptions = {
  /** Melhor pontuação da geração anterior (refino com 1 pássaro) */
  previousBest?: number
}

/** Composição da população na evolução genética (espelha evolvePopulation). */
export function getEvolutionLayout(n: number) {
  const eliteCount =
    n === 1 ? 1 : Math.min(n, Math.max(2, Math.floor(n * 0.15)))
  const immigrantCount =
    n === 1 ? 0 : Math.min(n - eliteCount, Math.max(1, Math.floor(n * 0.05)))
  const children = Math.max(0, n - eliteCount - immigrantCount)
  return {
    eliteCount,
    immigrantCount,
    children,
    soloBird: n === 1,
  }
}

function mutateSoloBird(clone: NeuralNetwork, bestScore: number, previousBest: number) {
  if (bestScore > previousBest) {
    clone.mutate(0.06, 0.18)
  } else if (bestScore > 0 && bestScore === previousBest) {
    clone.mutate(0.12, 0.28)
  } else {
    clone.mutate(0.22, 0.5)
  }
}

export function evolvePopulation(
  population: NeuralNetwork[],
  scores: number[],
  opts?: EvolveOptions
): { population: NeuralNetwork[]; bestScore: number; bestIndex: number; avgScore: number } {
  const previousBest = opts?.previousBest ?? 0
  const n = population.length
  const ranked = scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)

  const bestScore = ranked[0]?.score ?? 0
  const avgScore = roundScore(
    scores.reduce((a, b) => a + b, 0) / Math.max(n, 1)
  )

  // n=1: um único clone (evita ranked[1] indefinido que quebrava o loop do jogo)
  const eliteCount =
    n === 1 ? 1 : Math.min(n, Math.max(2, Math.floor(n * 0.15)))
  const immigrantCount =
    n === 1 ? 0 : Math.min(n - eliteCount, Math.max(1, Math.floor(n * 0.05)))
  const next: NeuralNetwork[] = []

  const stagnating = bestScore <= 5
  const mutateRate = stagnating ? 0.25 : 0.12
  const mutateStrength = stagnating ? 0.55 : 0.35

  for (let i = 0; i < eliteCount; i++) {
    const slot = ranked[i]
    if (!slot) break
    const clone = population[slot.index].clone()
    if (n === 1) {
      mutateSoloBird(clone, bestScore, previousBest)
    }
    next.push(clone)
  }

  const childSlots = n - immigrantCount
  while (next.length < childSlots) {
    const a = ranked[Math.floor(Math.random() * eliteCount)].index
    const b = ranked[Math.floor(Math.random() * eliteCount)].index
    const parent =
      scores[a] >= scores[b]
        ? population[a]
        : population[b]
    const child = parent.clone()
    child.mutate(mutateRate, mutateStrength)
    next.push(child)
  }

  const arch = population[0]?.arch
  while (next.length < n) {
    next.push(arch ? new NeuralNetwork(arch) : new NeuralNetwork())
  }

  return { population: next, bestScore, bestIndex: 0, avgScore }
}
