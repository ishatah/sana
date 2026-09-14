"use client"

import { useState } from "react"
import { Loader2, Check } from "@/components/admin/icons"
import { toast } from "sonner"

/**
 * Save with an inline result state.
 *
 * On failure it toasts the actual error rather than swallowing it. That matters
 * specifically here: a save can be refused with 422 because the copy contains
 * wording the profile is not allowed to publish, and the editor needs to read that
 * reason to fix it. A silent revert to idle looks like a broken button.
 */
export function SaveButton({ onSave, label = "Save changes" }: { onSave: () => Promise<void>; label?: string }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle")

  const click = async () => {
    setState("saving")
    try {
      await onSave()
      setState("saved")
      setTimeout(() => setState("idle"), 2000)
    } catch (e) {
      setState("idle")
      toast.error(e instanceof Error ? e.message : "Save failed", { duration: 12000 })
    }
  }

  return (
    <button type="button" onClick={click} disabled={state === "saving"} className="btn-main disabled:opacity-60">
      {state === "saving" && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {state === "saved" && <Check size={15} aria-hidden />}
      {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : label}
    </button>
  )
}
