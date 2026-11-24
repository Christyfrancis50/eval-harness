import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CompareView } from '@/components/CompareView'
import { getAllRuns, getPipelineInfo } from '@/lib/data'

export const metadata: Metadata = { title: 'Compare runs' }

export default async function ComparePage() {
  const [runs, pipelines] = await Promise.all([getAllRuns(), getPipelineInfo()])
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Compare runs</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-ink-2">
          Pick any two runs to see which examples got fixed, which regressed and how the headline numbers moved. Use it to compare two
          pipelines, or the same pipeline before and after a change.
        </p>
      </div>
      <Suspense fallback={<div className="card h-40 animate-pulse" />}>
        <CompareView runs={runs} pipelines={pipelines} />
      </Suspense>
    </div>
  )
}
