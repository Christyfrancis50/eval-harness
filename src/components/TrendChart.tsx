'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type MetricKey = 'top1' | 'top3' | 'mrr'

const METRICS: Array<{ key: MetricKey; label: string; format: (v: number) => string }> = [
  { key: 'top1', label: 'Top-1', format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: 'top3', label: 'Top-3', format: (v) => `${(v * 100).toFixed(1)}%` },
  { key: 'mrr', label: 'MRR', format: (v) => v.toFixed(3) },
]

export interface TrendSeries {
  id: string
  name: string
  color: string
  /** slot = index of the eval session (runs started together share a slot). */
  points: Array<{ runId: string; slot: number } & Record<MetricKey, number>>
}

const H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 44 }

/**
 * One line per pipeline across eval sessions. X is session order rather than
 * clock time: sessions are not evenly spaced, so order reads more honestly.
 */
export function TrendChart({ series, sessions }: { series: TrendSeries[]; sessions: string[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const [metricKey, setMetricKey] = useState<MetricKey>('top1')
  const metric = METRICS.find((m) => m.key === metricKey)!
  // Draw in real pixels so text stays 11px whatever the card width.
  const wrap = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(560)
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry!.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { x, y, ticks } = useMemo(() => {
    const values = series.flatMap((s) => s.points.map((p) => p[metricKey]))
    const lo = Math.max(0, Math.floor((Math.min(...values) - 0.05) * 10) / 10)
    const hi = Math.min(1, Math.ceil((Math.max(...values) + 0.05) * 10) / 10)
    const innerW = W - PAD.left - PAD.right
    const innerH = H - PAD.top - PAD.bottom
    const x = (i: number) => PAD.left + (sessions.length === 1 ? innerW / 2 : (i / (sessions.length - 1)) * innerW)
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * innerH
    const ticks: number[] = []
    for (let t = lo; t <= hi + 1e-9; t += hi - lo > 0.4 ? 0.2 : 0.1) ticks.push(Math.round(t * 100) / 100)
    return { x, y, ticks }
  }, [series, sessions, metricKey, W])

  const tickLabel = (t: number) => (metricKey === 'mrr' ? t.toFixed(1) : `${Math.round(t * 100)}%`)

  return (
    <div className="relative" ref={wrap}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-2" aria-label="Legend">
          {series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} />
              {s.name.split(' (')[0]}
            </span>
          ))}
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[12px]" role="tablist" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={m.key === metricKey}
              onClick={() => setMetricKey(m.key)}
              className={`rounded-md px-2.5 py-0.5 font-medium ${m.key === metricKey ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="block touch-none select-none"
        role="img"
        aria-label={`${metric.label} per eval session, by pipeline`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - rect.left) / rect.width) * W
          let best = 0
          sessions.forEach((_, i) => {
            if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i
          })
          setHover(best)
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="num">
              {tickLabel(t)}
            </text>
          </g>
        ))}
        {sessions.map((_, i) => (
          <text key={i} x={x(i)} y={H - 8} fontSize={11} fill="var(--muted)" textAnchor="middle" className="num">
            #{i + 1}
          </text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--axis)" strokeWidth={1} />}
        {series.map((s) => (
          <g key={s.id}>
            <polyline
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.points.map((p) => `${x(p.slot)},${y(p[metricKey])}`).join(' ')}
            />
            {s.points.map((p) => (
              <circle
                key={p.runId}
                cx={x(p.slot)}
                cy={y(p[metricKey])}
                r={hover === p.slot ? 5 : 4}
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-10 z-10 min-w-44 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, transform: x(hover) > W * 0.6 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
        >
          <div className="mb-1 font-medium text-ink">
            Session #{hover + 1} · {metric.label}
          </div>
          {series.map((s) => {
            const p = s.points.find((q) => q.slot === hover)
            if (!p) return null
            return (
              <div key={s.id} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-ink-2">
                  <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                  {s.name.split(' (')[0]}
                </span>
                <span className="num font-medium text-ink">{metric.format(p[metricKey])}</span>
              </div>
            )
          })}
          <div className="mt-1 text-muted">
            {new Date(sessions[hover]!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC
          </div>
        </div>
      )}
    </div>
  )
}
