/**
 * The admin icon set, drawn WITHOUT SVG.
 *
 * WHY THIS FILE EXISTS. The admin previously imported ~25 marks from lucide-react,
 * which renders every one of them as an inline <svg>. All SVG has been removed from
 * this app, so the library went with it — but the admin is a dense tool UI where a
 * mark beside a row genuinely helps scanning, so the marks are redrawn rather than
 * dropped.
 *
 * WHAT THEY ARE NOW. Unicode symbols set in a fixed-size inline-grid box. That is a
 * real trade and worth naming: a font glyph is less precise than a drawn path, it
 * varies between platforms, and a few of these (a clipboard, a dashboard) have no
 * good single character — those fall back to a geometric stand-in rather than a
 * literal depiction. In a dense internal tool where every mark sits beside its own
 * text label, that is an acceptable cost; on the public site it would not have been,
 * which is why the three public components got hand-built CSS shapes instead.
 *
 * THE API IS LUCIDE'S, DELIBERATELY. Every export takes `{size, className}` and
 * nothing else, matching `NavItem["icon"]` in SidebarNav and every call site's
 * existing `<Icon size={15} />`. That is what let the swap be an import change in
 * 16 files rather than a rewrite of each.
 *
 * ACCESSIBILITY. Every mark is `aria-hidden`, unconditionally. These are all
 * decorative — each sits beside a visible text label or inside a button that
 * carries its own `aria-label` — and a screen reader reading out "black right
 * pointing triangle" beside the word "Positions" is pure noise. Call sites that
 * passed `aria-hidden` explicitly still work; it is simply redundant now.
 *
 * `aria-hidden` also stops the symbol being selected or read as text content, which
 * matters because several of these are ordinary characters that would otherwise be
 * caught by find-in-page.
 */

/** Shared renderer. `1em`-relative sizing inside a fixed box, so a mark fills its
 *  slot at whatever `size` the call site asks for without per-icon tuning. */
function Mark({
  glyph,
  size = 16,
  className = "",
  /** Optical correction, per-glyph. Some symbols sit high or low in their em box. */
  nudge = 0,
}: {
  glyph: string
  size?: number
  className?: string
  nudge?: number
}) {
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center leading-none ${className}`}
      style={{
        width: size,
        height: size,
        // Slightly under the box so a glyph with a tall ascender is not clipped.
        fontSize: size * 0.95,
        transform: nudge ? `translateY(${nudge}px)` : undefined,
      }}
    >
      {glyph}
    </span>
  )
}

type IconProps = { size?: number; className?: string }

/* ── Status and severity ──────────────────────────────────────────────────── */

/** A filled warning triangle. The one mark where the glyph is exactly right. */
export const AlertTriangle = (p: IconProps) => <Mark glyph="⚠" {...p} />

/** Permission/guard warnings. Same triangle: the admin uses ShieldAlert and
 *  AlertTriangle for the same severity, and a shield glyph does not exist in a
 *  weight that matches the rest of this set. */
export const ShieldAlert = (p: IconProps) => <Mark glyph="⚠" {...p} />

/** Complete. A heavy check rather than a circled one — the circled forms render
 *  as emoji on several platforms, which would arrive in colour. */
export const CheckCircle2 = (p: IconProps) => <Mark glyph="✔" {...p} />
export const Check = (p: IconProps) => <Mark glyph="✔" {...p} />

/** Not started. A hollow circle, matching lucide's dashed ring closely enough. */
export const CircleDashed = (p: IconProps) => <Mark glyph="○" {...p} />

/** Informational. */
export const Info = (p: IconProps) => <Mark glyph="ℹ" {...p} />
export const HelpCircle = (p: IconProps) => <Mark glyph="?" {...p} />

/* ── Actions ──────────────────────────────────────────────────────────────── */

export const Plus = (p: IconProps) => <Mark glyph="+" {...p} />
/** Delete. A multiplication sign, not a drawn bin — heavier than a plain x. */
export const Trash2 = (p: IconProps) => <Mark glyph="✕" {...p} />
export const X = (p: IconProps) => <Mark glyph="✕" {...p} />
export const Upload = (p: IconProps) => <Mark glyph="↑" {...p} />
export const LogOut = (p: IconProps) => <Mark glyph="↪" {...p} />
export const ExternalLink = (p: IconProps) => <Mark glyph="↗" {...p} />

/** The mobile admin menu. Three bars, as on the public nav. */
export function Menu({ size = 16, className = "" }: IconProps) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 flex-col justify-center ${className}`}
      style={{ width: size, height: size, gap: size * 0.22 }}
    >
      <span className="w-full rounded-full bg-current" style={{ height: 1.5 }} />
      <span className="w-full rounded-full bg-current" style={{ height: 1.5 }} />
      <span className="w-full rounded-full bg-current" style={{ height: 1.5 }} />
    </span>
  )
}

/** The pending spinner. A CSS ring — `animate-spin` is applied by the call site
 *  via className, exactly as it was on the lucide component. */
export function Loader2({ size = 16, className = "" }: IconProps) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

/* ── State and visibility ─────────────────────────────────────────────────── */

export const Eye = (p: IconProps) => <Mark glyph="◉" {...p} />
export const EyeOff = (p: IconProps) => <Mark glyph="◌" {...p} />
export const Lock = (p: IconProps) => <Mark glyph="▮" {...p} />
export const Ban = (p: IconProps) => <Mark glyph="⊘" {...p} />
export const Timer = (p: IconProps) => <Mark glyph="◴" {...p} />

/* ── Sidebar section marks ────────────────────────────────────────────────────
 *
 * These are the weakest of the set as literal depictions — there is no character
 * that says "media library". They are kept because in a vertical nav the mark's
 * job is mostly to give each row a consistent left anchor and to be DISTINCT from
 * its neighbours, both of which geometric symbols do fine. The label carries the
 * meaning. */

export const LayoutDashboard = (p: IconProps) => <Mark glyph="▦" {...p} />
export const User = (p: IconProps) => <Mark glyph="●" {...p} />
export const Type = (p: IconProps) => <Mark glyph="T" {...p} />
export const Briefcase = (p: IconProps) => <Mark glyph="▬" {...p} />
export const Sparkles = (p: IconProps) => <Mark glyph="✦" {...p} />
export const FileText = (p: IconProps) => <Mark glyph="▭" {...p} />
export const Award = (p: IconProps) => <Mark glyph="✧" {...p} />
export const Mail = (p: IconProps) => <Mark glyph="✉" {...p} />
export const ImageIcon = (p: IconProps) => <Mark glyph="◰" {...p} />
export const Settings = (p: IconProps) => <Mark glyph="⚙" {...p} />
export const ListChecks = (p: IconProps) => <Mark glyph="≡" {...p} />
