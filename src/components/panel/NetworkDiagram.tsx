import { useMemo, type SVGProps } from 'react'
import { HIDDEN_SIZE, INPUT_SIZE } from '@/lib/nn-architecture'
import type { HiddenNeuronDetail, PanelState } from '@/lib/panel-types'
import { cn } from '@/lib/utils'

/** Ativação sigmoid: acima disso o nó é considerado “ligado”. */
const ACTIVATION_ON = 0.55

const LAYOUT = {
  input: [
    { x: 58, y: 30 },
    { x: 58, y: 72 },
    { x: 58, y: 114 },
  ],
  hidden: [
    { x: 172, y: 22 },
    { x: 172, y: 50 },
    { x: 172, y: 78 },
    { x: 172, y: 106 },
  ],
  output: [{ x: 292, y: 72 }],
} as const

const INPUT_META = [
  {
    label: 'Cano',
    hint: 'Quão longe está o próximo cano (0 = perto, 1 = longe)',
  },
  {
    label: 'Abertura',
    hint: 'Posição na fenda do cano (0 = topo, 1 = base)',
  },
  {
    label: 'Queda',
    hint: 'Velocidade vertical (caindo = valor alto)',
  },
] as const

const HIDDEN_HINT =
  'Combina os 3 sentidos; clique para ver o que está pesando agora'

const INPUT_KEY_LABEL: Record<string, string> = {
  distancia: 'Cano',
  altura: 'Abertura',
  velocidade: 'Queda',
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

function isNodeOn(v: number) {
  return v >= ACTIVATION_ON
}

function indexOfMax(values: readonly number[], min = ACTIVATION_ON) {
  let idx = -1
  let max = min - 0.001
  values.forEach((v, i) => {
    if (v > max) {
      max = v
      idx = i
    }
  })
  return idx
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
  const { diagram, weights, hiddenDetail, calculo, inputs } = state

  const connections = useMemo(() => {
    const lines: {
      x1: number
      y1: number
      x2: number
      y2: number
      w: number
      fromInput: boolean
      inputIdx: number
      hiddenIdx: number
    }[] = []
    for (let i = 0; i < INPUT_SIZE; i++) {
      for (let j = 0; j < HIDDEN_SIZE; j++) {
        lines.push({
          x1: LAYOUT.input[i].x,
          y1: LAYOUT.input[i].y,
          x2: LAYOUT.hidden[j].x,
          y2: LAYOUT.hidden[j].y,
          w: weights.ih[i * HIDDEN_SIZE + j],
          fromInput: true,
          inputIdx: i,
          hiddenIdx: j,
        })
      }
    }
    for (let j = 0; j < HIDDEN_SIZE; j++) {
      lines.push({
        x1: LAYOUT.hidden[j].x,
        y1: LAYOUT.hidden[j].y,
        x2: LAYOUT.output[0].x,
        y2: LAYOUT.output[0].y,
        w: weights.ho[j],
        fromInput: false,
        inputIdx: -1,
        hiddenIdx: j,
      })
    }
    return lines
  }, [weights])

  const topInput = indexOfMax(diagram.inputs, 0.35)
  const topHidden = indexOfMax(diagram.hidden)
  const outputOn = isNodeOn(diagram.output[0])
  const wantsFlap = calculo.decisao === 'bate'

  const focusHidden =
    highlightIndex !== null ? highlightIndex : topHidden >= 0 ? topHidden : null

  const lineStyle = (
    w: number,
    emphasis: boolean
  ): SVGProps<SVGLineElement> => {
    const aw = Math.abs(w)
    const width = (emphasis ? 1.2 : 0.5) + Math.min(aw / 2, 1) * (emphasis ? 4 : 3)
    const color = w >= 0 ? '#22C55E' : '#EF4444'
    const opacity = emphasis
      ? 0.55 + Math.min(aw / 2, 1) * 0.45
      : 0.18 + Math.min(aw / 2, 1) * 0.35
    return { stroke: color, strokeWidth: width, strokeOpacity: opacity }
  }

  const connectionEmphasis = (c: (typeof connections)[0]) => {
    if (c.fromInput) {
      const inOn = isNodeOn(diagram.inputs[c.inputIdx])
      const hidOn =
        focusHidden === c.hiddenIdx || isNodeOn(diagram.hidden[c.hiddenIdx])
      return inOn && hidOn
    }
    const hidOn =
      focusHidden === c.hiddenIdx || isNodeOn(diagram.hidden[c.hiddenIdx])
    return hidOn && (outputOn || wantsFlap)
  }

  return (
    <div className={compact ? 'flex h-full min-h-0 flex-col gap-1' : 'space-y-2'}>
      {!compact && (
        <p className="text-center text-[10px] tracking-wider text-muted-foreground">
          Entrada (sentidos) → Oculta (combina) → Saída (bater ou não)
        </p>
      )}

      <svg
        viewBox="0 0 340 132"
        className={cn(
          'w-full max-w-full',
          compact ? 'min-h-0 flex-1' : 'h-auto',
          backpropActive && 'animate-pulse'
        )}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Diagrama da rede neural 3-4-1 com entradas Cano, Abertura e Queda"
      >
        <LayerTitle x={58} text="Entrada" sub="o que sente" />
        <LayerTitle x={172} text="Oculta" sub="combina" />
        <LayerTitle x={292} text="Saída" sub="ação" />

        <g>
          {connections.map((c, i) => (
            <line
              key={i}
              x1={c.x1}
              y1={c.y1}
              x2={c.x2}
              y2={c.y2}
              {...lineStyle(c.w, connectionEmphasis(c))}
            />
          ))}
        </g>

        {diagram.inputs.map((v, i) => (
          <InputNeuron
            key={`in-${i}`}
            x={LAYOUT.input[i].x}
            y={LAYOUT.input[i].y}
            v={v}
            label={INPUT_META[i].label}
            hint={INPUT_META[i].hint}
            live={formatInputLive(i, inputs)}
            active={isNodeOn(v)}
            primary={topInput === i}
            paused={paused}
          />
        ))}

        {diagram.hidden.map((v, i) => (
          <HiddenNeuron
            key={`h-${i}`}
            x={LAYOUT.hidden[i].x}
            y={LAYOUT.hidden[i].y}
            index={i}
            v={v}
            active={isNodeOn(v)}
            primary={topHidden === i && highlightIndex === null}
            highlighted={highlightIndex === i}
            focused={focusHidden === i}
            paused={paused}
            onClick={() => onHighlight(highlightIndex === i ? null : i)}
          />
        ))}

        <OutputNeuron
          x={LAYOUT.output[0].x}
          y={LAYOUT.output[0].y}
          v={diagram.output[0]}
          active={outputOn}
          wantsFlap={wantsFlap}
          confianca={calculo.confianca}
          paused={paused}
        />
      </svg>

      <DiagramLegend compact={compact} />

      {focusHidden !== null && hiddenDetail[focusHidden] ? (
        <HiddenExplainer
          index={focusHidden}
          detail={hiddenDetail[focusHidden]}
          compact={compact}
          userPicked={highlightIndex !== null}
        />
      ) : (
        <p className="shrink-0 text-[9px] leading-snug text-muted-foreground">
          Toque num círculo da camada oculta para ver como ele mistura Cano,
          Abertura e Queda.
        </p>
      )}
    </div>
  )
}

function LayerTitle({
  x,
  text,
  sub,
}: {
  x: number
  text: string
  sub: string
}) {
  return (
    <g transform={`translate(${x},10)`}>
      <text
        textAnchor="middle"
        fontSize={8}
        fontWeight={600}
        fill="#94a3b8"
      >
        {text}
      </text>
      <text textAnchor="middle" y={10} fontSize={6.5} fill="#64748b">
        {sub}
      </text>
    </g>
  )
}

function InputNeuron({
  x,
  y,
  v,
  label,
  hint,
  live,
  active,
  primary,
  paused,
}: {
  x: number
  y: number
  v: number
  label: string
  hint: string
  live: string
  active: boolean
  primary: boolean
  paused: boolean
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{`${label}: ${hint}\nAgora: ${live} · ativação ${v.toFixed(2)}`}</title>
      <text
        x={-14}
        y={-14}
        textAnchor="end"
        fontSize={7.5}
        fontWeight={600}
        fill={active ? '#e2e8f0' : '#64748b'}
      >
        {label}
      </text>
      {primary && active && (
        <text x={-14} y={-5} textAnchor="end" fontSize={6} fill="#38bdf8">
          ↑ forte
        </text>
      )}
      <NeuronCore v={v} active={active} paused={paused} />
      <text y={16} textAnchor="middle" fontSize={6} fill="#64748b">
        {v.toFixed(2)}
      </text>
    </g>
  )
}

function HiddenNeuron({
  x,
  y,
  index,
  v,
  active,
  primary,
  highlighted,
  focused,
  paused,
  onClick,
}: {
  x: number
  y: number
  index: number
  v: number
  active: boolean
  primary: boolean
  highlighted: boolean
  focused: boolean
  paused: boolean
  onClick: () => void
}) {
  return (
    <g
      transform={`translate(${x},${y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <title>
        {`Neurônio ${index + 1}: ${HIDDEN_HINT}\nAtivação ${v.toFixed(2)}`}
      </title>
      <text
        x={-12}
        y={3}
        textAnchor="end"
        fontSize={7}
        fill={focused ? '#38bdf8' : '#64748b'}
      >
        N{index + 1}
      </text>
      {primary && (
        <text x={14} y={-10} fontSize={6} fill="#38bdf8">
          mais ativo
        </text>
      )}
      <NeuronCore
        v={v}
        active={active}
        highlighted={highlighted || focused}
        paused={paused}
      />
      <text y={16} textAnchor="middle" fontSize={6} fill="#64748b">
        {v.toFixed(2)}
      </text>
    </g>
  )
}

function OutputNeuron({
  x,
  y,
  v,
  active,
  wantsFlap,
  confianca,
  paused,
}: {
  x: number
  y: number
  v: number
  active: boolean
  wantsFlap: boolean
  confianca: number
  paused: boolean
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      <title>
        {`Saída: ${wantsFlap ? 'mandou bater asas' : 'não bater agora'} (${Math.round(confianca * 100)}% confiança)\nValor > 0,5 ≈ bater`}
      </title>
      <text
        x={14}
        y={-12}
        textAnchor="start"
        fontSize={7.5}
        fontWeight={600}
        fill={wantsFlap ? '#6ee7b7' : '#94a3b8'}
      >
        Asas
      </text>
      <NeuronCore
        v={v}
        active={active}
        highlighted={wantsFlap}
        highlightColor={wantsFlap ? '#22c55e' : undefined}
        paused={paused}
      />
      <text
        y={18}
        textAnchor="middle"
        fontSize={7}
        fontWeight={700}
        fill={wantsFlap ? '#6ee7b7' : '#94a3b8'}
      >
        {wantsFlap ? 'BATE' : 'PARA'}
      </text>
    </g>
  )
}

function NeuronCore({
  v,
  active,
  highlighted,
  highlightColor = '#38bdf8',
  paused,
}: {
  v: number
  active: boolean
  highlighted?: boolean
  highlightColor?: string
  paused: boolean
}) {
  return (
    <g>
      {active && (
        <circle
          r={12}
          fill="none"
          stroke={highlightColor}
          strokeWidth={1.5}
          opacity={0.85}
          className={paused ? undefined : 'animate-pulse'}
        />
      )}
      <circle
        r={9}
        fill={activationColor(v)}
        stroke={highlighted ? highlightColor : '#475569'}
        strokeWidth={highlighted ? 2.5 : 1.5}
        opacity={active ? 1 : 0.72}
      />
    </g>
  )
}

function DiagramLegend({ compact }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'shrink-0 rounded border border-border/60 bg-secondary/30 px-1.5 py-1 text-[8px] leading-snug text-muted-foreground',
        compact && 'text-[7.5px]'
      )}
    >
      <span className="text-foreground/80">Cor do círculo</span> = intensidade
      (escuro → claro).{' '}
      <span className="text-sky-400/90">Anel</span> = ligado (≥
      {ACTIVATION_ON.toFixed(2)}). Linhas mais fortes = caminho ativo agora.
    </div>
  )
}

function HiddenExplainer({
  index,
  detail,
  compact,
  userPicked,
}: {
  index: number
  detail: HiddenNeuronDetail
  compact?: boolean
  userPicked: boolean
}) {
  const act = detail.activation
  const level =
    act >= 0.75 ? 'muito ligado' : act >= ACTIVATION_ON ? 'ligado' : 'fraco'

  const lines = detail.connections
    .map((c) => {
      const name = INPUT_KEY_LABEL[c.input] ?? c.input
      const sign = c.weight >= 0 ? '+' : ''
      const w = c.weight.toFixed(2)
      const a = c.activation.toFixed(2)
      return `${name} (entrada ${a}) × peso ${sign}${w}`
    })
    .join(' · ')

  const push =
    detail.contribution >= 0.02
      ? 'empurra para BATER'
      : detail.contribution <= -0.02
        ? 'empurra para PARAR'
        : 'influência fraca na decisão'

  return (
    <div
      className={cn(
        'shrink-0 rounded-md border border-sky-500/25 bg-sky-950/20 p-1.5 leading-snug',
        compact ? 'text-[8px]' : 'text-[10px]'
      )}
    >
      <p className="font-semibold text-sky-200/90">
        Neurônio {index + 1}
        {!userPicked && ' (mais ativo agora)'} — {level} ({act.toFixed(2)})
      </p>
      <p className="mt-0.5 text-muted-foreground">{lines}</p>
      <p className="mt-0.5 text-foreground/80">
        → saída: peso {detail.weightToOutput.toFixed(2)} · {push}
      </p>
    </div>
  )
}

function formatInputLive(
  index: number,
  inputs: PanelState['inputs']
): string {
  switch (index) {
    case 0:
      return `cano ${(inputs.distancia_cano * 100).toFixed(0)}%`
    case 1:
      return `na fenda ${(inputs.altura_passaro * 100).toFixed(0)}%`
    case 2:
      return `queda ${inputs.velocidade.toFixed(2)}`
    default:
      return ''
  }
}
