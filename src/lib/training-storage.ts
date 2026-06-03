import { HIDDEN_SIZE, INPUT_SIZE, OUTPUT_SIZE } from '@/lib/nn-architecture'
import type { NetworkSnapshot } from '@/lib/neural-network'

const STORAGE_KEY = 'flappy-bird-nn-training'
const SAVE_VERSION = 2
const MAX_HISTORICO = 400

export type TrainingSaveData = {
  version: typeof SAVE_VERSION
  savedAt: number
  populationSize: number
  generation: number
  recorde: number
  historico: number[]
  lastAvg: number
  lastBest: number
  championIndex: number
  rngState: number
  networks: NetworkSnapshot[]
}

export function saveTrainingState(data: Omit<TrainingSaveData, 'version' | 'savedAt'>): boolean {
  try {
    const payload: TrainingSaveData = {
      ...data,
      version: SAVE_VERSION,
      savedAt: Date.now(),
      historico: data.historico.slice(-MAX_HISTORICO),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function loadTrainingState(): TrainingSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as TrainingSaveData
    if (data.version !== SAVE_VERSION) return null
    if (!Array.isArray(data.networks) || data.networks.length === 0) return null
    if (data.networks.length !== data.populationSize) return null
    for (const net of data.networks) {
      if (
        !Array.isArray(net.ih) ||
        !Array.isArray(net.ho) ||
        !Array.isArray(net.bh) ||
        !Array.isArray(net.bo)
      ) {
        return null
      }
      if (
        net.ih.length !== INPUT_SIZE * HIDDEN_SIZE ||
        net.ho.length !== HIDDEN_SIZE * OUTPUT_SIZE ||
        net.bh.length !== HIDDEN_SIZE ||
        net.bo.length !== OUTPUT_SIZE
      ) {
        return null
      }
    }
    return {
      ...data,
      historico: Array.isArray(data.historico) ? data.historico : [],
    }
  } catch {
    return null
  }
}

export function clearTrainingState() {
  localStorage.removeItem(STORAGE_KEY)
}

export function hasSavedTraining() {
  return loadTrainingState() !== null
}
