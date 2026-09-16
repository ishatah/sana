/**
 * The route loading screen.
 *
 * Shown by Next between navigations while the next route's server components
 * resolve. On this site that is usually a few hundred milliseconds, which is the
 * single most important fact about designing it: whatever goes here is seen
 * briefly, repeatedly, and at every transition, so it has to survive being seen a
 * hundred times rather than impress once.
 *
 * ── WHAT IT REPLACED, AND WHY THAT HAD TO GO ──────────────────────────────────
 *
 * A rotating circle: `h-8 w-8 rounded-full border-2 animate-spin` with a coloured
 * top edge. That is the default loader every framework ships with, and it carries
 * two problems here beyond looking generic. It spins at Tailwind's 1s linear,
 * which is a mechanical tempo nothing else on this site uses, and a spinner is a
 * BUSY signal — it says "the machine is working" where the rest of the page is
 * built to say as little as possible.
 *
 * ── WHAT IT IS NOW ────────────────────────────────────────────────────────────
 *
 * The wordmark, and a hairline that fills beneath it in IBC blue. Two reasons it
 * is a rule rather than a shape:
 *
 *   - A RULE IS ALREADY THE SITE'S VOCABULARY. The fact ledger, the section
 *     headers and `.reading-rail` are all hairlines. A progress rule reads as the
 *     same object arriving early rather than as a widget borrowed from elsewhere.
 *   - IT MOVES IN ONE DIRECTION. A spinner has no beginning or end, so it cannot
 *     suggest progress, only activity. A rule that fills left to right implies the
 *     thing you are waiting for is on its way, which is the only useful thing a
 *     loader can communicate when it cannot know the real percentage.
 *
 * IT IS DELIBERATELY NOT A REAL PERCENTAGE. Nothing here can know how much of the
 * next route has resolved, so the rule loops rather than tracking anything. It
 * sweeps rather than growing from zero to full and resetting, because a bar that
 * snaps back to empty reads as a failure and a restart.
 *
 * ── THIS FILE SITS ABOVE `[locale]`, SO IT HAS NO TRANSLATIONS ────────────────
 *
 * `app/loading.tsx` is outside the `[locale]` segment, which means
 * `getTranslations()` has no request locale to read and would resolve to the
 * default for every visitor — the exact failure app/[locale]/layout.tsx documents
 * for locale logic placed above that segment.
 *
 * So there is no translatable copy in the markup. The only text is the wordmark,
 * which is her name and is never translated (intake section 6 fixes the published
 * form), and the accessible name on the status region, which is supplied in
 * English because this file cannot know the page language. A screen reader
 * announcing one English word for ~300ms is a far smaller cost than every Arabic
 * and Dutch visitor being shown a confidently wrong translation.
 */
export default function Loading() {
  return (
    <div className="loading-screen" role="status" aria-label="Loading">
      <div className="loading-mark">
        {/* The wordmark. Letterspaced caps, matching the masthead, so the loading
            state looks like the site arriving rather than a different screen
            appearing in front of it. */}
        <span className="loading-wordmark">Sanae Rakik</span>

        {/* The rule. `aria-hidden` because the status region above already
            announces the state: a decorative bar has nothing to add to that, and
            announcing it twice is how a loader becomes noise on a screen reader. */}
        <span aria-hidden className="loading-rule">
          <span className="loading-rule-fill" />
        </span>
      </div>
    </div>
  )
}
