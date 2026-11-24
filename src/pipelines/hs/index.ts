import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Pipeline, Prediction } from '../../lib/eval/types'
import { Bm25Index } from '../bm25'
import { catalogEntry } from '../catalog'
import { cosine, embedDocuments, embedQuery } from '../embeddings'

/**
 * Three ways to suggest a 6-digit HS code for a goods description, searched over
 * the full public HS nomenclature (5,612 subheadings):
 *   keyword  — BM25 over the subheading + heading text
 *   semantic — nearest neighbours in a local embedding space
 *   hybrid   — both lists merged with reciprocal rank fusion
 */

interface HsCode {
  code: string
  description: string
  heading: string
  section: string
}

const DATASET = 'hs-classification'
const CANDIDATES = 50

let corpus: HsCode[] | null = null
function loadCorpus(): HsCode[] {
  corpus ??= JSON.parse(readFileSync(join(process.cwd(), 'evals', 'datasets', DATASET, 'corpus.json'), 'utf8')) as HsCode[]
  return corpus
}

/** The text that gets indexed for each code: heading for context, then the subheading. */
const docText = (c: HsCode) => `${c.heading}. ${c.description}`

/**
 * Keeps only the best-scoring subheading under each 4-digit heading, so the
 * suggestion list offers different headings instead of five near-duplicates
 * ("cast iron fittings", "cast iron tubes", ...). The user picks a heading first,
 * so variety in the top few is worth more than a second hit in the same heading.
 */
export function distinctHeadings(ranked: Array<[number, number]>, codes: HsCode[], limit = 10): Array<[number, number]> {
  const seen = new Set<string>()
  const out: Array<[number, number]> = []
  for (const hit of ranked) {
    const heading = codes[hit[0]]!.code.slice(0, 4)
    if (seen.has(heading)) continue
    seen.add(heading)
    out.push(hit)
    if (out.length === limit) break
  }
  return out
}

const toPrediction = (c: HsCode, score: number): Prediction => ({
  label: c.code,
  score: Math.round(score * 10000) / 10000,
  detail: c.description,
})

// ---- keyword ---------------------------------------------------------------

let bm25: Bm25Index | null = null
function keywordSearch(query: string, limit: number): Array<[number, number]> {
  bm25 ??= new Bm25Index(loadCorpus().map(docText))
  return bm25.search(query, limit)
}

export const hsKeyword: Pipeline = {
  ...catalogEntry('hs-keyword'),
  datasets: [DATASET],
  setup: async () => void keywordSearch('warm up', 1),
  predict: async (input) => distinctHeadings(keywordSearch(input, CANDIDATES), loadCorpus()).map(([i, s]) => toPrediction(loadCorpus()[i]!, s)),
}

// ---- semantic --------------------------------------------------------------

let docVectors: Float32Array[] | null = null
async function semanticSearch(query: string, limit: number): Promise<Array<[number, number]>> {
  docVectors ??= await embedDocuments(loadCorpus().map(docText), (done, total) =>
    process.stdout.write(`\r  embedding corpus ${done}/${total}`),
  )
  const q = await embedQuery(query)
  return docVectors
    .map((v, i) => [i, cosine(q, v)] as [number, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

export const hsSemantic: Pipeline = {
  ...catalogEntry('hs-semantic'),
  datasets: [DATASET],
  setup: async () => void (await semanticSearch('warm up', 1)),
  predict: async (input) =>
    distinctHeadings(await semanticSearch(input, CANDIDATES), loadCorpus()).map(([i, s]) => toPrediction(loadCorpus()[i]!, s)),
}

// ---- hybrid ----------------------------------------------------------------

/** Reciprocal rank fusion: score = Σ 1 / (k + rank). Robust to the two scores being on different scales. */
export function reciprocalRankFusion(lists: Array<Array<[number, number]>>, k = 60): Array<[number, number]> {
  const fused = new Map<number, number>()
  for (const list of lists) list.forEach(([doc], rank) => fused.set(doc, (fused.get(doc) ?? 0) + 1 / (k + rank + 1)))
  return [...fused.entries()].sort((a, b) => b[1] - a[1])
}

export const hsHybrid: Pipeline = {
  ...catalogEntry('hs-hybrid'),
  datasets: [DATASET],
  setup: async () => {
    await hsKeyword.setup!()
    await hsSemantic.setup!()
  },
  predict: async (input) => {
    const [kw, sem] = [keywordSearch(input, CANDIDATES), await semanticSearch(input, CANDIDATES)]
    return distinctHeadings(reciprocalRankFusion([kw, sem]), loadCorpus()).map(([i, s]) => toPrediction(loadCorpus()[i]!, s))
  },
}
