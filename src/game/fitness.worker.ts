import { averageFitnessAcrossSeeds, type FitnessSimConfig } from '@/game/fitness-eval'
import type { NnArchitecture } from '@/lib/nn-config'
import { NeuralNetwork, type NetworkSnapshot } from '@/lib/neural-network'
import { roundScore } from '@/lib/score'

export type FitnessWorkerRequest = {
  id: string
  snapshots: NetworkSnapshot[]
  architecture: NnArchitecture
  evalSeedCount: number
  baseSeed: number
  simConfig: FitnessSimConfig
}

export type FitnessWorkerResponse = {
  id: string
  scores: number[]
  error?: string
}

self.onmessage = (event: MessageEvent<FitnessWorkerRequest>) => {
  const { id, snapshots, architecture, evalSeedCount, baseSeed, simConfig } =
    event.data
  try {
    const scores = snapshots.map((snap, i) => {
      const net = new NeuralNetwork(architecture)
      net.loadSnapshot(snap)
      return roundScore(
        averageFitnessAcrossSeeds(
          net,
          evalSeedCount,
          (baseSeed + i * 997) >>> 0,
          simConfig
        )
      )
    })
    const msg: FitnessWorkerResponse = { id, scores }
    self.postMessage(msg)
  } catch (err) {
    const msg: FitnessWorkerResponse = {
      id,
      scores: [],
      error: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(msg)
  }
}
