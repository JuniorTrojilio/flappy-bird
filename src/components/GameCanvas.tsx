import { useEffect, useRef } from 'react'
import { PanelToasts } from '@/components/panel/PanelToasts'
import { GAME_HEIGHT, GAME_WIDTH } from '@/game/constants'
import { GameEngine, type GameMode } from '@/game/game-engine'
import type { RestoredTrainingInfo } from '@/game/game-engine'
import type { PanelState, PanelUiEvents } from '@/lib/panel-types'

type GameCanvasProps = {
  speed: number
  paused: boolean
  gameMode: GameMode
  ui: PanelUiEvents
  onState: (state: PanelState) => void
  onUiEvent: (patch: Partial<PanelUiEvents>) => void
  onRestored?: (info: RestoredTrainingInfo) => void
  onEngineReady?: (engine: GameEngine) => void
}

export function GameCanvas({
  speed,
  paused,
  gameMode,
  ui,
  onState,
  onUiEvent,
  onRestored,
  onEngineReady,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)

  const speedRef = useRef(speed)
  const gameModeRef = useRef(gameMode)
  const onStateRef = useRef(onState)
  const onUiEventRef = useRef(onUiEvent)
  const onRestoredRef = useRef(onRestored)
  speedRef.current = speed
  gameModeRef.current = gameMode
  onStateRef.current = onState
  onUiEventRef.current = onUiEvent
  onRestoredRef.current = onRestored

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const engine = new GameEngine(canvas, {
      onState: (s) => onStateRef.current(s),
      onUiEvent: (p) => onUiEventRef.current(p),
      onRestored: (info) => onRestoredRef.current?.(info),
    })
    engine.setSpeed(speedRef.current)
    engine.setPlayerMode(gameModeRef.current === 'player')
    engineRef.current = engine
    onEngineReady?.(engine)
    return () => {
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    engineRef.current?.setPaused(paused)
  }, [paused])

  useEffect(() => {
    engineRef.current?.setPlayerMode(gameMode === 'player')
  }, [gameMode])

  // População só via botão Aplicar (evita resize ao restaurar do localStorage)

  useEffect(() => {
    const flap = () => engineRef.current?.playerFlap()

    const onKeyDown = (e: KeyboardEvent) => {
      if (gameModeRef.current !== 'player') return
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        flap()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <PanelToasts ui={ui} />
        <canvas
          ref={canvasRef}
          id="bird"
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          className="block cursor-pointer border border-black shadow-2xl"
          style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          onPointerDown={() => {
            if (gameModeRef.current === 'player') {
              engineRef.current?.playerFlap()
            }
          }}
          tabIndex={gameMode === 'player' ? 0 : -1}
          role="button"
          aria-label={
            gameMode === 'player'
              ? 'Flappy Bird — clique ou Espaço para jogar'
              : 'Flappy Bird'
          }
        />
      </div>
      <span className="text-center text-[10px] text-muted-foreground font-mono">
        {GAME_WIDTH} × {GAME_HEIGHT}px
        {gameMode === 'player' && (
          <>
            <br />
            Durante o jogo: Espaço, ↑ ou clique para bater asa
          </>
        )}
      </span>
    </div>
  )
}
