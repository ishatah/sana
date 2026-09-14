import Link from "next/link"

/**
 * Root 404. Not localised: it is served for paths outside every locale segment,
 * so there is no locale in scope to translate into. English is the safe common
 * denominator for a URL that matched nothing.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5 text-center">
      <div>
        <p className="eyebrow mb-3">404</p>
        <h1 className="section-heading mb-4">Page not found</h1>
        <div className="space-border" aria-hidden />
        <Link href="/" className="btn-outline">
          Back to home
        </Link>
      </div>
    </div>
  )
}
