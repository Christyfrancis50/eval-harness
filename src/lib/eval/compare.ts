import type { ExampleResult, Metrics, Run } from './types'

export type ChangeKind = 'fixed' | 'regressed' | 'still-wrong' | 'still-right' | 'moved'

export interface ExampleChange {
  id: string
  input: string
  expected: string
  kind: ChangeKind
  before: ExampleResult
  after: ExampleResult
}

/**
 * Example-level diff between two runs on the same dataset.
 * "Correct" means the top prediction is right (rank 1).
 */
export function diffRuns(before: Run, after: Run): ExampleChange[] {
  const prev = new Map(before.results.map((r) => [r.id, r]))
  const changes: ExampleChange[] = []
  for (const a of after.results) {
    const b = prev.get(a.id)
    if (!b) continue
    const wasRight = b.rank === 1
    const isRight = a.rank === 1
    let kind: ChangeKind
    if (!wasRight && isRight) kind = 'fixed'
    else if (wasRight && !isRight) kind = 'regressed'
    else if (isRight) kind = 'still-right'
    else kind = b.rank === a.rank ? 'still-wrong' : 'moved'
    changes.push({ id: a.id, input: a.input, expected: a.expected, kind, before: b, after: a })
  }
  return changes
}

export function metricDeltas(before: Metrics, after: Metrics) {
  return {
    top1: after.top1 - before.top1,
    top3: after.top3 - before.top3,
    mrr: after.mrr - before.mrr,
    latencyP95Ms: after.latencyP95Ms - before.latencyP95Ms,
  }
}
