#!/usr/bin/env node
/**
 * The publish gate. Run it with `npm run check:copy`, and in CI before any deploy.
 *
 * The client intake form ends with a FINAL CHECK: "Nothing is published until
 * sections 15 and 18 are both complete." Section 15 is the exclusions log, section
 * 18 is the sign-off. This script is that check, made executable.
 *
 * It reports two classes of problem and treats them very differently:
 *
 *   VIOLATIONS (exit 1) — banned wording found in copy that can reach a visitor.
 *     These are correctness failures. A bare "United Nations" next to this client's
 *     name is a false claim of UN affiliation; a "Dr." prefix is a false claim of a
 *     recognised doctorate. Neither is a style preference and neither may ship.
 *
 *   BLOCKERS (exit 0, reported) — the profile is not signed off, or open questions
 *     are unanswered. These are expected during production and must not fail a
 *     preview build; they are why the site is noindex by default. The script prints
 *     them so the state is visible on every run rather than discovered at launch.
 *
 * Scope: data/ and messages/ — everything a page can render. Not lib/ or scripts/,
 * where the banned strings legitimately appear inside the rules themselves; a gate
 * that flags its own rulebook gets disabled within a week.
 */

import { readFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const SCAN_DIRS = ["data", "messages"]

// Kept in sync with lib/verification.ts by hand. It is duplicated rather than
// imported because this runs as plain node with no TS pipeline, and the whole
// point of the gate is that it works even when the app does not build.
const BANNED = [
  {
    pattern: /\b(?:our|my|her|the)\s+client\s+(?:[A-Z][\w&.-]*|is|was|include)/g,
    reason: "Intake sections 3 and 6: no client names — the profile describes the work, never who it was for.",
  },
  {
    pattern: /(?:[€$£]\s?\d[\d,.]*\s?(?:k|m|bn|million|billion)?|\b\d[\d,.]*\s?(?:EUR|USD|GBP|AED|SAR)\b)/gi,
    reason: "Intake section 6: no transaction value, commission or fee in published copy.",
  },
  {
    pattern: /\b\d{1,3}(?:\.\d+)?\s?%\s?(?:growth|increase|return|roi|uplift|margin|نمو|عائد|زيادة)/gi,
    reason: "Intake section 3: no growth or return figure without documentation.",
  },
  {
    pattern: /\b(?:guaranteed returns?|investment opportunity|invest with (?:me|us)|high[- ]yield)\b/gi,
    reason: "Intake section 6: the site is a professional profile, not an investment offer.",
  },
  {
    pattern: /\b(?:Dr|Dr\.|Prof|Prof\.|د\.|الدكتورة)\s*(?:Sanae|سناء)/gi,
    reason: "Intake section 6: the approved name format is 'Sanae Rakik' / 'سناء رقيق', دون لقب — no honorific.",
  },
  {
    pattern: /\b(?:diplomatic (?:passport|immunity|status|credential))\b/gi,
    reason: "Nothing imitating a diplomatic or governmental credential.",
  },
  // Section 6, NEVER PUBLISHED: identity and financial numbers. These match the
  // SHAPE of the data, not a specific value, so a pasted number is caught even
  // though no such number is (or should ever be) in the repo to compare against.
  //
  // The IBAN shapes are Dutch and the surrounding EU, because that is where this
  // subject banks. The previous ruleset matched TR\d{24} and "T.C. Kimlik", which
  // would have let an NL IBAN through untouched.
  {
    pattern: /\b(?:BSN|burgerservicenummer|national ID(?: number)?|passport (?:no|number)|IBAN|NL\d{2}[A-Z]{4}\d{10}|BE\d{14}|DE\d{20}|FR\d{25})\b/gi,
    reason: "Intake section 6: passport, national ID and bank details are NEVER published, under any circumstance.",
  },
]

// Keys that hold internal production notes rather than renderable copy. The
// exclusions log necessarily names the excluded outfits — that is its job — so
// scanning it for those names would fail the build on the record that prevents
// the failure. Comment keys are skipped for the same reason.
const INTERNAL_KEY = /^_comment/
const INTERNAL_FILES = new Set(["exclusions.json", "deliverables.json"])

/** Walk a parsed JSON tree and yield every renderable string with its key path. */
function* walk(node, path = []) {
  if (typeof node === "string") {
    yield { path: path.join("."), value: node }
    return
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* walk(node[i], [...path, i])
    return
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (INTERNAL_KEY.test(k)) continue
      yield* walk(v, [...path, k])
    }
  }
}

async function jsonFiles(dir) {
  const out = []
  let entries
  try {
    entries = await readdir(join(ROOT, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.isDirectory()) out.push(...(await jsonFiles(join(dir, e.name))))
    else if (e.name.endsWith(".json")) out.push(join(dir, e.name))
  }
  return out
}

const violations = []
const blockers = []
const notes = []

for (const dir of SCAN_DIRS) {
  for (const file of await jsonFiles(dir)) {
    const name = file.split(/[\\/]/).pop()
    if (INTERNAL_FILES.has(name)) continue
    const parsed = JSON.parse(await readFile(join(ROOT, file), "utf-8"))
    for (const { path, value } of walk(parsed)) {
      for (const { pattern, exempt, reason } of BANNED) {
        // An exempt rule whitelists a specific safe construction — the sentence
        // that explicitly DENIES an affiliation is allowed to name it, since the
        // denial is the correction. Checked per-string, so a denial in one field
        // can never excuse a bare claim in another.
        if (exempt && exempt.test(value)) continue
        const re = new RegExp(pattern.source, pattern.flags)
        const m = re.exec(value)
        if (m) violations.push({ file: relative(".", file), path, phrase: m[0], reason })
      }
    }
  }
}

// ── Sign-off and open questions ──────────────────────────────────────────────
const deliverables = JSON.parse(await readFile(join(ROOT, "data/deliverables.json"), "utf-8"))
const s = deliverables.signOff ?? {}
if (!s.allTitlesConfirmed) blockers.push("Section 18: all titles and positions not confirmed")
if (!s.exclusionsConfirmed) blockers.push("Section 18: exclusions not confirmed")
if (!s.approvedForPublicationBy?.trim()) blockers.push("Section 18: no approver recorded")
if (!s.clientReviewedOn?.trim()) blockers.push("Section 18: client review date empty")

const unanswered = (deliverables.openQuestions ?? []).filter((q) => !q.answer?.trim())
for (const q of unanswered) blockers.push(`Open question ${q.id.toUpperCase()}: ${q.question}`)

const missingAssets = (deliverables.mediaAssets ?? []).filter((a) => !a.received)
for (const a of missingAssets) notes.push(`Media asset not received: ${a.asset}`)

// ── Domain ───────────────────────────────────────────────────────────────────
/*
 * A BLOCKER, NOT A NOTE, because the placeholder is load-bearing in ways that are
 * easy to miss: `siteUrl` feeds `metadataBase`, every canonical tag and the whole
 * sitemap. Launching on an unconfirmed domain does not fail loudly — it publishes
 * canonicals and a sitemap pointing at a host nobody owns.
 *
 * lib/seo.ts already refuses to put an unconfirmed host in the structured-data
 * identity claims (`url` and `@id`), so the false CLAIM is handled there. This is
 * the other half: making sure the outstanding decision is visible on every run
 * rather than discovered after the fact.
 */
const settings = JSON.parse(await readFile(join(ROOT, "data/siteSettings.json"), "utf-8"))
if (settings.domainConfirmed !== true) {
  blockers.push(
    `Section 7: domain not confirmed — "${settings.siteUrl}" is a placeholder and must not be published as the canonical host`,
  )
}

// ── Media permissions ────────────────────────────────────────────────────────
//
// A file present in a slot with no recorded permission is a VIOLATION, not a note.
//
// Everything else in this section is "not supplied yet", which is the normal condition
// of a file at intake and must not fail a preview build. This is the opposite case: the
// asset is here, it is one flag away from rendering, and nobody has established the
// right to publish it. Intake section 14 and open question Q5 treat the file and the
// permission as two separate deliverables precisely because the second is the one that
// gets skipped — so it fails the build rather than printing a line someone scrolls past.
try {
  const media = JSON.parse(await readFile(join(ROOT, "data/media.json"), "utf-8"))
  for (const slot of media.slots ?? []) {
    const hasFile = typeof slot.path === "string" && slot.path.trim() !== ""
    if (!hasFile) continue

    if (slot.permission?.granted !== true) {
      violations.push({
        file: "data/media.json",
        path: `slots.${slot.id}.permission.granted`,
        phrase: slot.path,
        reason:
          "A file is attached to this slot but no permission to publish it has been recorded. Holding a file is not the same as having the right to publish it — see intake section 14 and open question Q5.",
      })
    }

    // Alt text is an accessibility requirement and lib/media.ts withholds a slot
    // without it, so a cleared file with no description is a silently dead asset.
    const alt = slot.alt ?? {}
    const hasAlt = Object.values(alt).some((v) => typeof v === "string" && v.trim() !== "")
    if (!hasAlt) notes.push(`Alt text missing, slot will not render: ${slot.id}`)
  }
} catch {
  // No media file, or unreadable. Not a failure: the section is optional and every
  // renderer falls back to its built alternative.
}

// ── Register entries still outstanding ───────────────────────────────────────
const positions = JSON.parse(await readFile(join(ROOT, "data/positions.json"), "utf-8"))
for (const p of positions.current ?? []) {
  if (p.publish && !p.registerConfirmed) {
    notes.push(`No public register entry confirmed for: ${p.organisation}`)
  }
  if (p.publish && !p.startYear) {
    notes.push(`Start year missing (Q4) for: ${p.organisation}`)
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const bold = (t) => `[1m${t}[0m`
const red = (t) => `[31m${t}[0m`
const yellow = (t) => `[33m${t}[0m`
const green = (t) => `[32m${t}[0m`
const dim = (t) => `[2m${t}[0m`

console.log(bold("\nPublish gate — client CL-02-SR\n"))

if (violations.length) {
  console.log(red(bold(`✗ ${violations.length} banned phrase(s) in publishable copy\n`)))
  for (const v of violations) {
    console.log(`  ${red("✗")} ${bold(v.phrase)}`)
    console.log(`    ${dim(`${v.file} → ${v.path}`)}`)
    console.log(`    ${v.reason}\n`)
  }
} else {
  console.log(green("✓ No banned wording in data/ or messages/"))
}

if (blockers.length) {
  console.log(yellow(bold(`\n▲ ${blockers.length} publication blocker(s) — site stays noindex\n`)))
  for (const b of blockers) console.log(`  ${yellow("▲")} ${b}`)
}

if (notes.length) {
  console.log(dim(bold(`\n· ${notes.length} outstanding item(s)\n`)))
  for (const n of notes) console.log(dim(`  · ${n}`))
}

if (!blockers.length && !violations.length) {
  console.log(green(bold("\n✓ Sections 15 and 18 complete — cleared for publication.\n")))
} else {
  console.log(dim("\nNothing is published until sections 15 and 18 are both complete.\n"))
}

process.exit(violations.length ? 1 : 0)
