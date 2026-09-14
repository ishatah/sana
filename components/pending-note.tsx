import { getTranslations } from "next-intl/server"

/**
 * The draft-only production note — a gold-rule aside carrying information that
 * belongs to whoever is reviewing the profile, not to a visitor.
 *
 * Two sections use it today: the career journey on /about, whose stages are known
 * but whose dates are not, and the business partnerships on /roles, whose names
 * are supplied but not yet approved for publication. A treatment that says "this
 * is unfinished" is exactly the kind of thing that must look identical everywhere
 * — hand-rolled variants would read as different levels of seriousness.
 *
 * EVERY USE MUST BE GATED ON SIGN-OFF BY THE CALLER. This component does not
 * check `isSignedOff` itself, because the two current callers gate on different
 * things: the register note is hidden once the profile is signed off, while the
 * blocked-section notice is driven by `fullBioBlocked`. Putting the gate inside
 * would force one rule onto both.
 */
export async function PendingNote({
  children,
  className = "",
}: {
  children: React.ReactNode
  className?: string
}) {
  const td = await getTranslations("draft")

  return (
    <p
      className={`border-s-2 border-[color:var(--warning)]/40 ps-4 text-xs leading-relaxed text-[color:var(--muted-foreground)] ${className}`}
    >
      <span className="font-display font-bold uppercase tracking-widest text-[color:var(--warning)]">
        {td("badge")}
      </span>{" "}
      {children}
    </p>
  )
}
