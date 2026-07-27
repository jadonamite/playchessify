import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Shared shell for the static legal pages (Terms, Privacy). Server component —
 * no client hooks. Styling rides the app's theme tokens so it flips with
 * light/dark automatically; the scoped `.legal-prose` block keeps the content
 * pages semantic (plain h2/p/ul) instead of class-soup.
 */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--t1)]">
      <div className="mx-auto max-w-3xl px-5 py-10 md:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--t2)] transition-colors hover:text-[var(--c)]"
        >
          ← Back to Chessify
        </Link>

        <header className="mt-8 mb-10 border-b border-[var(--b1)] pb-8">
          <h1
            className="text-3xl md:text-4xl font-extrabold tracking-tight"
            style={{ fontFamily: 'var(--fd)' }}
          >
            {title}
          </h1>
          <p className="mt-3 text-sm text-[var(--t3)]">Last updated: {updated}</p>
        </header>

        <article className="legal-prose">{children}</article>

        <footer className="mt-14 border-t border-[var(--b1)] pt-6 text-sm text-[var(--t3)]">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/terms" className="hover:text-[var(--c)]">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-[var(--c)]">Privacy Policy</Link>
            <Link href="/" className="hover:text-[var(--c)]">Home</Link>
          </div>
          <p className="mt-4">© 2026 Playchessify</p>
        </footer>
      </div>

      <style>{`
        .legal-prose { color: var(--t2); line-height: 1.7; font-size: 15px; }
        .legal-prose h2 {
          font-family: var(--fd);
          color: var(--t1);
          font-size: 1.15rem;
          font-weight: 700;
          margin: 2.25rem 0 0.75rem;
        }
        .legal-prose h2:first-child { margin-top: 0; }
        .legal-prose h3 {
          color: var(--t1);
          font-size: 1rem;
          font-weight: 700;
          margin: 1.5rem 0 0.5rem;
        }
        .legal-prose p { margin: 0.75rem 0; }
        .legal-prose ul { margin: 0.75rem 0; padding-left: 1.25rem; list-style: disc; }
        .legal-prose li { margin: 0.4rem 0; }
        .legal-prose strong { color: var(--t1); font-weight: 700; }
        .legal-prose a { color: var(--c); text-decoration: underline; text-underline-offset: 2px; }
        .legal-prose a:hover { color: var(--c-light); }
      `}</style>
    </div>
  )
}
