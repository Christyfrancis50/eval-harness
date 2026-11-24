import type { RunSummary } from '@/lib/eval/types'
import type { PipelineInfo } from '@/lib/data'
import { PipelineDot } from './ui'

/** Six-step sequential blue ramp; darker = more accurate. */
function cellStyle(v: number) {
  const step = Math.min(6, Math.max(1, Math.ceil(v * 6)))
  return { background: `var(--seq-${step})`, color: step >= 4 ? '#ffffff' : 'var(--ink)' }
}

/** Top-1 accuracy per category (rows) and pipeline (columns). Values are printed, so it doubles as the table view. */
export function TagHeatmap({ runs, pipelines }: { runs: RunSummary[]; pipelines: Record<string, PipelineInfo> }) {
  const tags = [...new Set(runs.flatMap((r) => Object.keys(r.byTag)))].sort()
  return (
    <div className="overflow-x-auto">
      <table className="num w-full border-separate border-spacing-[2px] text-[13px]">
        <thead>
          <tr>
            <th className="px-2 py-1.5 text-left font-medium text-muted">Category</th>
            {runs.map((r) => (
              <th key={r.id} className="px-2 py-1.5 text-center font-medium text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <PipelineDot color={pipelines[r.pipelineId]?.color ?? 'var(--muted)'} />
                  {(pipelines[r.pipelineId]?.name ?? r.pipelineName).split(' (')[0]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tags.map((tag) => (
            <tr key={tag}>
              <th className="px-2 py-1.5 text-left font-normal text-ink">
                {tag} <span className="text-muted">· {runs[0]?.byTag[tag]?.n ?? 0}</span>
              </th>
              {runs.map((r) => {
                const cell = r.byTag[tag]
                if (!cell) return <td key={r.id} className="rounded-md bg-surface-2 text-center text-muted">—</td>
                const correct = Math.round(cell.top1 * cell.n)
                return (
                  <td
                    key={r.id}
                    className="rounded-md px-2 py-1.5 text-center font-medium"
                    style={cellStyle(cell.top1)}
                    title={`${r.pipelineName} · ${tag}: ${correct} of ${cell.n} correct`}
                  >
                    {Math.round(cell.top1 * 100)}%
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
