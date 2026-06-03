import type { NetworkSnapshot } from '@/lib/neural-network'

export const OUTPUT_SIZE = 1
export const BASE_INPUT_COUNT = 3
export const EXTENDED_EXTRA_INPUTS = 2

export type InputMode = 'basic' | 'extended'

export type NnArchitecture = {
  inputMode: InputMode
  hiddenSize: number
}

export const HIDDEN_SIZE_OPTIONS = [4, 6, 8, 12, 16] as const
export type HiddenSizeOption = (typeof HIDDEN_SIZE_OPTIONS)[number]

export const EVAL_SEED_OPTIONS = [1, 3, 5, 10] as const
export type EvalSeedOption = (typeof EVAL_SEED_OPTIONS)[number]

export const INPUT_MODE_LABELS: Record<InputMode, string> = {
  basic: 'Básico (3 sentidos)',
  extended: 'Completo (5 sentidos)',
}

export const INPUT_LABELS_BASIC = ['distancia', 'altura', 'velocidade'] as const
export const INPUT_LABELS_EXTENDED = [
  ...INPUT_LABELS_BASIC,
  'distancia2',
  'altura2',
] as const

export function inputSizeFor(mode: InputMode): number {
  return mode === 'extended' ? BASE_INPUT_COUNT + EXTENDED_EXTRA_INPUTS : BASE_INPUT_COUNT
}

export function clampHiddenSize(size: number): HiddenSizeOption {
  const n = Math.round(size) || 4
  let best: HiddenSizeOption = HIDDEN_SIZE_OPTIONS[0]
  let bestDist = Math.abs(n - best)
  for (const opt of HIDDEN_SIZE_OPTIONS) {
    const d = Math.abs(n - opt)
    if (d < bestDist) {
      bestDist = d
      best = opt
    }
  }
  return best
}

export function clampEvalSeeds(n: number): EvalSeedOption {
  const v = Math.round(n) || 5
  let best: EvalSeedOption = EVAL_SEED_OPTIONS[0]
  let bestDist = Math.abs(v - best)
  for (const opt of EVAL_SEED_OPTIONS) {
    const d = Math.abs(v - opt)
    if (d < bestDist) {
      bestDist = d
      best = opt
    }
  }
  return best
}

export function defaultArchitecture(): NnArchitecture {
  return { inputMode: 'basic', hiddenSize: 4 }
}

export function architectureLabel(arch: NnArchitecture): string {
  const inN = inputSizeFor(arch.inputMode)
  return `${inN}→${arch.hiddenSize}→${OUTPUT_SIZE}`
}

export function snapshotMatchesArchitecture(
  s: NetworkSnapshot,
  arch: NnArchitecture
): boolean {
  const inSize = inputSizeFor(arch.inputMode)
  const h = arch.hiddenSize
  return (
    s.ih.length === inSize * h &&
    s.ho.length === h * OUTPUT_SIZE &&
    s.bh.length === h &&
    s.bo.length === OUTPUT_SIZE
  )
}

export function inputLabelsFor(mode: InputMode): readonly string[] {
  return mode === 'extended' ? INPUT_LABELS_EXTENDED : INPUT_LABELS_BASIC
}

export function neuronCount(arch: NnArchitecture): number {
  return inputSizeFor(arch.inputMode) + arch.hiddenSize + OUTPUT_SIZE
}

export function weightCount(arch: NnArchitecture): number {
  const inSize = inputSizeFor(arch.inputMode)
  return inSize * arch.hiddenSize + arch.hiddenSize * OUTPUT_SIZE
}
