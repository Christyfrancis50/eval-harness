export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`

/** Percentage-point delta, e.g. "+2.5 pts". */
export const pts = (x: number) => `${x > 0 ? '+' : x < 0 ? '−' : '±'}${Math.abs(x * 100).toFixed(1)} pts`

export const ms = (x: number) => (x < 10 ? `${x.toFixed(1)} ms` : `${Math.round(x)} ms`)

export function shortDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }) + ' UTC'
}
