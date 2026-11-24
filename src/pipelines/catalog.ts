/**
 * Display metadata for each pipeline, kept apart from the implementations so the
 * dashboard can show names without loading any ML code. Order sets chart colours.
 */
export const PIPELINE_CATALOG = [
  {
    id: 'hs-keyword',
    name: 'Keyword (BM25)',
    description: 'Okapi BM25 over HS heading + subheading text, with light stemming. Best hit per heading.',
  },
  {
    id: 'hs-semantic',
    name: 'Semantic (embeddings)',
    description: 'Cosine similarity between local bge-small-en-v1.5 embeddings of the query and every HS subheading. Best hit per heading.',
  },
  {
    id: 'hs-hybrid',
    name: 'Hybrid (BM25 + embeddings)',
    description: 'Top 50 from keyword and semantic search merged with reciprocal rank fusion (k = 60). Best hit per heading.',
  },
] as const

export type PipelineId = (typeof PIPELINE_CATALOG)[number]['id']

export function catalogEntry(id: PipelineId) {
  return PIPELINE_CATALOG.find((p) => p.id === id)!
}
