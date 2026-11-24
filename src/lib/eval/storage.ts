import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Dataset, Run, RunSummary } from './types'

/**
 * Datasets live in evals/datasets/<id>/dataset.json and runs in runs/<id>.json.
 * Runs are plain JSON files committed to git, so the history travels with the
 * code and the dashboard can be built statically.
 */
const ROOT = process.cwd()
export const DATASETS_DIR = join(ROOT, 'evals', 'datasets')
export const RUNS_DIR = join(ROOT, 'runs')

export function listDatasets(): Dataset[] {
  if (!existsSync(DATASETS_DIR)) return []
  return readdirSync(DATASETS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(DATASETS_DIR, d.name, 'dataset.json')))
    .map((d) => loadDataset(d.name))
}

export function loadDataset(id: string): Dataset {
  const file = join(DATASETS_DIR, id, 'dataset.json')
  if (!existsSync(file)) throw new Error(`Unknown dataset "${id}" (expected ${file})`)
  return JSON.parse(readFileSync(file, 'utf8')) as Dataset
}

export function saveRun(run: Run): string {
  mkdirSync(RUNS_DIR, { recursive: true })
  const file = join(RUNS_DIR, `${run.id}.json`)
  writeFileSync(file, JSON.stringify(run, null, 1) + '\n')
  return file
}

/** All runs, oldest first. */
export function listRuns(): Run[] {
  if (!existsSync(RUNS_DIR)) return []
  return readdirSync(RUNS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(RUNS_DIR, f), 'utf8')) as Run)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function getRun(id: string): Run | undefined {
  const file = join(RUNS_DIR, `${id}.json`)
  if (!/^[\w-]+$/.test(id) || !existsSync(file)) return undefined
  return JSON.parse(readFileSync(file, 'utf8')) as Run
}

export function summarize(run: Run): RunSummary {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { results, ...rest } = run
  return rest
}

/** Latest run per pipeline for a dataset, in pipeline-id order. */
export function latestByPipeline(runs: Run[], datasetId: string): Run[] {
  const latest = new Map<string, Run>()
  for (const r of runs) if (r.datasetId === datasetId) latest.set(r.pipelineId, r)
  return [...latest.values()].sort((a, b) => a.pipelineId.localeCompare(b.pipelineId))
}

/** The run before `run` for the same pipeline and dataset, if any. */
export function previousRun(runs: Run[], run: Run): Run | undefined {
  const same = runs.filter((r) => r.pipelineId === run.pipelineId && r.datasetId === run.datasetId)
  const i = same.findIndex((r) => r.id === run.id)
  return i > 0 ? same[i - 1] : undefined
}
