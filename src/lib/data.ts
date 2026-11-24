import { cacheLife } from 'next/cache'
import { PIPELINE_CATALOG } from '@/pipelines/catalog'
import { listDatasets, listRuns, summarize } from './eval/storage'
import type { Dataset, Run, RunSummary } from './eval/types'

/**
 * Data access for the dashboard. Runs are committed JSON files, so everything
 * is read at build time and cached for the life of the deployment.
 * (In `next dev`, restart the server to pick up new runs.)
 */

export async function getDatasets(): Promise<Dataset[]> {
  'use cache'
  cacheLife('max')
  return listDatasets()
}

export async function getRunSummaries(): Promise<RunSummary[]> {
  'use cache'
  cacheLife('max')
  return listRuns().map(summarize)
}

export async function getAllRuns(): Promise<Run[]> {
  'use cache'
  cacheLife('max')
  return listRuns()
}

export async function getRunById(id: string): Promise<Run | undefined> {
  'use cache'
  cacheLife('max')
  return listRuns().find((r) => r.id === id)
}

/** Pipeline display info. Colours follow the registry order, so a pipeline keeps its colour everywhere. */
export interface PipelineInfo {
  id: string
  name: string
  description: string
  color: string
}

export async function getPipelineInfo(): Promise<Record<string, PipelineInfo>> {
  'use cache'
  cacheLife('max')
  const out: Record<string, PipelineInfo> = {}
  PIPELINE_CATALOG.forEach((p, i) => {
    out[p.id] = { id: p.id, name: p.name, description: p.description, color: `var(--series-${(i % 3) + 1})` }
  })
  // Pipelines that only exist in old run files.
  for (const r of listRuns())
    out[r.pipelineId] ??= { id: r.pipelineId, name: r.pipelineName, description: '', color: 'var(--muted)' }
  return out
}

/**
 * Groups runs into eval sessions: runs from the same `npm run eval` call share a
 * sessionId. Older runs without one fall back to "started within 5 minutes of
 * the previous run". Returns the session start times and a run-id → index map.
 */
export function groupSessions(runs: RunSummary[]): { sessions: string[]; slotOf: Map<string, number> } {
  const sorted = [...runs].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const sessions: string[] = []
  const slotOf = new Map<string, number>()
  let prev: RunSummary | null = null
  for (const r of sorted) {
    const same = prev && (r.sessionId || prev.sessionId ? r.sessionId === prev.sessionId : Date.parse(r.createdAt) - Date.parse(prev.createdAt) < 5 * 60 * 1000)
    if (!same) sessions.push(r.createdAt)
    slotOf.set(r.id, sessions.length - 1)
    prev = r
  }
  return { sessions, slotOf }
}
