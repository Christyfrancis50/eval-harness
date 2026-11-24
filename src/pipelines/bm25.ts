import { tokenize } from './text'

/**
 * Okapi BM25 — the classic keyword ranking function used by search engines
 * such as Elasticsearch. No dependencies, builds in milliseconds.
 */
export class Bm25Index {
  private postings = new Map<string, Array<[doc: number, tf: number]>>()
  private docLengths: number[] = []
  private avgDocLength = 0

  constructor(
    docs: string[],
    private k1 = 1.2,
    private b = 0.75,
  ) {
    docs.forEach((text, doc) => {
      const tokens = tokenize(text)
      this.docLengths.push(tokens.length)
      const tf = new Map<string, number>()
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1)
      for (const [term, count] of tf) {
        const list = this.postings.get(term) ?? []
        list.push([doc, count])
        this.postings.set(term, list)
      }
    })
    this.avgDocLength = this.docLengths.reduce((a, b) => a + b, 0) / Math.max(1, docs.length)
  }

  get size() {
    return this.docLengths.length
  }

  /** Returns [docIndex, score] pairs, best first. */
  search(query: string, limit = 10): Array<[number, number]> {
    const scores = new Map<number, number>()
    const N = this.docLengths.length
    for (const term of new Set(tokenize(query))) {
      const list = this.postings.get(term)
      if (!list) continue
      const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5))
      for (const [doc, tf] of list) {
        const norm = tf + this.k1 * (1 - this.b + (this.b * this.docLengths[doc]!) / this.avgDocLength)
        scores.set(doc, (scores.get(doc) ?? 0) + (idf * (tf * (this.k1 + 1))) / norm)
      }
    }
    return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit)
  }
}
