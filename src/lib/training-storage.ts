import {
  defaultArchitecture,
  inputSizeFor,
  OUTPUT_SIZE,
  snapshotMatchesArchitecture,
  type EvalSeedOption,
  type InputMode,
  type NnArchitecture,
} from '@/lib/nn-config'
import type { NetworkSnapshot } from '@/lib/neural-network'

const STORAGE_KEY = 'flappy-bird-nn-training'
const LEGACY_BEST_KEY = 'best'
const SAVE_VERSION = 3
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
  hallOfFame?: number
  hallOfFameSnapshot?: NetworkSnapshot | null
  inputMode: InputMode
  hiddenSize: number
  evalSeeds: EvalSeedOption
}

export function architectureFromSave(data: TrainingSaveData): NnArchitecture {
  return {
    inputMode: data.inputMode ?? 'basic',
    hiddenSize: data.hiddenSize ?? 4,
  }
}

export function saveTrainingState(
  data: Omit<TrainingSaveData, 'version' | 'savedAt'>
): boolean {
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

    const arch = architectureFromSave(data)

    for (const net of data.networks) {
      if (
        !Array.isArray(net.ih) ||
        !Array.isArray(net.ho) ||
        !Array.isArray(net.bh) ||
        !Array.isArray(net.bo)
      ) {
        return null
      }
      if (!snapshotMatchesArchitecture(net, arch)) return null
    }

    if (data.hallOfFameSnapshot) {
      if (!snapshotMatchesArchitecture(data.hallOfFameSnapshot, arch)) {
        data.hallOfFameSnapshot = null
        data.hallOfFame = 0
      }
    }

    return {
      ...data,
      historico: Array.isArray(data.historico) ? data.historico : [],
      inputMode: arch.inputMode,
      hiddenSize: arch.hiddenSize,
      evalSeeds: data.evalSeeds ?? 5,
    }
  } catch {
    return null
  }
}

export function clearTrainingState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_BEST_KEY)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('flappy-bird')) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    /* quota / modo privado */
  }
}

export function hasSavedTraining() {
  return loadTrainingState() !== null
}

export function defaultSaveArchitecture(): NnArchitecture {
  return defaultArchitecture()
}

export function expectedSnapshotSizes(arch: NnArchitecture) {
  const inSize = inputSizeFor(arch.inputMode)
  const h = arch.hiddenSize
  return {
    ih: inSize * h,
    ho: h * OUTPUT_SIZE,
    bh: h,
    bo: OUTPUT_SIZE,
  }
}
