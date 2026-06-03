import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  clampPopulationSize,
  POPULATION_MAX,
  POPULATION_MIN,
} from '@/game/population-mode'

type PopulationInputProps = {
  value: number
  onChange: (n: number) => void
}

export function PopulationInput({ value, onChange }: PopulationInputProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const parsed = Number(draft)
  const clamped = useMemo(
    () => (Number.isFinite(parsed) ? clampPopulationSize(parsed) : null),
    [parsed]
  )
  const isDirty = clamped !== null && clamped !== value

  const commit = () => {
    if (clamped === null) return
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <label className="flex items-center gap-1.5">
        <span className="whitespace-nowrap">Pássaros</span>
        <input
          type="number"
          min={POPULATION_MIN}
          max={POPULATION_MAX}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          className="h-7 w-16 rounded-md border border-input bg-background px-1.5 text-center text-xs tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          aria-label="Quantidade de pássaros"
        />
      </label>
      <Button
        type="button"
        variant={isDirty ? 'default' : 'secondary'}
        size="sm"
        className="h-7 px-2 text-[10px]"
        disabled={!isDirty}
        onClick={commit}
        title={`Aplicar população (${POPULATION_MIN}–${POPULATION_MAX})`}
      >
        Aplicar
      </Button>
    </div>
  )
}
