import { useMemo } from 'react'
import { HIDDEN_SIZE, INPUT_SIZE } from '@/lib/nn-architecture'
import type { PanelState } from '@/lib/panel-types'
import { cn } from '@/lib/utils'

const POSITIONS = {
  input: [
    { x: 28, y: 24 },
    { x: 28, y: 52 },
    { x: 28, y: 80 },
  ],
  hidden: [
    { x: 108, y: 16 },
    { x: 108, y: 40 },
    { x: 108, y: 64 },
    { x: 108, y: 88 },
  ],
  output: [{ x: 200, y: 52 }],
}

function activationColor(v: number) {
  const t = Math.max(0, Math.min(1, v))
  if (t < 0.5) {
    const u = t * 2
    const r = Math.round(26 + (59 - 26) * u)
    const g = Math.round(26 + (130 - 26) * u)
    const b = Math.round(26 + (246 - 26) * u)
    return `rgb(${r},${g},${b})`
  }
  const u = (t - 0.5) * 2
  const r = Math.round(59 + (255 - 59) * u)
  const g = Math.round(130 + (255 - 130) * u)
  const b = Math.round(246 + (255 - 246) * u)
  return `rgb(${r},${g},${b})`
}

type NetworkDiagramProps = {
  state: PanelState
  paused: boolean
  highlightIndex: number | null
  onHighlight: (index: number | null) => void
  backpropActive: boolean
  compact?: boolean
}

export function NetworkDiagram({
  state,
  paused,
  highlightIndex,
  onHighlight,
  backpropActive,
  compact,
}: NetworkDiagramProps) {
  const { diagram, weights, hiddenDetail } = state

  const connections = useMemo(() => {
    const lines: {
      x1: number
      y1: number
      x2: number
      y2: number
      w: number
    }[] = []
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let j = 0; j < HIDDEN_SIZE; j++) {
        const w = weights.ih[i * HIDDEN_SIZE + j]
        lines.push({
          x1: POSITIONS.input[i].x,
          y1: POSITIONS.input[i].y,
          x2: POSITIONS.hidden[j].x,
          y2: POSITIONS.hidden[j].y,
          w,
        })
      }
    }
    for (let j = 0; j < HIDDEN_SIZE; j++) {
      lines.push({
        x1: POSITIONS.hidden[j].x,
        y1: POSITIONS.hidden[j].y,
        x2: POSITIONS.output[0].x,
        y2: POSITIONS.output[0].y,
        w: weights.ho[j],
      })
    }
    return lines
  }, [weights])

  const lineStyle = (w: number) => {
    const aw = Math.abs(w)
    const width = 0.5 + Math.min(aw / 2, 1) * 4.5
    const color = w >= 0 ? '#22C55E' : '#EF4444'
    const opacity = 0.3 + Math.min(aw / 2, 1) * 0.7
    return { stroke: color, strokeWidth: width, strokeOpacity: opacity }
  }

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col' : 'space-y-2'}>
      {!compact && (
        <p className="text-center text-[10px] tracking-wider text-muted-foreground">
          SENTIDOS · PENSAMENTO · AÇÃO
        </p>
      )}
      <svg
        viewBox="0 0 248 120"
        className={cn(
          cnSvg(backpropActive),
          compact ? 'min-h-0 flex-1 w-full' : 'h-auto w-full max-w-full'
        )}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Diagrama da rede neural"
      >
        <g>
          {connections.map((c, i) => (
            <line
              key={i}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              {...lineStyle(c.w)}
            />
          ))}
        </g>
        {diagram.inputs.map((v, i) => (
          <Neuron
            key={`in-${i}`}
            x={POSITIONS.input[i].x}
            y={POSITIONS.input[i].y}
            v={v}
            paused={paused}
          />
        ))}
        {diagram.hidden.map((v, i) => (
          <Neuron
            key={`h-${i}`}
            x={POSITIONS.hidden[i].x}
            y={POSITIONS.hidden[i].y}
            v={v}
            paused={paused}
            title="Combina os 3 sentidos à sua maneira"
            onClick={() =>
              onHighlight(highlightIndex === i ? null : i)
            }
            highlighted={highlightIndex === i}
          />
        ))}
        {diagram.output.map((v, i) => (
          <Neuron
            key={`out-${i}`}
            x={POSITIONS.output[i].x}
            y={POSITIONS.output[i].y}
            v={v}
            paused={paused}
          />
        ))}
      </svg>
      {!compact && (
        <>
          <div className="flex justify-between px-2 text-[10px] text-muted-foreground">
            <span>Entrada</span>
            <span>Pensamento</span>
            <span>Ação</span>
          </div>
          {highlightIndex !== null && hiddenDetail[highlightIndex] && (
            <div className="rounded-md border bg-secondary/50 p-2 text-[10px] leading-relaxed">
              <strong>N{highlightIndex + 1}</strong> · act{' '}
              {hiddenDetail[highlightIndex].activation.toFixed(2)}
            </div>
          )}
        </>
      )}
      {compact && highlightIndex !== null && hiddenDetail[highlightIndex] && (
        <p className="shrink-0 truncate text-[9px] text-muted-foreground">
          N{highlightIndex + 1} act {hiddenDetail[highlightIndex].activation.toFixed(2)}
        </p>
      )}
    </div>
  )
}

function cnSvg(backprop: boolean) {
  return `w-full max-w-full h-auto ${backprop ? 'animate-pulse' : ''}`
}

function Neuron({
  x,
  y,
  v,
  paused,
  title,
  onClick,
  highlighted,
}: {
  x: number
  y: number
  v: number
  paused: boolean
  title?: string
  onClick?: () => void
  highlighted?: boolean
}) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined }}
    >
      {title && <title>{title}</title>}
      {paused && <title>{`Ativação: ${v.toFixed(4)}`}</title>}
      <circle
        r={9}
        fill={activationColor(v)}
        stroke={highlighted ? '#38bdf8' : '#475569'}
        strokeWidth={highlighted ? 2.5 : 1.5}
      />
      <text
        textAnchor="middle"
        dy="0.35em"
        fontSize={8}
        fill={v > 0.6 ? '#0f172a' : '#e2e8f0'}
      >
        {v.toFixed(1)}
      </text>
    </g>
  )
}
