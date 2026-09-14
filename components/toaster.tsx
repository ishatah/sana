"use client"

import { Toaster as SonnerToaster } from "sonner"

/**
 * The app's Toaster, with every built-in icon overridden.
 *
 * WHY THIS WRAPPER EXISTS. sonner ships its own success / error / warning / info /
 * loading / close marks, and each one is an inline <svg> created inside the
 * library. They are not reachable from our own source — no import of ours draws
 * them — so removing SVG from this app could not be done by editing a component.
 *
 * sonner's `icons` prop is the supported way to replace them, so all six slots are
 * filled here with text marks and CSS shapes. That keeps the library, its stacking,
 * swipe-to-dismiss, timers and accessibility behaviour, and changes only what is
 * painted inside the icon slot.
 *
 * `richColors` is left on at the call sites: it colours the toast's ground by
 * severity, which is a background, not a glyph, and it is what makes these marks
 * legible without the library's own colour-carrying paths.
 *
 * EVERY MARK IS `aria-hidden`. sonner announces the toast's text through its own
 * live region — the icon is decoration on top of that, and a screen reader reading
 * "heavy check mark" before the message is noise.
 */

/** Matches the ~20px box sonner's own icons occupied, so the layout is unchanged. */
function ToastMark({ glyph }: { glyph: string }) {
  return (
    <span aria-hidden className="inline-grid h-5 w-5 place-items-center text-[15px] leading-none">
      {glyph}
    </span>
  )
}

const ICONS = {
  success: <ToastMark glyph="✔" />,
  error: <ToastMark glyph="✕" />,
  warning: <ToastMark glyph="⚠" />,
  info: <ToastMark glyph="ℹ" />,
  // The one that has to be a shape rather than a character: a spinner is motion,
  // and `animate-spin` on a three-sided ring is the same mark the contact form and
  // the admin use, so the whole app spins one way.
  loading: (
    <span
      aria-hidden
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  ),
  close: <ToastMark glyph="✕" />,
}

export function Toaster(props: React.ComponentProps<typeof SonnerToaster>) {
  return <SonnerToaster icons={ICONS} {...props} />
}
