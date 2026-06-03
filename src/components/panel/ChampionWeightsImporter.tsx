import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import type {
  ApplyChampionSnapshotOptions,
  NnConfigState,
} from '@/game/game-engine'
import {
  exampleSnapshotJson,
  formatSnapshotSizesHint,
  parseNetworkSnapshotJson,
} from '@/lib/network-snapshot-import'
import type { NetworkSnapshot } from '@/lib/neural-network'

type ChampionWeightsImporterProps = {
  nnConfig: NnConfigState
  onApply: (
    snapshot: NetworkSnapshot,
    options: ApplyChampionSnapshotOptions
  ) => boolean
  onCopyCurrent: () => string | null
}

export function ChampionWeightsImporter({
  nnConfig,
  onApply,
  onCopyCurrent,
}: ChampionWeightsImporterProps) {
  const [open, setOpen] = useState(false)
  const [jsonText, setJsonText] = useState('')
  const [registerHall, setRegisterHall] = useState(true)
  const [hallScore, setHallScore] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const architecture = nnConfig.architecture
  const sizesHint = formatSnapshotSizesHint(architecture)

  const handleApply = useCallback(() => {
    const parsed = parseNetworkSnapshotJson(jsonText, architecture)
    if (!parsed.ok) {
      setError(parsed.error)
      setMessage(null)
      return
    }
    const hall =
      registerHall && hallScore.trim() !== ''
        ? Math.max(0, Math.round(Number(hallScore)))
        : undefined
    const ok = onApply(parsed.snapshot, {
      registerHallOfFame: registerHall,
      hallScore: hall,
    })
    if (!ok) {
      setError('Não foi possível aplicar (modo jogador ou rede diferente do JSON).')
      setMessage(null)
      return
    }
    setError(null)
    setMessage('Pesos aplicados no campeão (pássaro 0). A rede já decide com eles.')
  }, [jsonText, architecture, registerHall, hallScore, onApply])

  const handleCopy = useCallback(() => {
    const text = onCopyCurrent()
    if (!text) {
      setError('Motor ainda não está pronto.')
      return
    }
    setJsonText(text)
    setError(null)
    setMessage('JSON do campeão atual colado no campo.')
    void navigator.clipboard?.writeText(text).catch(() => {})
  }, [onCopyCurrent])

  const handleExample = useCallback(() => {
    setJsonText(exampleSnapshotJson(architecture))
    setError(null)
    setMessage('Modelo vazio (zeros) — troque pelos seus números.')
  }, [architecture])

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-2 h-7 w-full text-[9px]"
        onClick={() => setOpen(true)}
      >
        Informar pesos do campeão (JSON)
      </Button>
    )
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/80 bg-muted/20 p-2 text-[9px]">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Pesos manuais do campeão</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-5 px-1 text-[8px]"
          onClick={() => setOpen(false)}
        >
          Fechar
        </Button>
      </div>
      <p className="leading-snug text-muted-foreground">
        Os 3 números do painel (Cano / Altura / Queda) são só uma média — para a IA
        agir igual ao campeão você precisa do JSON completo com todos os pesos e
        vieses. Rede atual: <span className="text-sky-400">{sizesHint}</span>
      </p>
      <textarea
        className="h-28 w-full resize-y rounded border border-input bg-background px-2 py-1 font-mono text-[8px] leading-tight text-foreground"
        placeholder='{"weightsInputToHidden":[...], ...}'
        value={jsonText}
        onChange={(event) => setJsonText(event.target.value)}
        spellCheck={false}
      />
      <div className="flex flex-wrap gap-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 px-2 text-[8px]"
          onClick={handleCopy}
        >
          Copiar campeão atual
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-6 px-2 text-[8px]"
          onClick={handleExample}
        >
          Modelo vazio
        </Button>
      </div>
      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={registerHall}
          onChange={(event) => setRegisterHall(event.target.checked)}
          className="size-3"
        />
        Registrar também no hall of fame
      </label>
      {registerHall && (
        <label className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Placar hall</span>
          <input
            type="number"
            min={0}
            className="h-6 w-16 rounded border border-input bg-background px-1 tabular-nums"
            placeholder="auto"
            value={hallScore}
            onChange={(event) => setHallScore(event.target.value)}
          />
        </label>
      )}
      <Button
        type="button"
        size="sm"
        className="h-7 w-full text-[9px]"
        onClick={handleApply}
      >
        Aplicar no campeão
      </Button>
      {error && <p className="text-red-400">{error}</p>}
      {message && !error && <p className="text-emerald-400">{message}</p>}
      <p className="text-[8px] text-muted-foreground">
        Com população &gt; 1, só o pássaro 0 recebe estes pesos. Aceita formato antigo
        (ih, ho, bh, bo).
      </p>
    </div>
  )
}
