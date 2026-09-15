import Link from "next/link"

/**
 * Root 404. Not localised: it is served for paths outside every locale segment,
 * so there is no locale in scope to translate into. English is the safe common
 * denominator for a URL that matched nothing.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 text-center">
      {/*
        EFFECT 14, the numeral as a watermark behind the message.

        It is aria-hidden and DUPLICATES the eyebrow below rather than replacing
        it: the readable "404" stays in the flow as real text, and this is a
        decorative echo of it. A watermark that was the only statement of the
        code would be text at 0.08 alpha, which is unreadable by design and would
        leave the page with no announced error code at all.

        --danger at 0.08 over --background composites to roughly #1a0f0f,
        visible as a shape, far too faint to read, which is the intent.
      */}
      <span aria-hidden className="error-watermark">
        404
      </span>

      <div className="relative z-10">
        <p className="eyebrow eyebrow-rule mb-3 justify-center">404</p>
        <h1 className="section-heading mb-8">Page not found</h1>
        <Link href="/" className="btn-outline">
          Back to home
        </Link>
      </div>
    </div>
  )
}
