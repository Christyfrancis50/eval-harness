import type { Pipeline } from '../lib/eval/types'
import { hsHybrid, hsKeyword, hsSemantic } from './hs'

/**
 * Every pipeline the CLI can run. To evaluate your own system, implement the
 * Pipeline interface (an id, the datasets it supports and a predict function)
 * and add it here.
 */
export const PIPELINES: Pipeline[] = [hsKeyword, hsSemantic, hsHybrid]

export function getPipeline(id: string): Pipeline | undefined {
  return PIPELINES.find((p) => p.id === id)
}
