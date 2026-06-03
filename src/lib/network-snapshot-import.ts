/**
 * Valida e interpreta JSON de pesos da rede (campeão manual).
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import {
  snapshotMatchesArchitecture,
  type NnArchitecture,
} from '@/lib/nn-config'
import {
  normalizeNetworkSnapshot,
  type NetworkSnapshot,
} from '@/lib/neural-network'
import { expectedSnapshotSizes } from '@/lib/training-storage'

export type ParseSnapshotResult =
  | { ok: true; snapshot: NetworkSnapshot }
  | { ok: false; error: string }

function isNumberArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
  )
}

/** Lê texto JSON (formato novo ou legado ih/ho/bh/bo). */
export function parseNetworkSnapshotJson(
  text: string,
  architecture: NnArchitecture
): ParseSnapshotResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: 'Cole o JSON dos pesos no campo acima.' }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return {
      ok: false,
      error: 'JSON inválido. Use aspas duplas e vírgulas entre os números.',
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'O JSON precisa ser um objeto com os arrays de pesos.' }
  }

  const snapshot = normalizeNetworkSnapshot(
    parsed as NetworkSnapshot
  )

  if (
    !isNumberArray(snapshot.weightsInputToHidden) ||
    !isNumberArray(snapshot.weightsHiddenToOutput) ||
    !isNumberArray(snapshot.biasesHidden) ||
    !isNumberArray(snapshot.biasesOutput)
  ) {
    return {
      ok: false,
      error:
        'Faltam arrays: weightsInputToHidden, weightsHiddenToOutput, biasesHidden, biasesOutput (ou ih, ho, bh, bo no formato antigo).',
    }
  }

  if (!snapshotMatchesArchitecture(snapshot, architecture)) {
    const expected = expectedSnapshotSizes(architecture)
    return {
      ok: false,
      error: `Tamanhos não batem com a rede ${architecture.inputMode === 'basic' ? '3' : '5'}→${architecture.hiddenSize}→1. Esperado: entrada→oculta ${expected.weightsInputToHidden}, oculta→saída ${expected.weightsHiddenToOutput}, viés oculto ${expected.biasesHidden}, viés saída ${expected.biasesOutput}. Recebido: ${snapshot.weightsInputToHidden.length}, ${snapshot.weightsHiddenToOutput.length}, ${snapshot.biasesHidden.length}, ${snapshot.biasesOutput.length}.`,
    }
  }

  return { ok: true, snapshot }
}

export function formatSnapshotSizesHint(architecture: NnArchitecture): string {
  const expected = expectedSnapshotSizes(architecture)
  return `entrada→oculta: ${expected.weightsInputToHidden} · oculta→saída: ${expected.weightsHiddenToOutput} · viés oculto: ${expected.biasesHidden} · viés saída: ${expected.biasesOutput}`
}

export function exampleSnapshotJson(architecture: NnArchitecture): string {
  const expected = expectedSnapshotSizes(architecture)
  const zeros = (length: number) => Array.from({ length }, () => 0)
  const example: NetworkSnapshot = {
    weightsInputToHidden: zeros(expected.weightsInputToHidden),
    weightsHiddenToOutput: zeros(expected.weightsHiddenToOutput),
    biasesHidden: zeros(expected.biasesHidden),
    biasesOutput: zeros(expected.biasesOutput),
  }
  return JSON.stringify(example, null, 2)
}

export function championSnapshotToJson(snapshot: NetworkSnapshot): string {
  return JSON.stringify(normalizeNetworkSnapshot(snapshot), null, 2)
}
