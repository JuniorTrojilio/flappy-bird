import {
  defaultArchitecture,
  inputLabelsFor,
  inputSizeFor,
  OUTPUT_SIZE,
  type NnArchitecture,
} from '@/lib/nn-config'
import { clamp } from '@/lib/utils'

export type NetworkSnapshot = {
  ih: number[]
  ho: number[]
  bh: number[]
  bo: number[]
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x))
}

function sigmoidDerivative(x: number) {
  return x * (1 - x)
}

/** Média dos pesos entrada→oculta por sentido (painel — só 3 primeiros sentidos). */
export function aggregatedInputWeightsFromSnapshot(
  s: NetworkSnapshot,
  arch: NnArchitecture
) {
  const inSize = inputSizeFor(arch.inputMode)
  const h = arch.hiddenSize
  const w = [0, 0, 0]
  for (let i = 0; i < Math.min(3, inSize); i++) {
    let sum = 0
    for (let j = 0; j < h; j++) {
      sum += s.ih[i * h + j]
    }
    w[i] = sum / h
  }
  return {
    w_distancia: clamp(w[0], -2, 2),
    w_altura: clamp(w[1], -2, 2),
    w_velocidade: clamp(w[2], -2, 2),
  }
}

export class NeuralNetwork {
  readonly arch: NnArchitecture
  readonly inputSize: number
  readonly hiddenSize: number

  ih: Float32Array
  ho: Float32Array
  bh: Float32Array
  bo: Float32Array
  inputs: Float32Array
  hidden: Float32Array
  output: Float32Array
  zHidden: Float32Array
  zOutput = 0
  lastLoss = 0
  lastTarget = 0
  lastDecisionCorrect = true
  weightDeltas = { distancia: 0, altura: 0, velocidade: 0 }
  inputGradients: number[] = []
  learningRate = 0.15

  constructor(arch: NnArchitecture = defaultArchitecture()) {
    this.arch = { ...arch, hiddenSize: arch.hiddenSize }
    this.inputSize = inputSizeFor(arch.inputMode)
    this.hiddenSize = arch.hiddenSize
    this.ih = new Float32Array(this.inputSize * this.hiddenSize)
    this.ho = new Float32Array(this.hiddenSize * OUTPUT_SIZE)
    this.bh = new Float32Array(this.hiddenSize)
    this.bo = new Float32Array(OUTPUT_SIZE)
    this.inputs = new Float32Array(this.inputSize)
    this.hidden = new Float32Array(this.hiddenSize)
    this.output = new Float32Array(OUTPUT_SIZE)
    this.zHidden = new Float32Array(this.hiddenSize)
    this.inputGradients = new Array(this.inputSize).fill(0)
    this.randomize()
  }

  randomize() {
    const init = () => (Math.random() * 2 - 1) * 1.2
    for (let i = 0; i < this.ih.length; i++) this.ih[i] = init()
    for (let i = 0; i < this.ho.length; i++) this.ho[i] = init()
    for (let i = 0; i < this.bh.length; i++) this.bh[i] = init() * 0.5
    this.bo[0] = init() * 0.5
  }

  clone(): NeuralNetwork {
    const n = new NeuralNetwork(this.arch)
    n.ih.set(this.ih)
    n.ho.set(this.ho)
    n.bh.set(this.bh)
    n.bo.set(this.bo)
    return n
  }

  copyFrom(other: NeuralNetwork) {
    if (
      other.inputSize !== this.inputSize ||
      other.hiddenSize !== this.hiddenSize
    ) {
      return
    }
    this.ih.set(other.ih)
    this.ho.set(other.ho)
    this.bh.set(other.bh)
    this.bo.set(other.bo)
  }

  toSnapshot(): NetworkSnapshot {
    return {
      ih: Array.from(this.ih),
      ho: Array.from(this.ho),
      bh: Array.from(this.bh),
      bo: Array.from(this.bo),
    }
  }

  loadSnapshot(s: NetworkSnapshot) {
    if (s.ih.length !== this.ih.length) return false
    this.ih.set(s.ih)
    this.ho.set(s.ho)
    this.bh.set(s.bh)
    this.bo.set(s.bo)
    return true
  }

  mutate(rate = 0.1, strength = 0.3) {
    const tweak = (arr: Float32Array) => {
      for (let i = 0; i < arr.length; i++) {
        if (Math.random() < rate) {
          arr[i] += (Math.random() * 2 - 1) * strength
        }
      }
    }
    tweak(this.ih)
    tweak(this.ho)
    tweak(this.bh)
    tweak(this.bo)
  }

  setInputVector(values: readonly number[]) {
    const n = Math.min(values.length, this.inputSize)
    for (let i = 0; i < n; i++) this.inputs[i] = values[i]
    for (let i = n; i < this.inputSize; i++) this.inputs[i] = 0
  }

  /** Compat: 3 sentidos básicos (preenche o resto com 0 se extended). */
  setInputs(distancia: number, altura: number, velocidade: number) {
    this.setInputVector([distancia, altura, velocidade])
  }

  forward() {
    const { inputSize, hiddenSize } = this
    for (let j = 0; j < hiddenSize; j++) {
      let sum = this.bh[j]
      for (let i = 0; i < inputSize; i++) {
        sum += this.inputs[i] * this.ih[i * hiddenSize + j]
      }
      this.zHidden[j] = sum
      this.hidden[j] = sigmoid(sum)
    }
    let sumOut = this.bo[0]
    for (let j = 0; j < hiddenSize; j++) {
      sumOut += this.hidden[j] * this.ho[j]
    }
    this.zOutput = sumOut
    this.output[0] = sigmoid(sumOut)
    return this.output[0]
  }

  decide(): 'bate' | 'nao_bate' {
    return this.output[0] > 0.5 ? 'bate' : 'nao_bate'
  }

  getAggregatedInputWeights() {
    return aggregatedInputWeightsFromSnapshot(this.toSnapshot(), this.arch)
  }

  trainOnDeath(idealFlap: boolean) {
    this.lastTarget = idealFlap ? 1 : 0
    const out = this.output[0]
    this.lastLoss = Math.abs(out - this.lastTarget)

    const outputError = out - this.lastTarget
    const outputDelta = outputError * sigmoidDerivative(out)

    const hiddenDeltas = new Float32Array(this.hiddenSize)
    for (let j = 0; j < this.hiddenSize; j++) {
      hiddenDeltas[j] =
        outputDelta * this.ho[j] * sigmoidDerivative(this.hidden[j])
    }

    const inputGrads = new Array(this.inputSize).fill(0)
    for (let i = 0; i < this.inputSize; i++) {
      let g = 0
      for (let j = 0; j < this.hiddenSize; j++) {
        g += hiddenDeltas[j] * this.ih[i * this.hiddenSize + j]
      }
      inputGrads[i] = Math.abs(g)
    }
    const sumG = inputGrads.reduce((a, b) => a + b, 0) || 1
    this.inputGradients = inputGrads.map((g) => g / sumG)

    const aggBefore = this.getAggregatedInputWeights()
    const lr = this.learningRate

    for (let j = 0; j < this.hiddenSize; j++) {
      this.ho[j] -= lr * outputDelta * this.hidden[j]
    }
    this.bo[0] -= lr * outputDelta

    for (let j = 0; j < this.hiddenSize; j++) {
      for (let i = 0; i < this.inputSize; i++) {
        const idx = i * this.hiddenSize + j
        this.ih[idx] -= lr * hiddenDeltas[j] * this.inputs[i]
      }
      this.bh[j] -= lr * hiddenDeltas[j]
    }

    const aggAfter = this.getAggregatedInputWeights()
    this.weightDeltas = {
      distancia: aggAfter.w_distancia - aggBefore.w_distancia,
      altura: aggAfter.w_altura - aggBefore.w_altura,
      velocidade: aggAfter.w_velocidade - aggBefore.w_velocidade,
    }
  }

  evaluateDecision(idealFlap: boolean) {
    const decided = this.decide() === 'bate'
    this.lastDecisionCorrect = decided === idealFlap
    return this.lastDecisionCorrect
  }

  getPanelCalculo() {
    return {
      z: this.zOutput,
      confianca: this.output[0],
      decisao: this.decide(),
    }
  }

  getActivationsForDiagram() {
    return {
      inputs: Array.from(this.inputs),
      hidden: Array.from(this.hidden),
      output: [this.output[0]],
    }
  }

  getAllWeights() {
    return { ih: Array.from(this.ih), ho: Array.from(this.ho) }
  }

  hiddenNeuronContribution(index: number) {
    return this.hidden[index] * this.ho[index] * this.output[0]
  }

  getHiddenNeuronDetail(index: number) {
    const labels = inputLabelsFor(this.arch.inputMode)
    const connections = []
    for (let i = 0; i < this.inputSize; i++) {
      connections.push({
        input: labels[i] ?? `in${i}`,
        weight: this.ih[i * this.hiddenSize + index],
        activation: this.inputs[i],
      })
    }
    return {
      activation: this.hidden[index],
      weightToOutput: this.ho[index],
      contribution: this.hiddenNeuronContribution(index),
      connections,
    }
  }
}
