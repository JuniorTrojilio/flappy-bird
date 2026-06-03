/** Arquitetura fixa da rede — não parametrizável */
export const INPUT_SIZE = 3
export const HIDDEN_SIZE = 4
export const OUTPUT_SIZE = 1

export const NN_NEURON_COUNT = INPUT_SIZE + HIDDEN_SIZE + OUTPUT_SIZE
export const NN_CONNECTION_COUNT = INPUT_SIZE * HIDDEN_SIZE + HIDDEN_SIZE * OUTPUT_SIZE
export const NN_WEIGHT_COUNT = NN_CONNECTION_COUNT

export const INPUT_LABELS = ['distancia', 'altura', 'velocidade'] as const
