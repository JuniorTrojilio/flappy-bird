import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

type HistoryChartProps = {
  serie: number[]
  golden?: boolean
  className?: string
}

export function HistoryChart({ serie, golden, className }: HistoryChartProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const draw = () => {
      const w = Math.max(wrap.clientWidth, 120)
      const h = Math.max(wrap.clientHeight, 48)
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.clearRect(0, 0, w, h)

      if (serie.length === 0) {
        ctx.fillStyle = '#64748b'
        ctx.font = '10px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('pontuação ao vivo…', w / 2, h / 2)
        return
      }

      const max = Math.max(...serie, 1)
      const pad = 6

      if (serie.length === 1) {
        const x = w / 2
        const y = h - pad - (serie[0] / max) * (h - pad * 2)
        ctx.fillStyle = golden ? '#fbbf24' : '#3b82f6'
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#94a3b8'
        ctx.font = '9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText(String(serie[0]), x, Math.min(y - 8, h - 4))
        return
      }

      ctx.strokeStyle = golden ? '#fbbf24' : '#3b82f6'
      ctx.lineWidth = 2
      ctx.beginPath()
      serie.forEach((v, i) => {
        const x = (i / (serie.length - 1)) * (w - pad * 2) + pad
        const y = h - pad - (v / max) * (h - pad * 2)
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      const last = serie[serie.length - 1]
      const lx = w - pad
      const ly = h - pad - (last / max) * (h - pad * 2)
      ctx.fillStyle = golden ? '#fbbf24' : '#60a5fa'
      ctx.beginPath()
      ctx.arc(lx, ly, 4, 0, Math.PI * 2)
      ctx.fill()
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [serie, golden])

  return (
    <div ref={wrapRef} className={cn('h-full w-full', className)}>
      <canvas ref={ref} className="block h-full w-full" />
    </div>
  )
}
