import { createHash } from 'node:crypto'
import { computeMetrics, metricsByTag, rankOf } from './metrics'
import type { Dataset, ExampleResult, Pipeline, Run } from './types'

const KEEP_PREDICTIONS = 5

export function datasetHash(dataset: Dataset): string {
  const body = JSON.stringify({ matcher: dataset.matcher, examples: dataset.examples })
  return createHash('sha256').update(body).digest('hex').slice(0, 10)
}

function runId(pipelineId: string, at: Date): string {
  const stamp = at.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
  return `${stamp}-${pipelineId}`
}

export interface RunOptions {
  gitSha?: string | null
  sessionId?: string
  onProgress?: (done: number, total: number) => void
}

/**
 * Evaluates one pipeline on one dataset. Examples run one at a time so the
 * latency numbers are not distorted by contention.
 */
export async function runEval(pipeline: Pipeline, dataset: Dataset, opts: RunOptions = {}): Promise<Run> {
  await pipeline.setup?.()
  const results: ExampleResult[] = []
  for (const [i, ex] of dataset.examples.entries()) {
    const t0 = performance.now()
    let predictions: ExampleResult['predictions'] = []
    let error: string | undefined
    try {
      predictions = (await pipeline.predict(ex.input)).slice(0, KEEP_PREDICTIONS)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    }
    const latencyMs = Math.round((performance.now() - t0) * 10) / 10
    results.push({
      id: ex.id,
      input: ex.input,
      expected: ex.expected,
      tags: ex.tags ?? [],
      predictions,
      rank: rankOf(dataset.matcher, predictions, ex.expected),
      latencyMs,
      ...(error ? { error } : {}),
    })
    opts.onProgress?.(i + 1, dataset.examples.length)
  }
  const createdAt = new Date()
  return {
    id: runId(pipeline.id, createdAt),
    createdAt: createdAt.toISOString(),
    ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    datasetId: dataset.id,
    datasetHash: datasetHash(dataset),
    pipelineId: pipeline.id,
    pipelineName: pipeline.name,
    gitSha: opts.gitSha ?? null,
    metrics: computeMetrics(results),
    byTag: metricsByTag(results),
    results,
  }
}
