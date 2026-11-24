import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Eval Harness', template: '%s · Eval Harness' },
  description: 'Measure search and AI pipelines against a labelled test set, track quality over time and catch regressions in CI.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-line bg-surface">
          <nav className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-ink">
              <span aria-hidden className="grid size-6 place-items-center rounded-md bg-ink text-[12px] text-page">
                ✓
              </span>
              Eval Harness
            </Link>
            <div className="flex items-center gap-4 text-[14px] text-ink-2">
              <Link href="/" className="hover:text-ink">
                Overview
              </Link>
              <Link href="/compare" className="hover:text-ink">
                Compare runs
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-line py-6 text-center text-[13px] text-muted">
          Runs are produced by <code className="font-mono">npm run eval</code> and committed as JSON — this page is rebuilt from them.
        </footer>
      </body>
    </html>
  )
}
