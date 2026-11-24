import type { ReactNode } from 'react'
import { pts } from '@/lib/format'

export function Card({ title, subtitle, action, children, className = '' }: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function StatTile({ label, value, note, hero = false }: { label: string; value: ReactNode; note?: ReactNode; hero?: boolean }) {
  return (
    <div className="card flex flex-col justify-between gap-2 p-4">
      <div className="text-[13px] text-ink-2">{label}</div>
      <div className={hero ? 'text-5xl font-semibold tracking-tight text-ink' : 'text-3xl font-semibold tracking-tight text-ink'}>{value}</div>
      {note && <div className="text-[13px] text-muted">{note}</div>}
    </div>
  )
}

export function PipelineDot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />
}

/** A ratio against 100 %, drawn as a thin bar on a same-hue track. */
export function Meter({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2" title={label}>
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-grid">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
      </div>
    </div>
  )
}

/** Change in a "higher is better" ratio. Icon + sign + text, so colour is never the only cue. */
export function Delta({ value, invert = false, format = pts }: { value: number | null; invert?: boolean; format?: (x: number) => string }) {
  if (value === null) return <span className="whitespace-nowrap text-[13px] text-muted">first run</span>
  const good = invert ? value < 0 : value > 0
  const flat = Math.abs(value) < 1e-9
  if (flat) return <span className="num text-[13px] text-muted">no change</span>
  return (
    <span className={`num inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[13px] font-medium ${good ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad'}`}>
      <span aria-hidden>{value > 0 ? '▲' : '▼'}</span>
      {format(value)}
    </span>
  )
}

export function RankBadge({ rank }: { rank: number | null }) {
  if (rank === 1)
    return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-good-soft px-1.5 py-0.5 text-[12px] font-medium text-good">✓ correct</span>
  if (rank === null)
    return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-bad-soft px-1.5 py-0.5 text-[12px] font-medium text-bad">✗ not in top 5</span>
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px] font-medium text-ink-2">✗ found at #{rank}</span>
}
