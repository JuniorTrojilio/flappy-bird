import type { FitnessSimConfig } from '@/game/fitness-eval'
import { averageFitnessAcrossSeeds } from '@/game/fitness-eval'
import type { NnArchitecture } from '@/lib/nn-config'
import { NeuralNetwork, type NetworkSnapshot } from '@/lib/neural-network'
import { roundScore } from '@/lib/score'
import type {
  FitnessWorkerRequest,
  FitnessWorkerResponse,
} from '@/game/fitness.worker'

let worker: Worker | null = null
let workerFailed = false

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === 'undefined') return null
  if (!worker) {
    try {
      worker = new Worker(new URL('./fitness.worker.ts', import.meta.url), {
        type: 'module',
      })
    } catch {
      workerFailed = true
      return null
    }
  }
  return worker
}

function evaluateFitnessBatchSync(
  snapshots: NetworkSnapshot[],
  architecture: NnArchitecture,
  evalSeedCount: number,
  baseSeed: number,
  simConfig: FitnessSimConfig
): number[] {
  return snapshots.map((snap, i) => {
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
}

/** Avaliação multi-seed em thread separada (não trava o canvas). */
export function evaluateFitnessBatch(
  snapshots: NetworkSnapshot[],
  architecture: NnArchitecture,
  evalSeedCount: number,
  baseSeed: number,
  simConfig: FitnessSimConfig
): Promise<number[]> {
  if (evalSeedCount <= 1) {
    return Promise.resolve(
      evaluateFitnessBatchSync(
        snapshots,
        architecture,
        1,
        baseSeed,
        simConfig
      )
    )
  }

  const w = getWorker()
  if (!w) {
    return Promise.resolve(
      evaluateFitnessBatchSync(
        snapshots,
        architecture,
        evalSeedCount,
        baseSeed,
        simConfig
      )
    )
  }

  const id = crypto.randomUUID()
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<FitnessWorkerResponse>) => {
      if (event.data.id !== id) return
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      if (event.data.error) {
        reject(new Error(event.data.error))
        return
      }
      resolve(event.data.scores)
    }
    const onError = () => {
      w.removeEventListener('message', onMessage)
      w.removeEventListener('error', onError)
      workerFailed = true
      worker = null
      resolve(
        evaluateFitnessBatchSync(
          snapshots,
          architecture,
          evalSeedCount,
          baseSeed,
          simConfig
        )
      )
    }
    w.addEventListener('message', onMessage)
    w.addEventListener('error', onError)
    const payload: FitnessWorkerRequest = {
      id,
      snapshots,
      architecture,
      evalSeedCount,
      baseSeed,
      simConfig,
    }
    w.postMessage(payload)
  })
}

export function terminateFitnessWorker() {
  worker?.terminate()
  worker = null
}
