'use client'

import { Fragment, useMemo, useState } from 'react'
import type { ExampleResult } from '@/lib/eval/types'
import { ms } from '@/lib/format'
import { RankBadge } from './ui'

type Filter = 'all' | 'wrong' | 'right'

export function ResultsTable({ results, prefixLength }: { results: ExampleResult[]; prefixLength: number }) {
  const [filter, setFilter] = useState<Filter>('wrong')
  const [tag, setTag] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const tags = useMemo(() => [...new Set(results.flatMap((r) => r.tags))].sort(), [results])

  const counts = {
    all: results.length,
    wrong: results.filter((r) => r.rank !== 1).length,
    right: results.filter((r) => r.rank === 1).length,
  }
  const rows = results.filter(
    (r) =>
      (filter === 'all' || (filter === 'right') === (r.rank === 1)) &&
      (tag === 'all' || r.tags.includes(tag)) &&
      (!query || r.input.toLowerCase().includes(query.toLowerCase()) || r.expected.includes(query)),
  )
  const hit = (label: string, expected: string) => label.slice(0, prefixLength) === expected.slice(0, prefixLength)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5 text-[13px]" role="tablist">
          {(['wrong', 'right', 'all'] as const).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 font-medium ${filter === f ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
            >
              {f === 'wrong' ? 'Wrong' : f === 'right' ? 'Correct' : 'All'} <span className="num text-muted">{counts[f]}</span>
            </button>
          ))}
        </div>
        <select
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
          aria-label="Category"
        >
          <option value="all">All categories</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search descriptions or codes"
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink placeholder:text-muted sm:max-w-xs"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[14px]">
          <thead>
            <tr className="border-b border-line text-left text-[12px] text-muted">
              <th className="py-2 pr-3 font-medium">Input</th>
              <th className="py-2 pr-3 font-medium">Expected</th>
              <th className="py-2 pr-3 font-medium">Top prediction</th>
              <th className="py-2 pr-3 font-medium">Result</th>
              <th className="py-2 text-right font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const top = r.predictions[0]
              const isOpen = open === r.id
              return (
                <Fragment key={r.id}>
                  <tr
                    className="cursor-pointer border-b border-line align-top hover:bg-surface-2"
                    onClick={() => setOpen(isOpen ? null : r.id)}
                    aria-expanded={isOpen}
                  >
                    <td className="py-2.5 pr-3">
                      <div className="text-ink">{r.input}</div>
                      <div className="text-[12px] text-muted">
                        {r.id} · {r.tags.join(', ')}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[13px]">{r.expected}</td>
                    <td className="max-w-xs py-2.5 pr-3">
                      {top ? (
                        <>
                          <span className="font-mono text-[13px]">{top.label}</span>
                          <div className="line-clamp-1 text-[12px] text-ink-2">{top.detail}</div>
                        </>
                      ) : (
                        <span className="text-bad">{r.error ?? 'no prediction'}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <RankBadge rank={r.rank} />
                    </td>
                    <td className="num py-2.5 text-right text-ink-2">{ms(r.latencyMs)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-line bg-surface-2">
                      <td colSpan={5} className="px-3 py-3">
                        <div className="mb-1.5 text-[12px] font-medium text-muted">All {r.predictions.length} predictions</div>
                        <ol className="flex flex-col gap-1 text-[13px]">
                          {r.predictions.map((p, i) => (
                            <li key={p.label + i} className="flex items-baseline gap-3">
                              <span className="num w-5 text-right text-muted">{i + 1}</span>
                              <span className={`font-mono ${hit(p.label, r.expected) ? 'font-semibold text-good' : 'text-ink'}`}>
                                {p.label}
                                {hit(p.label, r.expected) && ' ✓'}
                              </span>
                              <span className="flex-1 text-ink-2">{p.detail}</span>
                              <span className="num text-muted">{p.score.toFixed(3)}</span>
                            </li>
                          ))}
                        </ol>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-ink-2">
                  No examples match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
