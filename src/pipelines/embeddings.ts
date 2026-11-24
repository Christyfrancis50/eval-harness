import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Local sentence embeddings with transformers.js — runs on the CPU, no API key,
 * no quota. The model (~35 MB) downloads from Hugging Face on first use and is
 * cached afterwards.
 */
export const EMBEDDING_MODEL = 'Xenova/bge-small-en-v1.5'
/** BGE models expect this instruction in front of search queries (not documents). */
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: '
const BATCH = 64

type Extractor = (texts: string[], opts: { pooling: 'cls'; normalize: boolean }) => Promise<{ data: Float32Array; dims: number[] }>

let extractorPromise: Promise<Extractor> | null = null
function getExtractor(): Promise<Extractor> {
  extractorPromise ??= import('@huggingface/transformers').then(
    ({ pipeline }) => pipeline('feature-extraction', EMBEDDING_MODEL, { dtype: 'q8' }) as unknown as Promise<Extractor>,
  )
  return extractorPromise
}

async function embed(texts: string[]): Promise<Float32Array[]> {
  const extractor = await getExtractor()
  const out: Float32Array[] = []
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH)
    const { data, dims } = await extractor(batch, { pooling: 'cls', normalize: true })
    const dim = dims[1]!
    for (let j = 0; j < batch.length; j++) out.push(data.slice(j * dim, (j + 1) * dim))
  }
  return out
}

export async function embedQuery(text: string): Promise<Float32Array> {
  return (await embed([QUERY_PREFIX + text]))[0]!
}

/**
 * Embeds documents once and caches the vectors in .cache/, keyed by a hash of
 * the model and the texts, so later runs start in a second.
 */
export async function embedDocuments(texts: string[], onProgress?: (done: number, total: number) => void): Promise<Float32Array[]> {
  const key = createHash('sha256').update(EMBEDDING_MODEL).update(JSON.stringify(texts)).digest('hex').slice(0, 16)
  const dir = join(process.cwd(), '.cache')
  const file = join(dir, `embeddings-${key}.f32`)
  if (existsSync(file)) {
    const buf = readFileSync(file)
    const all = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    const dim = all.length / texts.length
    return texts.map((_, i) => all.slice(i * dim, (i + 1) * dim))
  }
  const vectors: Float32Array[] = []
  for (let i = 0; i < texts.length; i += BATCH * 4) {
    vectors.push(...(await embed(texts.slice(i, i + BATCH * 4))))
    onProgress?.(vectors.length, texts.length)
  }
  mkdirSync(dir, { recursive: true })
  const flat = new Float32Array(vectors.length * vectors[0]!.length)
  vectors.forEach((v, i) => flat.set(v, i * v.length))
  writeFileSync(file, Buffer.from(flat.buffer))
  return vectors
}

/** Dot product; equals cosine similarity because vectors are normalised. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!
  return s
}
