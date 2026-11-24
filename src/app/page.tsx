import Link from 'next/link'
import { TagHeatmap } from '@/components/TagHeatmap'
import { TrendChart, type TrendSeries } from '@/components/TrendChart'
import { Card, Delta, Meter, PipelineDot, StatTile } from '@/components/ui'
import { getAllRuns, getDatasets, getPipelineInfo, getRunSummaries, groupSessions } from '@/lib/data'
import { latestByPipeline } from '@/lib/eval/storage'
import { ms, pct, shortDate } from '@/lib/format'

export default async function Overview() {
  const [datasets, summaries, allRuns, pipelines] = await Promise.all([getDatasets(), getRunSummaries(), getAllRuns(), getPipelineInfo()])
  const dataset = datasets[0]

  if (!dataset || summaries.length === 0) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-semibold">No runs yet</h1>
        <p className="mt-2 text-ink-2">
          Run <code className="font-mono">npm run eval</code> to evaluate the pipelines, then reload.
        </p>
      </div>
    )
  }

  const runs = summaries.filter((r) => r.datasetId === dataset.id)
  const latestFull = latestByPipeline(allRuns, dataset.id)
  const latest = latestFull.map((r) => runs.find((s) => s.id === r.id)!)
  const order = Object.keys(pipelines)
  latest.sort((a, b) => order.indexOf(a.pipelineId) - order.indexOf(b.pipelineId))
  const best = [...latest].sort((a, b) => b.metrics.top1 - a.metrics.top1)[0]!
  const prev = (id: string, pipelineId: string) => {
    const same = runs.filter((r) => r.pipelineId === pipelineId)
    const i = same.findIndex((r) => r.id === id)
    return i > 0 ? same[i - 1]! : null
  }

  const { sessions, slotOf } = groupSessions(runs)
  const series: TrendSeries[] = latest.map((l) => ({
    id: l.pipelineId,
    name: pipelines[l.pipelineId]?.name ?? l.pipelineName,
    color: pipelines[l.pipelineId]?.color ?? 'var(--muted)',
    points: runs
      .filter((r) => r.pipelineId === l.pipelineId)
      .map((r) => ({ runId: r.id, slot: slotOf.get(r.id)!, top1: r.metrics.top1, top3: r.metrics.top3, mrr: r.metrics.mrr })),
  }))

  // Examples that no pipeline gets right: the hardest cases in the test set.
  const unsolved = dataset.examples.filter((ex) => latestFull.every((r) => r.results.find((x) => x.id === ex.id)?.rank !== 1))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-medium uppercase tracking-wide text-accent">Dataset · {dataset.id}</div>
        <h1 className="text-3xl font-semibold tracking-tight text-balance">{dataset.name}</h1>
        <p className="max-w-3xl text-[15px] text-ink-2 text-pretty">{dataset.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <StatTile
            hero
            label="Best top-1 accuracy"
            value={pct(best.metrics.top1)}
            note={
              <span className="inline-flex items-center gap-1.5">
                <PipelineDot color={pipelines[best.pipelineId]?.color ?? 'var(--muted)'} />
                {best.pipelineName}
              </span>
            }
          />
        </div>
        <StatTile label="Best top-3 accuracy" value={pct(Math.max(...latest.map((r) => r.metrics.top3)))} note="right answer in the first three" />
        <StatTile label="Test examples" value={dataset.examples.length} note={`${Object.keys(best.byTag).length} categories`} />
        <div className="col-span-2 lg:col-span-1">
          <StatTile label="Runs recorded" value={runs.length} note={`latest ${shortDate(runs.at(-1)!.createdAt)}`} />
        </div>
      </div>

      <Card title="Leaderboard" subtitle="Latest run of each pipeline. Change is against that pipeline's previous run.">
        <div className="overflow-x-auto">
          <table className="num w-full min-w-[720px] text-[14px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="py-2 pr-3 font-medium">Pipeline</th>
                <th className="w-44 py-2 pr-3 font-medium">Top-1</th>
                <th className="w-44 py-2 pr-3 font-medium">Top-3</th>
                <th className="py-2 pr-3 text-right font-medium">MRR</th>
                <th className="whitespace-nowrap py-2 pr-3 text-right font-medium">p95 latency</th>
                <th className="py-2 pr-3 font-medium">Change</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {latest.map((r) => {
                const p = prev(r.id, r.pipelineId)
                const color = pipelines[r.pipelineId]?.color ?? 'var(--muted)'
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="min-w-60 py-3 pr-3">
                      <div className="flex items-center gap-2 font-medium text-ink">
                        <PipelineDot color={color} />
                        {r.pipelineName}
                      </div>
                      <div className="mt-0.5 max-w-sm pl-4.5 text-[12px] text-muted">{pipelines[r.pipelineId]?.description}</div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-12 font-medium">{pct(r.metrics.top1)}</span>
                        <Meter value={r.metrics.top1} color={color} label={`Top-1 ${pct(r.metrics.top1)}`} />
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="w-12">{pct(r.metrics.top3)}</span>
                        <Meter value={r.metrics.top3} color={color} label={`Top-3 ${pct(r.metrics.top3)}`} />
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-right">{r.metrics.mrr.toFixed(3)}</td>
                    <td className="py-3 pr-3 text-right">{ms(r.metrics.latencyP95Ms)}</td>
                    <td className="py-3 pr-3">
                      {p ? (
                        <div className="grid grid-cols-[auto_auto] items-center justify-start gap-x-2 gap-y-1 whitespace-nowrap text-[12px] text-muted">
                          top-1 <Delta value={r.metrics.top1 - p.metrics.top1} />
                          top-3 <Delta value={r.metrics.top3 - p.metrics.top3} />
                        </div>
                      ) : (
                        <Delta value={null} />
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Link href={`/runs/${r.id}`} className="whitespace-nowrap text-[13px] font-medium text-accent hover:underline">
                        Examples →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Accuracy by category" subtitle="Top-1 accuracy of the latest runs. The number after each category is its example count.">
          <TagHeatmap runs={latest} pipelines={pipelines} />
        </Card>
        <Card title="Quality over time" subtitle="One point per eval session. Hover for values.">
          {sessions.length > 1 ? (
            <TrendChart series={series} sessions={sessions} />
          ) : (
            <div className="grid h-48 place-items-center rounded-lg bg-surface-2 px-6 text-center text-[14px] text-ink-2">
              <p>
                Only one eval session so far. Change a pipeline or the test set, run <code className="font-mono">npm run eval</code> again and
                the trend appears here.
              </p>
            </div>
          )}
        </Card>
      </div>

      <Card
        title={`Unsolved by every pipeline (${unsolved.length})`}
        subtitle="No pipeline puts the right heading first. These are the cases to look at next."
      >
        {unsolved.length === 0 ? (
          <p className="text-[14px] text-ink-2">Every example is solved by at least one pipeline.</p>
        ) : (
          <ul className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-2">
            {unsolved.map((ex) => (
              <li key={ex.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
                <span className="text-ink">{ex.input}</span>
                <span className="num shrink-0 font-mono text-[12px] text-muted">{ex.expected}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card title="Run history">
          <div className="max-h-80 overflow-y-auto">
            <table className="num w-full text-[13px]">
              <thead className="sticky top-0 bg-surface">
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="py-2 pr-3 font-medium">When</th>
                  <th className="py-2 pr-3 font-medium">Pipeline</th>
                  <th className="py-2 pr-3 text-right font-medium">Top-1</th>
                  <th className="py-2 pr-3 font-medium">Commit</th>
                </tr>
              </thead>
              <tbody>
                {[...runs].reverse().map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 text-ink-2">
                      <Link href={`/runs/${r.id}`} className="hover:text-accent hover:underline">
                        {shortDate(r.createdAt)}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center gap-1.5">
                        <PipelineDot color={pipelines[r.pipelineId]?.color ?? 'var(--muted)'} />
                        {r.pipelineName}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right font-medium">{pct(r.metrics.top1)}</td>
                    <td className="py-2 pr-3 font-mono text-muted">{r.gitSha ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="How to read this">
          <dl className="flex flex-col gap-3 text-[14px]">
            <div>
              <dt className="font-medium text-ink">Top-1 accuracy</dt>
              <dd className="text-ink-2">How often the first suggestion is right. This is what a user sees.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">Top-3 accuracy</dt>
              <dd className="text-ink-2">How often the right answer is somewhere in the first three suggestions.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">MRR (mean reciprocal rank)</dt>
              <dd className="text-ink-2">1 if the answer is always first, 0.5 if always second, 0 if never found. Rewards getting close.</dd>
            </div>
            <div>
              <dt className="font-medium text-ink">p95 latency</dt>
              <dd className="text-ink-2">95% of queries answer faster than this, measured on the machine that ran the eval.</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  )
}
