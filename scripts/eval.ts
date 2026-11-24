/**
 * Evaluation CLI.
 *
 *   npm run eval                              run every pipeline on its datasets and save the runs
 *   npm run eval -- --pipeline hs-keyword     run one pipeline (comma-separate for several)
 *   npm run eval -- --dataset hs-classification
 *   npm run eval -- --check --no-save         CI mode: compare with the latest committed runs and
 *                                             exit 1 if top-1 accuracy drops by more than --tolerance
 *   npm run eval -- --list                    list pipelines and datasets
 */
import { execSync } from 'node:child_process'
import { relative } from 'node:path'
import { parseArgs } from 'node:util'
import { diffRuns } from '../src/lib/eval/compare'
import { runEval } from '../src/lib/eval/runner'
import { listDatasets, listRuns, loadDataset, saveRun } from '../src/lib/eval/storage'
import type { Run } from '../src/lib/eval/types'
import { PIPELINES } from '../src/pipelines/registry'

const { values: args } = parseArgs({
  options: {
    pipeline: { type: 'string' },
    dataset: { type: 'string' },
    check: { type: 'boolean', default: false },
    'no-save': { type: 'boolean', default: false },
    tolerance: { type: 'string', default: '0.02' },
    list: { type: 'boolean', default: false },
  },
})

const pct = (x: number) => `${(x * 100).toFixed(1)}%`
const signed = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)} pts`

function gitSha(): string | null {
  try {
    const run = (cmd: string) => execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
    const sha = run('git rev-parse --short HEAD')
    // Mark runs made on uncommitted code (run files themselves don't count).
    const dirty = run('git status --porcelain -- . ":(exclude)runs"') !== ''
    return sha ? `${sha}${dirty ? '-dirty' : ''}` : null
  } catch {
    return null
  }
}

async function main() {
  const datasets = listDatasets()
  if (args.list) {
    console.log('Datasets:')
    for (const d of datasets) console.log(`  ${d.id.padEnd(22)} ${d.examples.length} examples  ${d.name}`)
    console.log('Pipelines:')
    for (const p of PIPELINES) console.log(`  ${p.id.padEnd(22)} ${p.name}  [${p.datasets.join(', ')}]`)
    return
  }

  const wantedPipelines = args.pipeline?.split(',').map((s) => s.trim())
  const unknown = wantedPipelines?.filter((id) => !PIPELINES.some((p) => p.id === id)) ?? []
  if (unknown.length) throw new Error(`Unknown pipeline(s): ${unknown.join(', ')}. Try --list.`)
  const selectedDatasets = args.dataset ? [loadDataset(args.dataset)] : datasets

  const history = listRuns()
  const tolerance = Number(args.tolerance)
  const sha = gitSha()
  const sessionId = new Date().toISOString().replace(/[-:]/g, '').replace(/..+/, '').replace('T', '-')
  const failures: string[] = []
  const finished: Array<{ run: Run; baseline?: Run }> = []

  for (const dataset of selectedDatasets) {
    const pipelines = PIPELINES.filter((p) => p.datasets.includes(dataset.id) && (!wantedPipelines || wantedPipelines.includes(p.id)))
    for (const pipeline of pipelines) {
      console.log(`\n▶ ${pipeline.name} on ${dataset.name} (${dataset.examples.length} examples)`)
      const run = await runEval(pipeline, dataset, {
        gitSha: sha,
        sessionId,
        onProgress: (done, total) => process.stdout.write(`\r  ${done}/${total} examples`),
      })
      process.stdout.write('\n')
      const baseline = history.filter((r) => r.pipelineId === run.pipelineId && r.datasetId === run.datasetId).at(-1)
      finished.push({ run, baseline })

      const m = run.metrics
      console.log(`  top-1 ${pct(m.top1)}   top-3 ${pct(m.top3)}   MRR ${m.mrr.toFixed(3)}   p95 ${m.latencyP95Ms} ms   errors ${m.errors}`)

      if (baseline) {
        if (baseline.datasetHash !== run.datasetHash) console.log(`  (test set changed since the last run — deltas compare different examples)`)
        const delta = m.top1 - baseline.metrics.top1
        console.log(`  vs last run ${baseline.id}: top-1 ${signed(delta)}`)
        const changes = diffRuns(baseline, run)
        for (const c of changes.filter((c) => c.kind === 'regressed'))
          console.log(`    ✗ regressed  ${c.id}  "${c.input}"  expected ${c.expected}, now ${c.after.predictions[0]?.label ?? '—'}`)
        for (const c of changes.filter((c) => c.kind === 'fixed')) console.log(`    ✓ fixed      ${c.id}  "${c.input}"`)
        if (args.check && delta < -tolerance)
          failures.push(`${pipeline.id} on ${dataset.id}: top-1 ${pct(m.top1)} is ${signed(delta)} vs ${pct(baseline.metrics.top1)} (tolerance ${pct(tolerance)})`)
      } else if (args.check) {
        console.log('  (no committed baseline run yet — nothing to compare)')
      }

      if (!args['no-save']) console.log(`  saved ${relative(process.cwd(), saveRun(run))}`)
    }
  }

  if (finished.length > 1) {
    console.log('\nSummary')
    console.log('  ' + 'pipeline'.padEnd(30) + 'top-1'.padStart(8) + 'top-3'.padStart(8) + 'MRR'.padStart(8) + 'p95 ms'.padStart(9))
    for (const { run: r } of finished)
      console.log(
        '  ' +
          r.pipelineName.padEnd(30) +
          pct(r.metrics.top1).padStart(8) +
          pct(r.metrics.top3).padStart(8) +
          r.metrics.mrr.toFixed(3).padStart(8) +
          String(r.metrics.latencyP95Ms).padStart(9),
      )
  }

  if (failures.length) {
    console.error('\nQuality check FAILED:')
    for (const f of failures) console.error('  ' + f)
    process.exit(1)
  }
  if (args.check) console.log('\nQuality check passed.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
