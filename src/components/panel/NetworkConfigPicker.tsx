import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  architectureLabel,
  clampEvalSeeds,
  clampHiddenSize,
  EVAL_SEED_OPTIONS,
  HIDDEN_SIZE_OPTIONS,
  INPUT_MODE_LABELS,
  type EvalSeedOption,
  type HiddenSizeOption,
  type InputMode,
  type NnArchitecture,
} from '@/lib/nn-config'
import type { NnConfigState } from '@/game/game-engine'

type NetworkConfigPickerProps = {
  config: NnConfigState
  onApply: (config: NnConfigState) => void
}

export function NetworkConfigPicker({ config, onApply }: NetworkConfigPickerProps) {
  const [inputMode, setInputMode] = useState<InputMode>(config.architecture.inputMode)
  const [hiddenSize, setHiddenSize] = useState<HiddenSizeOption>(
    clampHiddenSize(config.architecture.hiddenSize)
  )
  const [evalSeeds, setEvalSeeds] = useState<EvalSeedOption>(
    clampEvalSeeds(config.evalSeeds)
  )

  useEffect(() => {
    setInputMode(config.architecture.inputMode)
    setHiddenSize(clampHiddenSize(config.architecture.hiddenSize))
    setEvalSeeds(clampEvalSeeds(config.evalSeeds))
  }, [config])

  const draft: NnArchitecture = { inputMode, hiddenSize }
  const isDirty =
    inputMode !== config.architecture.inputMode ||
    hiddenSize !== config.architecture.hiddenSize ||
    evalSeeds !== config.evalSeeds

  const commit = () => {
    onApply({
      architecture: {
        inputMode,
        hiddenSize: clampHiddenSize(hiddenSize),
      },
      evalSeeds: clampEvalSeeds(evalSeeds),
    })
  }

  return (
    <div className="space-y-2 text-[10px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">Entradas</span>
        {(['basic', 'extended'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            variant={inputMode === mode ? 'default' : 'secondary'}
            size="sm"
            className="h-6 px-2 text-[9px]"
            title={INPUT_MODE_LABELS[mode]}
            onClick={() => setInputMode(mode)}
          >
            {mode === 'basic' ? '3' : '5'}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">Ocultos</span>
        {HIDDEN_SIZE_OPTIONS.map((n) => (
          <Button
            key={n}
            type="button"
            variant={hiddenSize === n ? 'default' : 'secondary'}
            size="sm"
            className="h-6 w-7 px-0 text-[9px] tabular-nums"
            onClick={() => setHiddenSize(n)}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="whitespace-nowrap text-muted-foreground">Mapas/pássaro</span>
        {EVAL_SEED_OPTIONS.map((n) => (
          <Button
            key={n}
            type="button"
            variant={evalSeeds === n ? 'default' : 'secondary'}
            size="sm"
            className="h-6 w-7 px-0 text-[9px] tabular-nums"
            title={
              n === 1
                ? 'Fitness = partida visível'
                : `Fitness = média em ${n} circuitos aleatórios`
            }
            onClick={() => setEvalSeeds(n)}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[9px] text-sky-400/90">
          {architectureLabel(draft)} · {evalSeeds}× avaliação
        </span>
        <Button
          type="button"
          variant={isDirty ? 'default' : 'secondary'}
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={!isDirty}
          onClick={commit}
        >
          Aplicar rede
        </Button>
      </div>
    </div>
  )
}
