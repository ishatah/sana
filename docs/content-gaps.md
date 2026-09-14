# Content gaps — client CL-01-SS

What is still missing from the profile, and which question unblocks each item.

Generated from `data/*.json` and the output of `npm run check:copy`.
Baseline at time of writing: **0 banned-wording violations · 10 publication blockers ·
14 outstanding items**.

> Nothing on this site is published until intake sections 15 and 18 are both complete.
> Every gap below is a live blocker, not a nice-to-have — the site renders a draft banner
> on every page and is excluded from every search index until they close.

---

## The six open questions

### Q1 — Arabic and English levels, speaking and writing

**Blocks:** the languages table in the About section.

`data/expertise.json` carries Turkish as `native/native, business: true, confirmed`. Arabic
and English both have empty `speaking` and `writing` and `status: "to-confirm"`, so the UI
renders them as *pending* rather than omitting them or guessing.

Intake section 8 is one of only two fields on the whole form marked **MUST CONFIRM**, with
the instruction: *"Never assume a language level from the material supplied."* This is a real
trap on this file — she corresponds from an ifb-us.org address, works Iraq and the wider
Middle East, and supplied Arabic-language certificates, from which "Arabic: fluent, English:
professional" is an easy and completely unevidenced inference.

**Needed:** a level for each of the four cells (speaking and writing × Arabic and English),
and whether each is used in business.

---

### Q2 — Which Adana office is current

**Blocks:** the address block in the contact section.

`data/siteSettings.json` holds two addresses, both `visibility: "to-confirm"`:

- Cemal Paşa Mh. Ordu Cd. İnci Apt. No: 93, Seyhan / Adana
- Tepebağ Mh. Çakmak Cd. Hilalhan İşh. No: 2, Kapı: 126, Adana

Both are withheld and the contact section shows the city alone. Section 13 warns that only
one may be presented as the head office; section 15 additionally forbids publishing a home
address, and neither address has been confirmed as an office rather than a residence.

**Needed:** which address is current, and confirmation that it is a business address.

---

### Q3 — Two or three concrete achievements with dates, plus any numbers

**The largest gap in the file.** Intake section 12 returned *"Nothing supplied."*

**Blocks:**

| Field | File | Current state |
|---|---|---|
| `fullBio` (tr/en/ar) | `data/biography.json` | all empty, `fullBioBlocked: true` |
| Website About page (400–600 words) | — | `status: "blocked"` in deliverables |
| `stats[].value` × 4 | `data/biography.json` | all `null` — members, events, companies, countries |
| `achievements` | `data/biography.json` | `[]` |
| `press` | `data/biography.json` | `[]` — press carousel hidden |

The stats block needs: members represented, events per year, companies matched, countries
covered. Every value is `null`, so the counter section renders nothing rather than a
fabricated or zeroed figure.

**Needed:** two or three specific things she did, with dates, and any numbers attached to
them. Without these the full bio cannot be written without inventing its content.

---

### Q4 — Start year for each federation and association role

**Blocks:** the date line on four of six positions, and `identity.careerStartYear`.

Missing on: IFB (Türkiye), IFBI (Turkish Union), Iraq and Middle East Businesswomen and
Businessmen Association, and UN-PAF. Present on: Institute of International Peace Leaders
(2025–26) and World Parliament of Security and Peace (2020).

Rows without a start year render *"Start year to be confirmed"* rather than omitting the
line — silence would read as "no date available".

`identity.careerStartYear` is also empty; the About fact list omits the row entirely rather
than deriving "since 2016" from the "10+ years" answer.

**Needed:** a start year for each of the four roles.

---

### Q5 — High resolution portrait photo, and permission to use the logos

**Blocks:** every image on the site, plus the one-pager PDF.

All five assets in `data/deliverables.json` are `received: false`:

| Asset | Note |
|---|---|
| Portrait photo, high resolution | Needed for every deliverable |
| Event or delegation photos | — |
| Organisation logos, with permission | IFB, IFBI and the Adana association |
| Certificates cleared for display | Only tier A or B items |
| Brand colours or style guide | — |

The question asks for two separate things and **both are required**: the file, and the right
to publish it. Holding a logo file is not permission to use it — three organisations are
involved, and using an association's mark on a personal profile without its agreement damages
the relationship the profile exists to represent.

The site is now wired for these (`data/media.json` + `lib/media.ts`), so each asset needs a
recorded permission alongside the file: who granted it, when, and what the grant covers.
Note that event photography is usually the **photographer's** copyright rather than the
subject's, so a grant from the client alone may not be sufficient for delegation photos.

**Needed:** the portrait file, and a written permission per logo from each organisation.

---

### Q6 — Which phone numbers and emails may be published

**Blocks:** both phone numbers.

`data/siteSettings.json` holds two numbers, both `visibility: "to-confirm"`: a Turkish and an
Iraqi line. Neither renders. Emails are partly resolved — two are public
(`President.tr@ifb-us.org`, `ifbiturkiye@gmail.com`) and one is marked internal
(`sidikasire@gmail.com`) and never renders.

The contact section currently states that contact is by email only, which is accurate rather
than a workaround.

**Needed:** confirmation of which numbers, if any, may be published. Also relevant to
`CONTACT_TO_EMAIL` — the contact form has no delivery address configured yet.

---

## Section 18 — sign-off

All four fields in `data/deliverables.json` → `signOff` are empty:

- [ ] `clientReviewedOn`
- [ ] `allTitlesConfirmed`
- [ ] `exclusionsConfirmed`
- [ ] `approvedForPublicationBy`

Until all four are complete the site stays `noindex` and the draft banner renders on every
page. Note that indexing additionally requires `NEXT_PUBLIC_ALLOW_INDEXING=true` at deploy
time — a deliberate second gate, so nobody indexes the site by ticking a checkbox.

---

## Not blocked on a question

These need a decision rather than an answer from the client:

- **`siteUrl` is a placeholder.** `https://sidikasire.com` with `domainConfirmed: false`.
  Intake section 13 records *Website: Not supplied*. `lib/seo.ts` and `app/sitemap.ts` both
  read it, so canonical URLs and the sitemap are wrong until the real domain is set.
- **`social: []`.** LinkedIn was not supplied. The footer rail renders nothing rather than
  dead links. Adding any social profile is a one-line entry (`{ id, label, url }`) — no code
  change needed.
- **Register entries outstanding for five of six organisations.** Only ifb-us.org is
  confirmed. The register note renders on the draft page as a reminder and disappears at
  sign-off.
- **Contact form has no delivery address.** `RESEND_API_KEY` and `CONTACT_TO_EMAIL` are
  unset, so `POST /api/contact` returns 503. Related to Q6.

---

## Deliberate — do not "fix" these

Two empty fields look like gaps and are not:

- **`identity.honorific` must stay empty.** The 2024 honorary doctorate is not from a
  recognised university, so `Dr.` cannot precede this name in any language. It is a banned
  term in `lib/verification.ts`, rejected on save with a 422, and it fails the build gate.
  This does not change if the client asks for it — an override still cannot unlock a title
  prefix.
- **`positions.previous: []`** is intake section 4 left blank on purpose (*"only include if
  they add weight"*), not an omission.

Likewise, the empty sections on the live page — quote, stats, press, achievements — are
hidden by `getSectionAvailability()` in `lib/profile-content.ts` and reappear on their own
once the underlying data arrives. They do not need to be re-enabled by hand.

---

## Chasing list

Ordered by how much each unblocks:

1. **Q3** — unblocks the full bio, the About page, the stats block and the achievements list.
   Four deliverables, one answer.
2. **Q5** — unblocks every image and the one-pager PDF. Remember it is *file + permission*.
3. **Q4** — six date lines, and the career start year.
4. **Q1** — two languages, four cells.
5. **Q6** and **Q2** — contact details; smallest scope, but Q6 also decides where the contact
   form delivers.
6. **Section 18 sign-off** — last, once the above are settled and the titles have been
   confirmed in writing.
