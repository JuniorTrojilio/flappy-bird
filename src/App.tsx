import { useCallback, useRef, useState } from 'react'
import { GameCanvas } from '@/components/GameCanvas'
import { NeuralPanel } from '@/components/NeuralPanel'
import { GAME_WIDTH } from '@/game/constants'
import type { GameEngine, GameMode } from '@/game/game-engine'
import { clampPopulationSize } from '@/game/population-mode'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'

/** Largura fixa da coluna do jogo (canvas + padding lateral) */
const GAME_COLUMN_WIDTH = GAME_WIDTH + 48

const initialUi: PanelUiEvents = {
  flashRecord: 0,
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
  const frameRef = useRef(0)
  const [slowSnapshot, setSlowSnapshot] = useState<PanelState | null>(null)
  const engineRef = useRef<GameEngine | null>(null)

  const onState = useCallback((state: PanelState) => {
    setPanelState(state)
    frameRef.current++
    const slowEvery = speed >= 10 ? 3 : speed >= 5 ? 2 : 2
    if (frameRef.current % slowEvery === 0) {
      setSlowSnapshot(state)
    }
  }, [speed])

  const panelForSlow = slowSnapshot ?? panelState
  const slowSections = speed < 5 ? panelForSlow : slowSnapshot

  const onUiEvent = useCallback((patch: Partial<PanelUiEvents>) => {
    setUi((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleModeChange = useCallback((mode: GameMode) => {
    setGameMode(mode)
    setPaused(false)
    if (mode === 'player') {
      setPopulationSize(1)
      setSpeed(1)
    }
    engineRef.current?.setPlayerMode(mode === 'player')
  }, [])

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

  const handleClearTraining = useCallback(() => {
    if (
      !window.confirm(
        'Apagar todo o aprendizado salvo e recomeçar com 1 pássaro?'
      )
    ) {
      return
    }
    engineRef.current?.clearTraining()
    setPopulationSize(1)
    setGameMode('ai')
    setUi(initialUi)
    setPanelState(null)
    setSlowSnapshot(null)
    frameRef.current = 0
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
          }}
          onRestored={(info) =>
            setPopulationSize(clampPopulationSize(info.populationSize))
          }
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
          onSpeedChange={setSpeed}
          onPauseToggle={() => setPaused((p) => !p)}
          onModeChange={handleModeChange}
          onClearTraining={handleClearTraining}
          populationSize={populationSize}
          onPopulationChange={handlePopulationApply}
          onPlayerRestart={() => engineRef.current?.playerFlap()}
        />
      </main>
    </div>
  )
}
