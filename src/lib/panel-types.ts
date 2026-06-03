export interface PanelInputs {
  distancia_cano: number
  altura_passaro: number
  velocidade: number
}

export interface PanelPesos {
  w_distancia: number
  w_altura: number
  w_velocidade: number
}

export interface PanelCalculo {
  z: number
  confianca: number
  decisao: 'bate' | 'nao_bate'
}

export interface PanelProgresso {
  geracao: number
  pontuacao: number
  recorde: number
  historico: number[]
  serieGrafico: number[]
  /** Treino em massa */
  populacao: number
  vivos: number
  melhorGeracao: number
  mediaGeracao: number
  /** Melhor genoma já encontrado (hall of fame). */
  hallOfFame: number
}

/** Métricas da evolução genética (não é backprop). */
export interface PanelEvolucao {
  geracao: number
  melhorRodada: number
  mediaRodada: number
  melhorUltimaGeracao: number
  deltaVsAnterior: number
  recorde: number
  populacao: number
  vivos: number
  elites: number
  imigrantes: number
  filhosMutados: number
  soloBird: boolean
  estagnado: boolean
  modoMutacao: string
}

export interface HiddenNeuronDetail {
  activation: number
  weightToOutput: number
  contribution: number
  connections: { input: string; weight: number; activation: number }[]
}

/** Pesos agregados do melhor genoma já guardado (hall of fame). */
export interface PanelCampeaoHistorico {
  score: number
  pesos: PanelPesos
}

export interface PanelState {
  inputs: PanelInputs
  /** Campeão que está jogando / sendo exibido agora. */
  pesos: PanelPesos
  /** Melhor campeão da história (hall of fame), se existir. */
  campeaoHistorico: PanelCampeaoHistorico | null
  calculo: PanelCalculo
  progresso: PanelProgresso
  diagram: { inputs: number[]; hidden: number[]; output: number[] }
  weights: { ih: number[]; ho: number[] }
  hiddenDetail: HiddenNeuronDetail[]
  evolucao: PanelEvolucao
  pesoMudou: boolean
  modoPopulacao: boolean
  modoJogador: boolean
  /** Modo jogador: aguardando clique/tecla para nova partida */
  playerAguardandoInicio: boolean
}

export interface PanelUiEvents {
  flashRecord: number
  recordBanner: string | null
  genScoreMsg: string | null
  decisionFeedback: { shouldFlap: boolean } | null
  backpropDeath: boolean
  backpropAdjusting: string
}
