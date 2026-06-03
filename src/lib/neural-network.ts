/**
 * Rede neural pequena (entradas → camada oculta → 1 saída). O pássaro “pensa” aqui a cada frame.
 * Saída maior que 0,5 = bater asa. Pesos mudam pela evolução genética, não por backprop de escola.
 * Guia: docs/GUIA-DO-CODIGO.md
 */
import {
  defaultArchitecture,
  inputLabelsFor,
  inputSizeFor,
  OUTPUT_SIZE,
  type NnArchitecture,
} from '@/lib/nn-config'
import { clamp } from '@/lib/utils'

/** Cópia dos pesos da rede para salvar, clonar ou enviar ao Web Worker. */
export type NetworkSnapshot = {
  /** Pesos de cada entrada para cada neurônio oculto (tamanho = entradas × ocultos). */
  weightsInputToHidden: number[]
  /** Pesos de cada neurônio oculto para a saída (tamanho = ocultos × saídas). */
  weightsHiddenToOutput: number[]
  /** Viés (bias) de cada neurônio oculto. */
  biasesHidden: number[]
  /** Viés da camada de saída. */
  biasesOutput: number[]
}

/** Formato antigo no localStorage (antes dos nomes completos). */
type LegacyNetworkSnapshot = {
  ih?: number[]
  ho?: number[]
  bh?: number[]
  bo?: number[]
}

/** Aceita snapshot novo ou legado (ih/ho/bh/bo) ao carregar do navegador. */
export function normalizeNetworkSnapshot(
  raw: NetworkSnapshot | LegacyNetworkSnapshot
): NetworkSnapshot {
  const candidate = raw as NetworkSnapshot
  if (Array.isArray(candidate.weightsInputToHidden)) {
    return candidate
  }
  const legacy = raw as LegacyNetworkSnapshot
  return {
    weightsInputToHidden: legacy.ih ?? [],
    weightsHiddenToOutput: legacy.ho ?? [],
    biasesHidden: legacy.bh ?? [],
    biasesOutput: legacy.bo ?? [],
  }
}

function sigmoid(value: number) {
  return 1 / (1 + Math.exp(-value))
}

function sigmoidDerivative(activatedValue: number) {
  return activatedValue * (1 - activatedValue)
}

/** Média dos pesos entrada→oculta por sentido (painel — só os 3 primeiros sentidos). */
export function aggregatedInputWeightsFromSnapshot(
  snapshot: NetworkSnapshot,
  architecture: NnArchitecture
) {
  const inputCount = inputSizeFor(architecture.inputMode)
  const hiddenCount = architecture.hiddenSize
  const averagePerSense = [0, 0, 0]
  for (let inputIndex = 0; inputIndex < Math.min(3, inputCount); inputIndex++) {
    let sum = 0
    for (let hiddenIndex = 0; hiddenIndex < hiddenCount; hiddenIndex++) {
      sum += snapshot.weightsInputToHidden[inputIndex * hiddenCount + hiddenIndex]
    }
    averagePerSense[inputIndex] = sum / hiddenCount
  }
  return {
    pesoDistancia: clamp(averagePerSense[0], -2, 2),
    pesoAltura: clamp(averagePerSense[1], -2, 2),
    pesoVelocidade: clamp(averagePerSense[2], -2, 2),
  }
}

export class NeuralNetwork {
  readonly architecture: NnArchitecture
  readonly inputCount: number
  readonly hiddenCount: number

  weightsInputToHidden: Float32Array
  weightsHiddenToOutput: Float32Array
  biasesHidden: Float32Array
  biasesOutput: Float32Array
  inputValues: Float32Array
  hiddenActivations: Float32Array
  outputActivations: Float32Array
  hiddenSumBeforeSigmoid: Float32Array
  outputSumBeforeSigmoid = 0
  lastLoss = 0
  lastTarget = 0
  lastDecisionCorrect = true
  aggregatedWeightChanges = {
    distancia: 0,
    altura: 0,
    velocidade: 0,
  }
  inputGradientShares: number[] = []
  learningRate = 0.15

  constructor(architecture: NnArchitecture = defaultArchitecture()) {
    this.architecture = { ...architecture, hiddenSize: architecture.hiddenSize }
    this.inputCount = inputSizeFor(architecture.inputMode)
    this.hiddenCount = architecture.hiddenSize
    this.weightsInputToHidden = new Float32Array(
      this.inputCount * this.hiddenCount
    )
    this.weightsHiddenToOutput = new Float32Array(
      this.hiddenCount * OUTPUT_SIZE
    )
    this.biasesHidden = new Float32Array(this.hiddenCount)
    this.biasesOutput = new Float32Array(OUTPUT_SIZE)
    this.inputValues = new Float32Array(this.inputCount)
    this.hiddenActivations = new Float32Array(this.hiddenCount)
    this.outputActivations = new Float32Array(OUTPUT_SIZE)
    this.hiddenSumBeforeSigmoid = new Float32Array(this.hiddenCount)
    this.inputGradientShares = new Array(this.inputCount).fill(0)
    this.randomizeWeights()
  }

  randomizeWeights() {
    const randomWeight = () => (Math.random() * 2 - 1) * 1.2
    for (let index = 0; index < this.weightsInputToHidden.length; index++) {
      this.weightsInputToHidden[index] = randomWeight()
    }
    for (let index = 0; index < this.weightsHiddenToOutput.length; index++) {
      this.weightsHiddenToOutput[index] = randomWeight()
    }
    for (let index = 0; index < this.biasesHidden.length; index++) {
      this.biasesHidden[index] = randomWeight() * 0.5
    }
    this.biasesOutput[0] = randomWeight() * 0.5
  }

  clone(): NeuralNetwork {
    const copy = new NeuralNetwork(this.architecture)
    copy.weightsInputToHidden.set(this.weightsInputToHidden)
    copy.weightsHiddenToOutput.set(this.weightsHiddenToOutput)
    copy.biasesHidden.set(this.biasesHidden)
    copy.biasesOutput.set(this.biasesOutput)
    return copy
  }

  copyFrom(other: NeuralNetwork) {
    if (
      other.inputCount !== this.inputCount ||
      other.hiddenCount !== this.hiddenCount
    ) {
      return
    }
    this.weightsInputToHidden.set(other.weightsInputToHidden)
    this.weightsHiddenToOutput.set(other.weightsHiddenToOutput)
    this.biasesHidden.set(other.biasesHidden)
    this.biasesOutput.set(other.biasesOutput)
  }

  toSnapshot(): NetworkSnapshot {
    return {
      weightsInputToHidden: Array.from(this.weightsInputToHidden),
      weightsHiddenToOutput: Array.from(this.weightsHiddenToOutput),
      biasesHidden: Array.from(this.biasesHidden),
      biasesOutput: Array.from(this.biasesOutput),
    }
  }

  loadSnapshot(snapshot: NetworkSnapshot) {
    const normalized = normalizeNetworkSnapshot(snapshot)
    if (normalized.weightsInputToHidden.length !== this.weightsInputToHidden.length) {
      return false
    }
    this.weightsInputToHidden.set(normalized.weightsInputToHidden)
    this.weightsHiddenToOutput.set(normalized.weightsHiddenToOutput)
    this.biasesHidden.set(normalized.biasesHidden)
    this.biasesOutput.set(normalized.biasesOutput)
    return true
  }

  mutate(mutationRate = 0.1, mutationStrength = 0.3) {
    const tweakArray = (weights: Float32Array) => {
      for (let index = 0; index < weights.length; index++) {
        if (Math.random() < mutationRate) {
          weights[index] += (Math.random() * 2 - 1) * mutationStrength
        }
      }
    }
    tweakArray(this.weightsInputToHidden)
    tweakArray(this.weightsHiddenToOutput)
    tweakArray(this.biasesHidden)
    tweakArray(this.biasesOutput)
  }

  setInputVector(values: readonly number[]) {
    const count = Math.min(values.length, this.inputCount)
    for (let inputIndex = 0; inputIndex < count; inputIndex++) {
      this.inputValues[inputIndex] = values[inputIndex]
    }
    for (let inputIndex = count; inputIndex < this.inputCount; inputIndex++) {
      this.inputValues[inputIndex] = 0
    }
  }

  /** Compatibilidade: três sentidos básicos (o restante fica 0 no modo extended). */
  setInputs(distancia: number, altura: number, velocidade: number) {
    this.setInputVector([distancia, altura, velocidade])
  }

  forward() {
    for (let hiddenIndex = 0; hiddenIndex < this.hiddenCount; hiddenIndex++) {
      let weightedSum = this.biasesHidden[hiddenIndex]
      for (let inputIndex = 0; inputIndex < this.inputCount; inputIndex++) {
        weightedSum +=
          this.inputValues[inputIndex] *
          this.weightsInputToHidden[inputIndex * this.hiddenCount + hiddenIndex]
      }
      this.hiddenSumBeforeSigmoid[hiddenIndex] = weightedSum
      this.hiddenActivations[hiddenIndex] = sigmoid(weightedSum)
    }

    let outputWeightedSum = this.biasesOutput[0]
    for (let hiddenIndex = 0; hiddenIndex < this.hiddenCount; hiddenIndex++) {
      outputWeightedSum +=
        this.hiddenActivations[hiddenIndex] *
        this.weightsHiddenToOutput[hiddenIndex]
    }
    this.outputSumBeforeSigmoid = outputWeightedSum
    this.outputActivations[0] = sigmoid(outputWeightedSum)
    return this.outputActivations[0]
  }

  decide(): 'bate' | 'nao_bate' {
    return this.outputActivations[0] > 0.5 ? 'bate' : 'nao_bate'
  }

  getAggregatedInputWeights() {
    return aggregatedInputWeightsFromSnapshot(this.toSnapshot(), this.architecture)
  }

  trainOnDeath(idealFlap: boolean) {
    this.lastTarget = idealFlap ? 1 : 0
    const outputActivation = this.outputActivations[0]
    this.lastLoss = Math.abs(outputActivation - this.lastTarget)

    const outputError = outputActivation - this.lastTarget
    const outputDelta = outputError * sigmoidDerivative(outputActivation)

    const hiddenDeltas = new Float32Array(this.hiddenCount)
    for (let hiddenIndex = 0; hiddenIndex < this.hiddenCount; hiddenIndex++) {
      hiddenDeltas[hiddenIndex] =
        outputDelta *
        this.weightsHiddenToOutput[hiddenIndex] *
        sigmoidDerivative(this.hiddenActivations[hiddenIndex])
    }

    const inputGradientMagnitudes = new Array(this.inputCount).fill(0)
    for (let inputIndex = 0; inputIndex < this.inputCount; inputIndex++) {
      let gradientSum = 0
      for (let hiddenIndex = 0; hiddenIndex < this.hiddenCount; hiddenIndex++) {
        gradientSum +=
          hiddenDeltas[hiddenIndex] *
          this.weightsInputToHidden[inputIndex * this.hiddenCount + hiddenIndex]
      }
      inputGradientMagnitudes[inputIndex] = Math.abs(gradientSum)
    }
    const gradientTotal =
      inputGradientMagnitudes.reduce(
        (accumulator, value) => accumulator + value,
        0
      ) || 1
    this.inputGradientShares = inputGradientMagnitudes.map(
      (magnitude) => magnitude / gradientTotal
    )

    const aggregatedBefore = this.getAggregatedInputWeights()
    const rate = this.learningRate

    for (let hiddenIndex = 0; hiddenIndex < this.hiddenCount; hiddenIndex++) {
      this.weightsHiddenToOutput[hiddenIndex] -=
        rate * outputDelta * this.hiddenActivations[hiddenIndex]
    }
    this.biasesOutput[0] -= rate * outputDelta

    for (let hiddenIndex = 0; hiddenIndex < this.hiddenCount; hiddenIndex++) {
      for (let inputIndex = 0; inputIndex < this.inputCount; inputIndex++) {
        const weightIndex = inputIndex * this.hiddenCount + hiddenIndex
        this.weightsInputToHidden[weightIndex] -=
          rate * hiddenDeltas[hiddenIndex] * this.inputValues[inputIndex]
      }
      this.biasesHidden[hiddenIndex] -= rate * hiddenDeltas[hiddenIndex]
    }

    const aggregatedAfter = this.getAggregatedInputWeights()
    this.aggregatedWeightChanges = {
      distancia: aggregatedAfter.pesoDistancia - aggregatedBefore.pesoDistancia,
      altura: aggregatedAfter.pesoAltura - aggregatedBefore.pesoAltura,
      velocidade:
        aggregatedAfter.pesoVelocidade - aggregatedBefore.pesoVelocidade,
    }
  }

  evaluateDecision(idealFlap: boolean) {
    const decidedFlap = this.decide() === 'bate'
    this.lastDecisionCorrect = decidedFlap === idealFlap
    return this.lastDecisionCorrect
  }

  getPanelCalculo() {
    return {
      somaSaidaAntesSigmoid: this.outputSumBeforeSigmoid,
      confianca: this.outputActivations[0],
      decisao: this.decide(),
    }
  }

  getActivationsForDiagram() {
    return {
      inputs: Array.from(this.inputValues),
      hidden: Array.from(this.hiddenActivations),
      output: [this.outputActivations[0]],
    }
  }

  getAllWeights() {
    return {
      weightsInputToHidden: Array.from(this.weightsInputToHidden),
      weightsHiddenToOutput: Array.from(this.weightsHiddenToOutput),
    }
  }

  hiddenNeuronContribution(hiddenIndex: number) {
    return (
      this.hiddenActivations[hiddenIndex] *
      this.weightsHiddenToOutput[hiddenIndex] *
      this.outputActivations[0]
    )
  }

  getHiddenNeuronDetail(hiddenIndex: number) {
    const labels = inputLabelsFor(this.architecture.inputMode)
    const connections = []
    for (let inputIndex = 0; inputIndex < this.inputCount; inputIndex++) {
      connections.push({
        input: labels[inputIndex] ?? `entrada${inputIndex}`,
        weight:
          this.weightsInputToHidden[inputIndex * this.hiddenCount + hiddenIndex],
        activation: this.inputValues[inputIndex],
      })
    }
    return {
      activation: this.hiddenActivations[hiddenIndex],
      weightToOutput: this.weightsHiddenToOutput[hiddenIndex],
      contribution: this.hiddenNeuronContribution(hiddenIndex),
      connections,
    }
  }
}
