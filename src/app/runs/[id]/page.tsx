import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ResultsTable } from '@/components/ResultsTable'
import { Card, Delta, PipelineDot, StatTile } from '@/components/ui'
import { getDatasets, getPipelineInfo, getRunById, getRunSummaries } from '@/lib/data'
import { ms, pct, shortDate } from '@/lib/format'

export async function generateStaticParams() {
  return (await getRunSummaries()).map((r) => ({ id: r.id }))
}

export async function generateMetadata(props: PageProps<'/runs/[id]'>): Promise<Metadata> {
  const run = await getRunById((await props.params).id)
  return { title: run ? `${run.pipelineName} · ${shortDate(run.createdAt)}` : 'Run not found' }
}

export default function RunPage(props: PageProps<'/runs/[id]'>) {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-[13px] text-ink-2 hover:text-ink">
        ← Overview
      </Link>
      <Suspense fallback={<div className="card h-64 animate-pulse" />}>
        <RunDetail params={props.params} />
      </Suspense>
    </div>
  )
}

async function RunDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [run, summaries, pipelines, datasets] = await Promise.all([getRunById(id), getRunSummaries(), getPipelineInfo(), getDatasets()])
  if (!run) notFound()

  const dataset = datasets.find((d) => d.id === run.datasetId)
  const same = summaries.filter((r) => r.pipelineId === run.pipelineId && r.datasetId === run.datasetId)
  const prev = same[same.findIndex((r) => r.id === run.id) - 1]
  const m = run.metrics
  const prefixLength = dataset?.matcher.type === 'prefix' ? dataset.matcher.length : 99

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
          <PipelineDot color={pipelines[run.pipelineId]?.color ?? 'var(--muted)'} />
          {run.pipelineName}
        </h1>
        <p className="num mt-1 text-[14px] text-ink-2">
          {shortDate(run.createdAt)} · {dataset?.name ?? run.datasetId} · test set {run.datasetHash}
          {run.gitSha && <> · commit <span className="font-mono">{run.gitSha}</span></>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Top-1 accuracy" value={pct(m.top1)} note={<Delta value={prev ? m.top1 - prev.metrics.top1 : null} />} />
        <StatTile label="Top-3 accuracy" value={pct(m.top3)} note={`top-5 ${pct(m.top5)}`} />
        <StatTile label="MRR" value={m.mrr.toFixed(3)} note={`${m.n} examples, ${m.errors} errors`} />
        <StatTile label="p95 latency" value={ms(m.latencyP95Ms)} note={`mean ${ms(m.latencyMeanMs)}`} />
      </div>

      <Card
        title="Examples"
        subtitle="Click a row to see every prediction. Correct means the first prediction falls under the expected heading."
        action={
          prev && (
            <Link href={`/compare?a=${prev.id}&b=${run.id}`} className="text-[13px] font-medium text-accent hover:underline">
              Compare with previous run →
            </Link>
          )
        }
      >
        <ResultsTable results={run.results} prefixLength={prefixLength} />
      </Card>
    </div>
  )
}
