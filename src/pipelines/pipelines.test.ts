import { describe, expect, it } from 'vitest'
import { Bm25Index } from './bm25'
import { distinctHeadings, reciprocalRankFusion } from './hs'
import { stem, tokenize } from './text'

describe('text', () => {
  it('stems plurals', () => {
    expect(stem('valves')).toBe('valve')
    expect(stem('batteries')).toBe('battery')
    expect(stem('boxes')).toBe('box')
    expect(stem('glass')).toBe('glass')
  })
  it('drops stopwords and numbers', () => {
    expect(tokenize('Valves of stainless steel, 2 inch')).toEqual(['valve', 'stainless', 'steel', 'inch'])
  })
})

describe('Bm25Index', () => {
  it('ranks the most relevant document first', () => {
    const idx = new Bm25Index(['live horses', 'cotton t-shirts, knitted', 'woven cotton trousers'])
    expect(idx.search('knitted cotton shirts')[0]![0]).toBe(1)
  })
})

describe('reciprocalRankFusion', () => {
  it('rewards documents that appear high in both lists', () => {
    const fused = reciprocalRankFusion([
      [[1, 9], [2, 8], [3, 7]],
      [[2, 0.9], [4, 0.8], [1, 0.1]],
    ])
    expect(fused[0]![0]).toBe(2)
  })
})

describe('distinctHeadings', () => {
  it('keeps only the best hit per 4-digit heading', () => {
    const codes = ['730711', '730300', '841391', '730719'].map((code) => ({ code, description: '', heading: '', section: '' }))
    const ranked: Array<[number, number]> = [[0, 0.9], [1, 0.8], [3, 0.7], [2, 0.6]]
    expect(distinctHeadings(ranked, codes).map(([i]) => codes[i]!.code)).toEqual(['730711', '730300', '841391'])
  })
})
