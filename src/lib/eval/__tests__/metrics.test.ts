import { describe, expect, it } from 'vitest'
import { diffRuns } from '../compare'
import { computeMetrics, isMatch, metricsByTag, percentile, rankOf } from '../metrics'
import type { ExampleResult, Run } from '../types'

const r = (id: string, rank: number | null, latencyMs = 10, tags = ['a']): ExampleResult => ({
  id, input: id, expected: '0101', tags, predictions: [], rank, latencyMs,
})

describe('matching', () => {
  it('prefix matcher compares the first n characters', () => {
    expect(isMatch({ type: 'prefix', length: 4 }, '610910', '6109')).toBe(true)
    expect(isMatch({ type: 'prefix', length: 4 }, '610610', '6109')).toBe(false)
    expect(isMatch({ type: 'exact' }, '610910', '6109')).toBe(false)
  })
  it('rankOf returns the 1-based rank of the first correct prediction', () => {
    const preds = ['8481', '8413', '8413'].map((label) => ({ label, score: 0 }))
    expect(rankOf({ type: 'exact' }, preds, '8413')).toBe(2)
    expect(rankOf({ type: 'exact' }, preds, '9999')).toBeNull()
  })
})

describe('metrics', () => {
  it('computes top-k accuracy and MRR', () => {
    const m = computeMetrics([r('1', 1), r('2', 2), r('3', 4), r('4', null)])
    expect(m.top1).toBe(0.25)
    expect(m.top3).toBe(0.5)
    expect(m.top5).toBe(0.75)
    expect(m.mrr).toBeCloseTo((1 + 0.5 + 0.25) / 4, 4)
  })
  it('uses nearest-rank percentiles', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10)
    expect(percentile([5], 95)).toBe(5)
    expect(percentile([], 95)).toBe(0)
  })
  it('groups top-1 accuracy by tag', () => {
    expect(metricsByTag([r('1', 1, 1, ['x']), r('2', 2, 1, ['x']), r('3', 1, 1, ['y'])])).toEqual({
      x: { n: 2, top1: 0.5 },
      y: { n: 1, top1: 1 },
    })
  })
})

describe('diffRuns', () => {
  const run = (results: ExampleResult[]) => ({ results }) as Run
  it('classifies fixed, regressed and unchanged examples', () => {
    const before = run([r('a', 2), r('b', 1), r('c', null), r('d', 1)])
    const after = run([r('a', 1), r('b', 3), r('c', 4), r('d', 1)])
    expect(Object.fromEntries(diffRuns(before, after).map((c) => [c.id, c.kind]))).toEqual({
      a: 'fixed', b: 'regressed', c: 'moved', d: 'still-right',
    })
  })
})
