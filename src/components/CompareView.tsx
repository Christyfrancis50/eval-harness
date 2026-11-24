'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { diffRuns, type ChangeKind } from '@/lib/eval/compare'
import type { Run } from '@/lib/eval/types'
import type { PipelineInfo } from '@/lib/data'
import { ms, pct, pts, shortDate } from '@/lib/format'
import { Card, Delta, PipelineDot, RankBadge } from './ui'

const SECTIONS: Array<{ kind: ChangeKind; title: string; blurb: string }> = [
  { kind: 'regressed', title: 'Regressed', blurb: 'A had the right answer first; B does not.' },
  { kind: 'fixed', title: 'Fixed', blurb: 'B has the right answer first; A did not.' },
  { kind: 'moved', title: 'Wrong in both, rank changed', blurb: 'Neither gets it first, but the right answer moved.' },
  { kind: 'still-wrong', title: 'Wrong in both', blurb: 'Same miss in both runs.' },
]

export function CompareView({ runs, pipelines }: { runs: Run[]; pipelines: Record<string, PipelineInfo> }) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Defaults: the weakest and the strongest latest runs, so the page opens on an interesting diff.
  const latest = new Map<string, Run>()
  for (const r of runs) latest.set(r.pipelineId, r)
  const ranked = [...latest.values()].sort((a, b) => a.metrics.top1 - b.metrics.top1)
  const a = runs.find((r) => r.id === params.get('a')) ?? ranked[0]
  const b = runs.find((r) => r.id === params.get('b')) ?? ranked.at(-1)

  const set = (key: 'a' | 'b', id: string) => {
    const next = new URLSearchParams(params)
    next.set(key, id)
    if (!next.get(key === 'a' ? 'b' : 'a') && (key === 'a' ? b : a)) next.set(key === 'a' ? 'b' : 'a', (key === 'a' ? b : a)!.id)
    router.replace(`${pathname}?${next}`, { scroll: false })
  }

  if (!a || !b) return <p className="text-ink-2">Need at least one run to compare.</p>
  const sameSet = a.datasetHash === b.datasetHash
  const changes = diffRuns(a, b)
  const count = (k: ChangeKind) => changes.filter((c) => c.kind === k).length

  const picker = (which: 'a' | 'b', run: Run) => (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-[12px] font-medium uppercase tracking-wide text-muted">Run {which.toUpperCase()}</span>
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
        <PipelineDot color={pipelines[run.pipelineId]?.color ?? 'var(--muted)'} />
        <select
          value={run.id}
          onChange={(e) => set(which, e.target.value)}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
        >
          {[...runs].reverse().map((r) => (
            <option key={r.id} value={r.id}>
              {r.pipelineName} — {shortDate(r.createdAt)} — {pct(r.metrics.top1)}
            </option>
          ))}
        </select>
      </div>
    </label>
  )

  const rows: Array<[string, (r: Run) => string, number, boolean]> = [
    ['Top-1 accuracy', (r) => pct(r.metrics.top1), b.metrics.top1 - a.metrics.top1, false],
    ['Top-3 accuracy', (r) => pct(r.metrics.top3), b.metrics.top3 - a.metrics.top3, false],
    ['MRR', (r) => r.metrics.mrr.toFixed(3), b.metrics.mrr - a.metrics.mrr, false],
    ['p95 latency', (r) => ms(r.metrics.latencyP95Ms), b.metrics.latencyP95Ms - a.metrics.latencyP95Ms, true],
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        {picker('a', a)}
        {picker('b', b)}
      </div>
      {!sameSet && (
        <p className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
          ⚠ These runs used different versions of the test set, so only shared examples are compared.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card title="Metrics">
          <table className="num w-full text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 font-medium">Metric</th>
                <th className="py-2 text-right font-medium">A</th>
                <th className="py-2 text-right font-medium">B</th>
                <th className="py-2 pl-3 font-medium">B vs A</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, f, d, invert]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="py-2.5 text-ink-2">{label}</td>
                  <td className="py-2.5 text-right">{f(a)}</td>
                  <td className="py-2.5 text-right font-medium">{f(b)}</td>
                  <td className="py-2.5 pl-3">
                    <Delta value={d} invert={invert} format={label === 'p95 latency' ? (x) => `${x > 0 ? '+' : '−'}${ms(Math.abs(x))}` : label === 'MRR' ? (x) => `${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(3)}` : pts} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="What changed" subtitle={`${changes.length} shared examples, judged on the first prediction.`}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['fixed', 'Fixed', 'text-good'],
                ['regressed', 'Regressed', 'text-bad'],
                ['still-right', 'Right in both', 'text-ink'],
                ['still-wrong', 'Wrong in both', 'text-ink'],
              ] as const
            ).map(([k, label, cls]) => (
              <div key={k} className="rounded-lg bg-surface-2 p-3">
                <div className={`num text-2xl font-semibold ${cls}`}>{k === 'still-wrong' ? count('still-wrong') + count('moved') : count(k)}</div>
                <div className="text-[13px] text-ink-2">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-2">
            Net: B gets {count('fixed') - count('regressed') >= 0 ? `${count('fixed') - count('regressed')} more` : `${count('regressed') - count('fixed')} fewer`} examples right
            than A.
          </p>
        </Card>
      </div>

      {SECTIONS.map(({ kind, title, blurb }) => {
        const list = changes.filter((c) => c.kind === kind)
        if (list.length === 0) return null
        return (
          <Card key={kind} title={`${title} (${list.length})`} subtitle={blurb}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[14px]">
                <thead>
                  <tr className="border-b border-line text-left text-[12px] text-muted">
                    <th className="py-2 pr-3 font-medium">Input</th>
                    <th className="py-2 pr-3 font-medium">Expected</th>
                    <th className="py-2 pr-3 font-medium">A says</th>
                    <th className="py-2 font-medium">B says</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="border-b border-line align-top last:border-0">
                      <td className="py-2.5 pr-3 text-ink">{c.input}</td>
                      <td className="py-2.5 pr-3 font-mono text-[13px]">{c.expected}</td>
                      {[c.before, c.after].map((r, i) => (
                        <td key={i} className="max-w-64 py-2.5 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px]">{r.predictions[0]?.label ?? '—'}</span>
                            <RankBadge rank={r.rank} />
                          </div>
                          <div className="line-clamp-1 text-[12px] text-ink-2">{r.predictions[0]?.detail}</div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
