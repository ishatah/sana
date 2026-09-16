# Content gaps, client CL-02-SR

What is still missing from the profile, and which question unblocks each item.

Generated from `data/*.json` and the output of `npm run check:copy`.
Baseline at time of writing: **0 banned-wording violations · 13 publication blockers ·
5 outstanding items**.

> This file previously described **CL-01-SS**, a different subject entirely (Türkiye,
> Adana, IFB/IFBI, `sidikasire.com`). Every fact in it was wrong for this project. It has
> been rewritten against the live data. If it disagrees with
> `npm run check:copy`, the command is right and this file is stale.

> Nothing on this site is published until intake sections 15 and 18 are both complete.
> Every gap below is a live blocker, not a nice-to-have. The site renders a draft banner
> on every page and is excluded from every search index until they close.

---

## The nine open questions

Source of truth: `data/deliverables.json` → `openQuestions`.

### Q1, Names and details of the two commercial ventures

**Blocks:** two rows on `/roles` and the home roles band.

`data/positions.json` holds `venture-partnership-1` and `venture-partnership-2` with
`organisation: ""`, `city: {}` and `publish: false`. The role is known
(`Partner` / `شريكة مساهمة`) because the supplied profile states it; the company names
are not. Intake section 1 records them as *"الأسماء والتفاصيل تُزوَّد لاحقًا وتُعتمد قبل
النشر"*, supplied later and approved **before** publication.

The file's own comment is the standing instruction: naming them now *"is exactly the
fabrication the gate exists to prevent"*. Flip `publish` to `true` only once the names
are recorded in writing.

**Needed:** the two company names, and approval to publish each.

---

### Q2, Start date for the IBC role, and the period for the membership

**Blocks:** the date line on `/roles`, the home roles band, and the membership entry.

`data/positions.json` → `ibc-consultant.startYear` is `""`, and
`data/awards.json` → the IBC membership `period` is `""`. Both surfaces render
*"Start year to be confirmed"* / *"Period to be confirmed"* in italic warning colour
rather than omitting the line, because silence would read as "no date available".

`data/identity.json` → `careerStartYear` is also empty, so the About fact list omits
that row entirely rather than deriving a year from the "10+" answer.

**Needed:** the month and year the IBC role began, and the membership period.

---

### Q3, Which contact channels may be published

**The highest-impact gap on the site.** A visitor on `/contact` today can reach her
through **zero** channels.

`data/siteSettings.json` → `contact.emails`, `contact.phones` and `contact.addresses`
are all `[]`. Intake section 6 defers every one of them: *"لا يُنشر في هذه المرحلة"* for
the phone and WhatsApp, *"يُزوَّد لاحقًا"* for the email, which is to be an official
mailbox on the domain once that domain exists (Q4). Section 6 separately forbids
publishing the home address at all.

The contact page therefore shows the country, the enquiry cards and the form. The
address block falls back to `cityOnly` ("Netherlands" / "هولندا").

⚠️ **The form does not deliver either.** `app/api/contact/route.ts` returns **503** while
`RESEND_API_KEY`, `CONTACT_TO_EMAIL` and `CONTACT_FROM_EMAIL` are unset. Answering Q3
is necessary but not sufficient: the env vars must also be configured, and Q3 decides
where the mail goes.

**Needed:** which of the email, phone and WhatsApp may be published, and the address
the form should deliver to.

---

### Q4, Domain choice

**Blocks:** `siteUrl`, every canonical URL, the sitemap, and the official mailbox.

`data/siteSettings.json` → `siteUrl` is `"https://sanaerakik.com"` with
`domainConfirmed: false`. It is a **placeholder, not a chosen domain**. Intake section 7
asks هبّة to propose available domains built on her name and to have one approved.

`lib/seo.ts` and `app/sitemap.ts` both read it. The mitigation already in place: while
`domainConfirmed` is false the JSON-LD uses a fragment-only `@id: "#person"` and omits
`url` entirely, so no identity claim is made on a host nobody owns yet.

**Needed:** one domain approved from the shortlist.

---

### Q5, Social account handles

**Blocks:** the footer rail and the hero social rail.

`data/siteSettings.json` → `social: []`. Intake section 9 records Instagram, Facebook,
LinkedIn and TikTok/YouTube/X all as *"لم يُزوَّد"*, not supplied. A unified handle is to
be proposed after the domain is approved.

Both rails render nothing rather than dead links. Adding a profile is a one-line entry
(`{ id, label, url }`), no code change needed.

**Needed:** the handles, or confirmation that none are to be linked.

---

### Q6, May the city be named

**Blocks:** `identity.mainCityOfWork` and `identity.placeOfBirth`, both `{ en: "", ar: "" }`.

Intake section 6 gives *"هولندا (المدينة تُحدَّد لاحقًا إن رُغب في ذكرها)"*, the country
only, with the city to be decided later **if** she wants it named. The country renders
everywhere the city would.

**Needed:** the city, or confirmation that country-only is final.

---

### Q7, A horizontal image at 1920px or wider

**Blocks:** the `hero-background` slot, and a colour palette decision.

`data/media.json` → `hero-background` has `path: ""` and `permission.granted: false`, so
`lib/media.ts` resolves it to `null` and the hero paints its built CSS backdrop instead.

Both supplied photographs are only **1206px** wide. `data/media.json` records that
upscaling them would violate the intake's rule against low-quality images, so the wide
crop is used for the social share card and nothing is stretched into the hero.

**Needed:** a horizontal image ≥1920px, and whether a palette is to be approved.

---

### Q8, Years of experience, "close to ten years" or "10+"

**Not from the intake form. Found in review, and live on the page right now.**

`data/biography.json` → `microBio` (en) says *"close to ten years"*, which is **under**
ten. `data/identity.json` → `yearsOfExperience` is `"10+"`, which is **over** ten. Both
render, on the same page: the bio in the About prose, the figure in the hero stat bar
and the About fact list.

They cannot both be right, and the figure is the one a reader treats as verified.
Nothing was guessed, `"10+"` is left exactly as supplied.

**Needed:** which is correct. Fix by editing `data/identity.json` alone, every surface
interpolates from that one field, plus the bio wording if the prose is the wrong one.

---

### Q9, Proficiency level per language

**Not from the intake form. Live on the page right now, and the only question here whose
answer replaces something already published rather than filling a blank.**

Intake section 8 is one of two MUST CONFIRM fields on the whole form: *"Never assume a
language level from the material supplied"*. No level was ever supplied.

Levels were nevertheless set in `data/expertise.json` by inference, at the client's
explicit instruction after that conflict was put to them, and an **English row was added
that is not on the form's language list**. What holds the line:

- every inferred row carries `status: "inferred"`, a third value beside `confirmed` and
  `to-confirm`, so the inference is visible in the data and not only in a commit message
- each row records a `_basis` string, so the four inferences can be audited one at a time
- the page renders `expertise.levelInferred` beside them, so a visitor is told the levels
  are not her own answers
- **no proficiency is emitted into the JSON-LD at all.** `knowsLanguage` states that she
  knows each language, which intake does support, and nothing about how well

**Needed:** her own speaking and writing level for Dutch, Arabic, English and French, and
confirmation of whether English belongs on the list. Then set `status: "confirmed"` per
row and the on-page caveat disappears by itself, no code change.

---

## Section 18, sign-off

All four fields in `data/deliverables.json` → `signOff` are empty:

- [ ] `clientReviewedOn`
- [ ] `allTitlesConfirmed`
- [ ] `exclusionsConfirmed`
- [ ] `approvedForPublicationBy`

Until all four are complete the site stays `noindex` and the draft banner renders on
every page. Indexing additionally requires `NEXT_PUBLIC_ALLOW_INDEXING=true` at deploy
time, a deliberate second gate, so nobody indexes the site by ticking a checkbox.

---

## Media assets

From `data/deliverables.json` → `mediaAssets`. Two received, three outstanding:

| Asset | Received | Note |
|---|---|---|
| Formal portrait photo | ✅ | Live. Cutout derived by `scripts/build-portrait-cutout.mjs` |
| Wide studio photo | ✅ | Live, used as the OG/share card |
| Horizontal image, 1920px+ | ❌ | Q7, hero backdrop |
| Organisation logos, with permission | ❌ | **File and permission are two different things** |
| Personal logo or monogram | ❌ | If one exists |

On the logos: holding a file is not permission to publish it. Using the IBC mark on a
personal profile without the council's written agreement damages the relationship the
profile exists to represent. Record who granted it, when, and what the grant covers.

---

## Not blocked on a question

These need a decision rather than an answer from the client:

- **Register entry outstanding for IBC.** `positions.json` → `registerConfirmed: false`
  and `organisationUrl: ""`. The row renders *"Register entry pending confirmation"* on
  the draft page and that note disappears at sign-off.
- **Contact form delivery.** `RESEND_API_KEY` and `CONTACT_TO_EMAIL` unset, so
  `POST /api/contact` returns 503. Related to Q3.

---

## Deliberate, do not "fix" these

Empty fields that look like gaps and are not:

- **`identity.honorific` must stay empty.** Intake section 6 gives the approved name
  format as *"سناء رقيق" / "Sanae Rakik"*, explicitly *"دون لقب"*, without a title. No
  prefix is used anywhere on this site, in any language. `lib/verification.ts` rejects
  one on save with a 422 and it fails the build gate. This does not change if the client
  asks for it; an override still cannot unlock a title prefix.
- **`positions.previous: []`** is intake section 4 left blank on purpose, not an omission.
- **`biography.stats[].value` all `null`.** Intake section 4: *"لا توجد جوائز أو أرقام أو
  صفقات قابلة للنشر والتحقق في هذه المرحلة"*. Section 3 separately forbids *"أرقام ونِسب
  غير موثقة"*. The counter section renders nothing rather than a fabricated or zeroed
  figure.
- **`biography.achievements: []` and `press: []`.** Section 4 records achievements as
  none publishable, and media as *"غير مطلوب حاليًا"*, not requested at this stage.
- **Languages now carry INFERRED proficiency levels, and that is a live exception to the
  rule above.** This entry used to read "languages carry no proficiency levels", which was
  the correct position: section 8 marks language level MUST CONFIRM, *"Never assume a
  language level from the material supplied"*, and none was supplied. Levels were
  nevertheless set in `data/expertise.json` by inference at the client's explicit
  instruction after the conflict was put to them, and an English row was added that is not
  on the form's language list either. Every such row carries `status: "inferred"` and the
  page labels it with `expertise.levelInferred`, so the inference is disclosed to a reader
  rather than passed off as her own answer, and no proficiency is emitted into the JSON-LD
  at all. It is still an inference. **Q9 is the fix and it is a real blocker, not
  housekeeping:** her own answers, then `status: "confirmed"`, and the caveat removes
  itself.

The empty sections on the live page, stats, press, achievements, are hidden by
`getSectionAvailability()` in `lib/profile-content.ts` and reappear on their own once
the underlying data arrives. They do not need to be re-enabled by hand.

---

## Chasing list

Ordered by how much each unblocks:

1. **Q3**, the contact channels. The site currently offers a visitor no way to make
   contact at all, and this also decides where the form delivers.
2. **Q4**, the domain. Unblocks canonicals, the sitemap and the official mailbox, which
   Q3's email depends on.
3. **Q1**, the two venture names. Two held rows and a blocked deliverable, one answer.
4. **Q2**, the dates. Clears the pending-date lines from every roles surface.
5. **Q8**, the years contradiction. One field, and it is visibly wrong today.
6. **Q9**, the language levels. Ranked here, above the cosmetic items, because it is the
   only open question where the site is currently showing an inference of ours rather
   than a blank, and one reply retires it.
7. **Q7** and **Q5**, the hero image and the social handles.
8. **Q6**, the city. Smallest scope.
9. **Section 18 sign-off**, last, once the above are settled and the titles have been
   confirmed in writing.
