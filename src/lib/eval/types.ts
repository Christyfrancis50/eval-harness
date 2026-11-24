/**
 * Core types for the evaluation harness.
 *
 * A Dataset is a list of labelled examples. A Pipeline is any system that turns
 * an input into a ranked list of predictions (a search engine, a classifier, an
 * LLM). A Run is one pipeline evaluated against one dataset at one point in time.
 */

/** How a predicted label is compared with the expected label. */
export type Matcher =
  | { type: 'exact' }
  /** Match on the first `length` characters, e.g. HS heading = first 4 digits. */
  | { type: 'prefix'; length: number }

export interface Example {
  id: string
  input: string
  expected: string
  tags?: string[]
}

export interface Dataset {
  id: string
  name: string
  description: string
  matcher: Matcher
  examples: Example[]
}

export interface Prediction {
  label: string
  score: number
  /** Human-readable text for the label (e.g. the HS description). */
  detail?: string
}

export interface Pipeline {
  id: string
  name: string
  description: string
  /** Dataset ids this pipeline can be evaluated on. */
  datasets: string[]
  /** One-off work before the run (load a model, build an index). Not timed. */
  setup?: () => Promise<void>
  /** Return predictions ranked best-first. */
  predict: (input: string) => Promise<Prediction[]>
}

export interface ExampleResult {
  id: string
  input: string
  expected: string
  tags: string[]
  /** Top predictions (truncated to keep run files small). */
  predictions: Prediction[]
  /** 1-based rank of the first correct prediction, or null if none in the list. */
  rank: number | null
  latencyMs: number
  error?: string
}

export interface Metrics {
  n: number
  /** Share of examples whose top prediction is correct (0–1). */
  top1: number
  top3: number
  top5: number
  /** Mean reciprocal rank (0–1). */
  mrr: number
  errors: number
  latencyMeanMs: number
  latencyP95Ms: number
}

export interface Run {
  id: string
  createdAt: string
  /** Runs started by the same `npm run eval` call share a session id. */
  sessionId?: string
  datasetId: string
  /** Short hash of the dataset contents, so runs on different test sets are not compared by mistake. */
  datasetHash: string
  pipelineId: string
  pipelineName: string
  gitSha: string | null
  metrics: Metrics
  byTag: Record<string, { n: number; top1: number }>
  results: ExampleResult[]
}

/** A run without per-example results, for lists and charts. */
export type RunSummary = Omit<Run, 'results'>
