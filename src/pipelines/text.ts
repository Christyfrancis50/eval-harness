/** Small text utilities shared by the keyword pipelines. */

const STOPWORDS = new Set(
  'a an and are as at be but by for from in into is it its not of on or other others than that the their this to with without whether n.e.c nec excluding including kind used'.split(
    ' ',
  ),
)

/** Very light English stemmer: enough to match "valves" with "valve" and "batteries" with "battery". */
export function stem(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies') && word.length > 4) return word.slice(0, -3) + 'y'
  if (/(ches|shes|sses|xes)$/.test(word)) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1)
  return word
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !/^\d/.test(t) && !STOPWORDS.has(t))
    .map(stem)
}
