import {
  distStatus,
  heightStatus,
  MetricBar,
  velStatus,
} from '@/components/panel/MetricBar'
import type { InputMode } from '@/lib/nn-config'
import type { PanelInputs } from '@/lib/panel-types'

type SenseRow = {
  label: string
  value: number
  displayValue?: number
  status: string
  danger?: boolean
}

function buildSenseRows(inputs: PanelInputs, inputMode: InputMode): SenseRow[] {
  const rows: SenseRow[] = [
    {
      label: 'Cano',
      value: inputs.distancia_cano,
      status: distStatus(inputs.distancia_cano),
      danger: inputs.distancia_cano < 0.25,
    },
    {
      label: 'Abertura',
      value: inputs.altura_passaro,
      status: heightStatus(inputs.altura_passaro),
      danger:
        inputs.altura_passaro < 0.2 || inputs.altura_passaro > 0.8,
    },
    {
      label: 'Queda',
      value: (inputs.velocidade + 1) / 2,
      displayValue: (inputs.velocidade + 1) / 2,
      status: velStatus(inputs.velocidade),
      danger: inputs.velocidade > 0.5,
    },
  ]

  if (inputMode === 'extended') {
    const d2 = inputs.distancia_segundo ?? 1
    const a2 = inputs.altura_segundo ?? 0.5
    rows.push(
      {
        label: 'Cano+1',
        value: d2,
        status: distStatus(d2),
        danger: d2 < 0.25,
      },
      {
        label: 'Fenda+1',
        value: a2,
        status: heightStatus(a2),
        danger: a2 < 0.2 || a2 > 0.8,
      }
    )
  }

  return rows
}

type AiSensesBlockProps = {
  inputs: PanelInputs
  inputMode: InputMode
  inputSize: number
}

export function AiSensesBlock({
  inputs,
  inputMode,
  inputSize,
}: AiSensesBlockProps) {
  const rows = buildSenseRows(inputs, inputMode)

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-muted-foreground">
        {inputSize} sentido{inputSize === 1 ? '' : 's'} na rede
        {inputMode === 'extended' && ' · inclui o próximo cano'}
      </p>
      {rows.map((row) => (
        <MetricBar
          key={row.label}
          label={row.label}
          value={row.value}
          displayValue={row.displayValue}
          status={row.status}
          danger={row.danger}
        />
      ))}
    </div>
  )
}
