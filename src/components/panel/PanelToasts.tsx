import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PanelUiEvents } from '@/lib/panel-types'

/** Mensagens temporárias em overlay — não empurram o layout */
export function PanelToasts({ ui }: { ui: PanelUiEvents }) {
  const hasToast = ui.recordBanner || ui.genScoreMsg
  if (!hasToast) return null

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-1/2 bottom-full z-30 mb-2',
        'flex w-max max-w-[min(100%,320px)] -translate-x-1/2 flex-col items-center gap-2 px-2'
      )}
      aria-live="polite"
    >
      {ui.recordBanner && (
        <Badge variant="warning" className="text-sm shadow-lg">
          {ui.recordBanner}
        </Badge>
      )}
      {ui.genScoreMsg && (
        <p className="rounded-md bg-amber-500/20 px-3 py-1 text-center text-sm text-amber-300 shadow-lg">
          {ui.genScoreMsg}
        </p>
      )}
    </div>
  )
}
