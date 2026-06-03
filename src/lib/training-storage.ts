/**
 * Salva e carrega treino no navegador (localStorage): redes, geração, recorde, hall da fama.
 * Chaves: flappy-bird-nn-training e flappy-bird-nn-prefs.
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import {
  clampEvalSeeds,
  clampHiddenSize,
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
const PREFS_KEY = 'flappy-bird-nn-prefs'
const LEGACY_BEST_KEY = 'best'
const SAVE_VERSION = 3
const PREFS_VERSION = 1
const MAX_HISTORICO = 400

/** Preferências da rede (persistem mesmo sem treino salvo). */
export type NnPrefs = {
  version: typeof PREFS_VERSION
  inputMode: InputMode
  hiddenSize: number
  evalSeeds: EvalSeedOption
}

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

export function saveNnPrefs(
  prefs: Pick<NnPrefs, 'inputMode' | 'hiddenSize' | 'evalSeeds'>
): boolean {
  try {
    const payload: NnPrefs = {
      version: PREFS_VERSION,
      inputMode: prefs.inputMode,
      hiddenSize: clampHiddenSize(prefs.hiddenSize),
      evalSeeds: clampEvalSeeds(prefs.evalSeeds),
    }
    localStorage.setItem(PREFS_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function loadNnPrefs(): NnPrefs | null {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as NnPrefs
    if (data.version !== PREFS_VERSION) return null
    if (data.inputMode !== 'basic' && data.inputMode !== 'extended') return null
    return {
      version: PREFS_VERSION,
      inputMode: data.inputMode,
      hiddenSize: clampHiddenSize(data.hiddenSize),
      evalSeeds: clampEvalSeeds(data.evalSeeds),
    }
  } catch {
    return null
  }
}

export function defaultNnPrefs(): NnPrefs {
  const arch = defaultArchitecture()
  return {
    version: PREFS_VERSION,
    inputMode: arch.inputMode,
    hiddenSize: arch.hiddenSize,
    evalSeeds: clampEvalSeeds(5),
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
    saveNnPrefs({
      inputMode: data.inputMode,
      hiddenSize: data.hiddenSize,
      evalSeeds: data.evalSeeds,
    })
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

    const normalized = {
      ...data,
      historico: Array.isArray(data.historico) ? data.historico : [],
      inputMode: arch.inputMode,
      hiddenSize: arch.hiddenSize,
      evalSeeds: clampEvalSeeds(data.evalSeeds ?? 5),
    }
    saveNnPrefs({
      inputMode: normalized.inputMode,
      hiddenSize: normalized.hiddenSize,
      evalSeeds: normalized.evalSeeds,
    })
    return normalized
  } catch {
    return null
  }
}

export function clearTrainingState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(PREFS_KEY)
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
