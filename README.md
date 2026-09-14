# Sıdıka Şire — profile site

Client `CL-01-SS`. Next.js 16 · next-intl · Tailwind v4.

Design: **Kyros** HTML template structure, wearing the **IFB** brand identity
(ifb-us.org). Directory structure mirrors **ryzo-website**. Content comes from the
client profile intake form dated 9 September 2026.

## Brand

The client is IFB's President for Türkiye, so the site carries the federation's own
identity. Every value below was read from ifb-us.org's live CSS custom properties,
not sampled by eye — see the header comment in `styles/globals.css`.

| Token | Value | Use |
|---|---|---|
| `--primary` | `#C3AB73` | The IFB gold. Rules, borders, fills, icons. |
| `--primary-strong` | `#8D7029` | Gold **as text** — the bright gold is ~2:1 on white and fails AA. |
| `--heading` | `#171717` | Headings, and the logo's own ground. |
| `--foreground` | `#4A4A4A` | Body copy. |
| `--muted-foreground` | `#737B86` | Secondary text. |
| `--background` | `#FFFFFF` | Page ground. |
| `--shadow-brand` | `0 10px 27px rgba(83,65,24,.08)` | IFB's warm shadow, not neutral grey. |
| font | **Cairo** 400–900 | One family for Turkish, English and Arabic. |

Two decisions worth knowing:

- **Ignore the Elementor globals.** ifb-us.org is a WordPress/Elementor build whose
  global kit still carries Elementor's factory defaults (`#6EC1E4` blue, `#61CE70`
  green, Roboto). None of it renders on the page. The real system is the
  hand-authored custom properties above, which the logo agrees with.
- **Cairo covers Arabic and Latin in one family**, so the site needs no
  `size-adjust` correction and no separate Arabic display face — a structural
  simplification for a trilingual build, not just a brand match.

> **This profile is not approved for publication.** Section 18 of the intake form
> is blank and six open questions are unanswered. The site renders a draft banner
> on every page and is excluded from every search index until that changes. See
> [Publication gate](#publication-gate).

## Running it

```bash
npm install
cp .env.example .env.local   # admin credentials are the only required vars
npm run dev
npm run check:copy           # the publish gate — run before any deploy
```

The site runs with no Supabase project and no mail provider. Admin saves fall
back to writing `data/*.json` directly, and the contact form returns 503 until
Resend is configured.

## Layout

```
app/
  [locale]/          tr (default, unprefixed) · en · ar
    page.tsx         the one-page profile
    privacy/ terms/ cookies/
  admin/             editors, not localised — one internal user
  api/
    admin/content/[section]/   GET + PUT, compliance-gated
    contact/                   honeypot + rate limit, no CAPTCHA
components/
  admin/             field rows, save button, sidebar
  motion/            IntersectionObserver reveal (replaces WOW.js)
data/                the CMS — one JSON file per intake-form section
lib/
  verification.ts    tier rules + banned wording  ← the compliance core
  exclusions.ts      section 15 log, feeds the build gate
  cms-section.ts     storage-first loader with local fallback
  seo.ts             metadata, JSON-LD, the indexing gate
messages/            tr.json · en.json · ar.json
scripts/
  check-publish-gate.mjs       CI gate, exits 1 on banned wording
proxy.ts             admin guard + locale routing + locale header
```

## Publication gate

The intake form ends with: *"Nothing is published until sections 15 and 18 are
both complete."* That rule is enforced in four places, not written down once:

| Where | What it does |
|---|---|
| `scripts/check-publish-gate.mjs` | Fails CI on banned wording; reports blockers |
| `app/api/admin/content/[section]` | Rejects a save (422) whose copy breaks a rule |
| `lib/seo.ts` + `app/robots.ts` | `noindex` until sign-off **and** an env flag |
| `components/draft-banner.tsx` | Visible "DRAFT — not approved" on every page |

Verification tiers from section 3 are applied in `lib/verification.ts`:

- **A** — accredited, publicly verifiable. Publish freely.
- **B** — real body, client-confirmed, limited public record. Publish with the
  full organisation name and no inflated wording.
- **C** — title-selling or imitative. **Never rendered.** Logged in
  `data/exclusions.json`.

### Rules that are enforced, not just documented

- **No bare "United Nations."** UN-PAF is a private foundation. The full legal
  name is required everywhere; a disclaimer renders directly under that position.
  The only permitted exception is a sentence that *denies* affiliation.
- **No name prefix.** The 2024 honorary doctorate is not from a recognised
  university, so `Dr.` before this name is rejected in every language.
- **Contact details are an allowlist.** Only `visibility: "public"` renders. Both
  phone numbers and both addresses are withheld pending Q6 and Q2.
- **Language levels are never inferred.** Only Turkish is confirmed; Arabic and
  English render as pending, not as a guess.

## What is deliberately empty

Intake section 12 returned *"Nothing supplied"* for achievements, figures, press
and a quotable line. Those sections do not render at all rather than showing
placeholder content — no stat counters, no invented quote, no stock portrait.
They appear automatically once the data arrives.

| Blocked on | What it unblocks |
|---|---|
| Q1 | Arabic and English language levels |
| Q2 | Which Adana office is current |
| Q3 | Full bio, About page, achievements, results counters |
| Q4 | Start years on four positions |
| Q5 | Hero portrait, one-pager PDF, organisation logos |
| Q6 | Publishing phone numbers and email addresses |

Track them at `/admin/deliverables`.
