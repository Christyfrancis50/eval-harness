import type { ExampleResult, Matcher, Metrics, Prediction } from './types'

export function isMatch(matcher: Matcher, predicted: string, expected: string): boolean {
  if (matcher.type === 'exact') return predicted === expected
  const n = matcher.length
  return predicted.length >= n && expected.length >= n && predicted.slice(0, n) === expected.slice(0, n)
}

/** 1-based rank of the first correct prediction, or null. */
export function rankOf(matcher: Matcher, predictions: Prediction[], expected: string): number | null {
  const i = predictions.findIndex((p) => isMatch(matcher, p.label, expected))
  return i === -1 ? null : i + 1
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  // Nearest-rank method.
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]!
}

const round = (x: number, digits = 4) => Math.round(x * 10 ** digits) / 10 ** digits

export function computeMetrics(results: ExampleResult[]): Metrics {
  const n = results.length
  if (n === 0) return { n: 0, top1: 0, top3: 0, top5: 0, mrr: 0, errors: 0, latencyMeanMs: 0, latencyP95Ms: 0 }
  const within = (k: number) => results.filter((r) => r.rank !== null && r.rank <= k).length / n
  const mrr = results.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / n
  const latencies = results.map((r) => r.latencyMs)
  return {
    n,
    top1: round(within(1)),
    top3: round(within(3)),
    top5: round(within(5)),
    mrr: round(mrr),
    errors: results.filter((r) => r.error).length,
    latencyMeanMs: round(latencies.reduce((a, b) => a + b, 0) / n, 1),
    latencyP95Ms: round(percentile(latencies, 95), 1),
  }
}

export function metricsByTag(results: ExampleResult[]): Record<string, { n: number; top1: number }> {
  const groups = new Map<string, ExampleResult[]>()
  for (const r of results) for (const t of r.tags) groups.set(t, [...(groups.get(t) ?? []), r])
  return Object.fromEntries(
    [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, rs]) => [tag, { n: rs.length, top1: round(rs.filter((r) => r.rank === 1).length / rs.length) }]),
  )
}
