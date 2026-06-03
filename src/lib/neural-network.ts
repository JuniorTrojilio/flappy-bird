import {
  HIDDEN_SIZE,
  INPUT_LABELS,
  INPUT_SIZE,
  OUTPUT_SIZE,
} from '@/lib/nn-architecture'
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

/** Média dos pesos entrada→oculta por sentido (mesma leitura do painel). */
export function aggregatedInputWeightsFromSnapshot(s: NetworkSnapshot) {
  const w = [0, 0, 0]
  for (let i = 0; i < INPUT_SIZE; i++) {
    let sum = 0
    for (let j = 0; j < HIDDEN_SIZE; j++) {
      sum += s.ih[i * HIDDEN_SIZE + j]
    }
    w[i] = sum / HIDDEN_SIZE
  }
  return {
    w_distancia: clamp(w[0], -2, 2),
    w_altura: clamp(w[1], -2, 2),
    w_velocidade: clamp(w[2], -2, 2),
  }
}

export class NeuralNetwork {
  ih = new Float32Array(INPUT_SIZE * HIDDEN_SIZE)
  ho = new Float32Array(HIDDEN_SIZE * OUTPUT_SIZE)
  bh = new Float32Array(HIDDEN_SIZE)
  bo = new Float32Array(OUTPUT_SIZE)
  inputs = new Float32Array(INPUT_SIZE)
  hidden = new Float32Array(HIDDEN_SIZE)
  output = new Float32Array(OUTPUT_SIZE)
  zHidden = new Float32Array(HIDDEN_SIZE)
  zOutput = 0
  lastLoss = 0
  lastTarget = 0
  lastDecisionCorrect = true
  weightDeltas = { distancia: 0, altura: 0, velocidade: 0 }
  inputGradients = [0, 0, 0]
  learningRate = 0.15

  constructor() {
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
    const n = new NeuralNetwork()
    n.ih.set(this.ih)
    n.ho.set(this.ho)
    n.bh.set(this.bh)
    n.bo.set(this.bo)
    return n
  }

  copyFrom(other: NeuralNetwork) {
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
    this.ih.set(s.ih)
    this.ho.set(s.ho)
    this.bh.set(s.bh)
    this.bo.set(s.bo)
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

  setInputs(distancia: number, altura: number, velocidade: number) {
    this.inputs[0] = distancia
    this.inputs[1] = altura
    this.inputs[2] = velocidade
  }

  forward() {
    for (let j = 0; j < HIDDEN_SIZE; j++) {
      let sum = this.bh[j]
      for (let i = 0; i < INPUT_SIZE; i++) {
        sum += this.inputs[i] * this.ih[i * HIDDEN_SIZE + j]
      }
      this.zHidden[j] = sum
      this.hidden[j] = sigmoid(sum)
    }
    let sumOut = this.bo[0]
    for (let j = 0; j < HIDDEN_SIZE; j++) {
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
    return aggregatedInputWeightsFromSnapshot(this.toSnapshot())
  }

  trainOnDeath(idealFlap: boolean) {
    this.lastTarget = idealFlap ? 1 : 0
    const out = this.output[0]
    this.lastLoss = Math.abs(out - this.lastTarget)

    const outputError = out - this.lastTarget
    const outputDelta = outputError * sigmoidDerivative(out)

    const hiddenDeltas = new Float32Array(HIDDEN_SIZE)
    for (let j = 0; j < HIDDEN_SIZE; j++) {
      hiddenDeltas[j] =
        outputDelta * this.ho[j] * sigmoidDerivative(this.hidden[j])
    }

    const inputGrads = [0, 0, 0]
    for (let i = 0; i < INPUT_SIZE; i++) {
      let g = 0
      for (let j = 0; j < HIDDEN_SIZE; j++) {
        g += hiddenDeltas[j] * this.ih[i * HIDDEN_SIZE + j]
      }
      inputGrads[i] = Math.abs(g)
    }
    const sumG = inputGrads[0] + inputGrads[1] + inputGrads[2] || 1
    this.inputGradients = inputGrads.map((g) => g / sumG)

    const aggBefore = this.getAggregatedInputWeights()
    const lr = this.learningRate

    for (let j = 0; j < HIDDEN_SIZE; j++) {
      this.ho[j] -= lr * outputDelta * this.hidden[j]
    }
    this.bo[0] -= lr * outputDelta

    for (let j = 0; j < HIDDEN_SIZE; j++) {
      for (let i = 0; i < INPUT_SIZE; i++) {
        const idx = i * HIDDEN_SIZE + j
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
    const connections = []
    for (let i = 0; i < INPUT_SIZE; i++) {
      connections.push({
        input: INPUT_LABELS[i],
        weight: this.ih[i * HIDDEN_SIZE + index],
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
