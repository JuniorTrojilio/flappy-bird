/**
 * Tela principal: junta o canvas (jogo) e o painel da IA.
 * Guarda botões (velocidade, pausa, limpar treino, modo jogador) e repassa tudo ao GameEngine.
 * Guia completo: docs/GUIA-DO-CODIGO.md
 */
import { useCallback, useRef, useState } from 'react'
import { GameCanvas } from '@/components/GameCanvas'
import { NeuralPanel } from '@/components/NeuralPanel'
import { GAME_WIDTH } from '@/game/constants'
import type {
  ApplyChampionSnapshotOptions,
  GameEngine,
  GameMode,
  NnConfigState,
} from '@/game/game-engine'
import type { NetworkSnapshot } from '@/lib/neural-network'
import { clampPopulationSize } from '@/game/population-mode'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'
import {
  clearTrainingState,
  defaultNnPrefs,
  loadNnPrefs,
} from '@/lib/training-storage'

/** Largura fixa da coluna do jogo (canvas + padding lateral) */
const GAME_COLUMN_WIDTH = GAME_WIDTH + 48

const initialUi: PanelUiEvents = {
  recordBanner: null,
  genScoreMsg: null,
  decisionFeedback: null,
  backpropDeath: false,
  backpropAdjusting: '',
}

export default function App() {
  const [panelState, setPanelState] = useState<PanelState | null>(null)
  const [ui, setUi] = useState<PanelUiEvents>(initialUi)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(false)
  const [gameMode, setGameMode] = useState<GameMode>('ai')
  const [populationSize, setPopulationSize] = useState(1)
  const [nnConfig, setNnConfig] = useState<NnConfigState>(() => {
    const prefs = loadNnPrefs() ?? defaultNnPrefs()
    return {
      architecture: {
        inputMode: prefs.inputMode,
        hiddenSize: prefs.hiddenSize,
      },
      evalSeeds: prefs.evalSeeds,
    }
  })
  const frameRef = useRef(0)
  const speedRef = useRef(speed)
  speedRef.current = speed
  const [slowSnapshot, setSlowSnapshot] = useState<PanelState | null>(null)
  const engineRef = useRef<GameEngine | null>(null)

  const onState = useCallback((state: PanelState) => {
    setPanelState(state)
    frameRef.current++
    if (frameRef.current % 2 === 0) {
      setSlowSnapshot(state)
    }
  }, [])

  /** Turbo (×5+) só no motor; painel usa snapshot leve ou estado ao vivo. */
  const slowSections =
    speed >= 5 ? (slowSnapshot ?? panelState) : panelState

  const handleSpeedChange = useCallback((next: number) => {
    setSlowSnapshot(null)
    setSpeed(next)
  }, [])

  const onUiEvent = useCallback((patch: Partial<PanelUiEvents>) => {
    setUi((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleModeChange = useCallback(
    (mode: GameMode) => {
      setGameMode(mode)
      setPaused(false)
      if (mode === 'player') {
        setPopulationSize(1)
        handleSpeedChange(1)
      }
      engineRef.current?.setPlayerMode(mode === 'player')
    },
    [handleSpeedChange]
  )

  const handlePopulationApply = useCallback(
    (n: number) => {
      const size = clampPopulationSize(n)
      setPopulationSize(size)
      engineRef.current?.setPopulationSize(size)
      onUiEvent({
        genScoreMsg: `População: ${size} — campeão da geração preservado`,
      })
      window.setTimeout(() => onUiEvent({ genScoreMsg: null }), 2000)
    },
    [onUiEvent]
  )

  const handleNnConfigApply = useCallback(
    (config: NnConfigState) => {
      const ok = engineRef.current?.applyNnConfig(config) ?? false
      if (ok) setNnConfig(config)
    },
    []
  )

  const handleApplyChampionWeights = useCallback(
    (snapshot: NetworkSnapshot, options: ApplyChampionSnapshotOptions) => {
      const ok =
        engineRef.current?.applyChampionSnapshot(snapshot, options) ?? false
      if (ok) {
        onUiEvent({
          genScoreMsg: '✓ Pesos manuais aplicados no campeão',
        })
        window.setTimeout(() => onUiEvent({ genScoreMsg: null }), 2500)
      }
      return ok
    },
    [onUiEvent]
  )

  const handleCopyChampionWeights = useCallback(() => {
    return engineRef.current?.getChampionSnapshotJson() ?? null
  }, [])

  const handleClearTraining = useCallback(() => {
    if (
      !window.confirm(
        'Apagar todo o aprendizado salvo e recomeçar com 1 pássaro?'
      )
    ) {
      return
    }
    clearTrainingState()
    engineRef.current?.clearTraining()
    setPopulationSize(1)
    setGameMode('ai')
    setSpeed(1)
    setPaused(false)
    setUi(initialUi)
    setPanelState(null)
    setSlowSnapshot(null)
    frameRef.current = 0
    const prefs = defaultNnPrefs()
    setNnConfig({
      architecture: {
        inputMode: prefs.inputMode,
        hiddenSize: prefs.hiddenSize,
      },
      evalSeeds: prefs.evalSeeds,
    })
  }, [])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <aside
        className="flex shrink-0 items-center justify-center border-r border-border bg-slate-950 py-4"
        style={{ width: GAME_COLUMN_WIDTH, minWidth: GAME_COLUMN_WIDTH, maxWidth: GAME_COLUMN_WIDTH }}
      >
        <GameCanvas
          speed={speed}
          paused={paused}
          gameMode={gameMode}
          ui={ui}
          onState={onState}
          onUiEvent={onUiEvent}
          onEngineReady={(engine) => {
            engineRef.current = engine
            setNnConfig(engine.getNnConfig())
          }}
          onRestored={(info) => {
            setPopulationSize(1)
            setNnConfig({
              architecture: info.architecture,
              evalSeeds: info.evalSeeds,
            })
          }}
        />
      </aside>
      <main className="min-w-0 flex-1 h-full">
        <NeuralPanel
          state={panelState}
          slowState={slowSections}
          ui={ui}
          paused={paused}
          speed={speed}
          gameMode={gameMode}
          onSpeedChange={handleSpeedChange}
          onPauseToggle={() => setPaused((p) => !p)}
          onModeChange={handleModeChange}
          onClearTraining={handleClearTraining}
          populationSize={populationSize}
          onPopulationChange={handlePopulationApply}
          nnConfig={nnConfig}
          onNnConfigApply={handleNnConfigApply}
          onApplyChampionWeights={handleApplyChampionWeights}
          onCopyChampionWeights={handleCopyChampionWeights}
          onPlayerRestart={() => engineRef.current?.playerFlap()}
        />
      </main>
    </div>
  )
}
