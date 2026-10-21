# Intake tiers and the site-plan golden set (exploratory handoff)

**Status:** Draft v1 — exploratory handoff, not an implementation spec (no testing seams or PR plan yet, by Will's call)
**Date:** 2026-10-21
**Repos touched:** `winston` (this folder: the taxonomy, the golden set, its evidence)
**Repos NOT touched:** `bureau` (the `intake-prospecting` runbook is unchanged; §6 says how to test it), `dsd` (Library DB read only), `cityhall`

This folder holds everything a later session needs to continue the work:

| Path | What |
|---|---|
| `DESIGN-SPEC.md` | this document |
| `golden-set.json` | 34 jurisdictions, each with tier, confidence, set (`core` / `extended`), application, and the full research record (quotes, URLs, file pointers) |
| `evidence/<id>/` | text of every source a quote cites (11 MB, 130 files; El Paso includes one Library `historic_comments` row), so each quote can be checked without the web |
| `verify_quotes.py` | checks every quote against its evidence file: `python3 -I verify_quotes.py --misses` → `total checked 174, missing 0` on 2026-10-21 |
| `tools/` | `fetch-page.mjs` (Playwright, gets past amlegal/ecode360/municode bot walls), `ocr.swift` + `ocrpdf.sh` (macOS Vision OCR for scanned minutes; `swiftc ocr.swift -o ocr` first), `build_golden.py` (historical record of how the JSON was assembled) |

## 1. Problem

We want to know, reliably, whether a jurisdiction has an intake (completeness-check) step for
**site plans**, because the product is an agentic reviewer that automates the back-and-forth
between the submitter and the city **before** the submission is promoted to formal review. A city
with no such loop has nothing for that product to automate.

The `intake-prospecting` runbook (bureau, merged in #2112) already decides something nearby, but
not this. Its `1.4-classify` step (`runbooks/intake-prospecting/steps/1.4-classify/prompt.md:11`,
bureau `origin/main` f83e018a30) returns

- `formal` when "a published intake, submittal or application checklist for the application type
  that carries the site plan" exists,
- `none_found` when nothing like that exists and the ledger's negative attempts say so,
- `inconclusive` otherwise,

writing `basis.json` `{schema_version: 1, basis, application_type, scope_sources, rationale,
evidence}` (`prompt.md:25`). That answers "is a checklist published", which this work found is a
different question from "is there a gate". Decorah IA publishes a site plan checklist and has no
gate (§5.3); Fremont NE has a gate and no published list (§5.2).

The original plan (Will, 2026-10-20): (1) find jurisdictions we are confident DO have intake,
(2) find ones confident they do NOT, (3) use this golden set to test the runbook. Will's bar:
"I'd rather have 5 positive and 5 negative that we feel REALLY confident about… rather than 10/10
that we are medium confident about."

Steps 1 and 2 are done (§5). Step 3 has not started (§6, §8).

## 2. Decisions (the taxonomy)

**D1: The gate.** Intake = any loop in which the city tells the applicant what is missing and
HOLDS the submission until it is fixed, **before formal review**. In writing or not, by an intake
team, permit tech or clerk at a counter, with a named stage or not — all count (Will, 2026-10-20:
"any kind of loop where the city lists what's missing, and puts a hold on the submission before
formal review, equals intake"; a refusal at a paper counter is "effectively the same thing").

**D2: Three tiers.** Gate yes/no is the strict line; Tier 1 vs Tier 2 splits the "yes" side.

| Tier | Definition | What the product does |
|---|---|---|
| **1** | Gate exists AND we find ANY city-written list of what it checks — even one short document (a completeness/submittal checklist, a required-items list on the application form, code that ties acceptance to an enumerated list) | Builds the checklist from the city's own material |
| **2** | Evidence of the gate (hold + loop), but no city-written list of what it checks anywhere we can find | Future: applies a generic baseline checklist (§9) |
| **3** | No gate: nothing holds the submission before formal review; gaps come back as review comments, or the commission tables or conditions the plan | Nothing to automate |

**D3: The Tier 1 / Tier 2 line measures what we can obtain, not only how the city works.** A
city lands in Tier 2 because it never wrote a list, or because we did not find it. Will accepted
this (2026-10-21): "the line between Tier 1 and Tier 2 feels more indicative of our ability to
extract what the actual intake data is." Record which, when known (`why_no_list`: never_written
| not_obtainable | withdrawn).

**D4: Gaps never demote a Tier 1 city.** Stale published items, undocumented items staff enforce
anyway, and staff judgment at the gate are normal. Austin TX stays Tier 1 although (per Will's
work with the City) some of its published material is stale and staff enforce undocumented items.
Austin and El Paso are both Tier 1; they differ only in list depth.

**D5: Edge-case rulings.**

| Case | Tier | Why |
|---|---|---|
| A short required-items list on the application form, even 5 items | 1 | A city-written list is a list; record the item count |
| Code enumerates site plan contents AND ties the gate to them ("shall not be deemed delivered until all required documents… filed", "will not be accepted for review", "the filing… shall include all information required by this Code") | 1 | The code is the list the gate uses |
| Code enumerates contents only as what review needs; completeness is staff judgment ("substantially complete, as determined by the Administrator") | 2 (if a hold exists) | The list describes review, not the gate |
| A list that survives only on the Internet Archive / was withdrawn | 2 | Not published today; note it (Fremont NE) |
| A required-items list with NO hold (received and forwarded regardless) | 3 | Tier 3 is about the hold, not the list (Decorah IA) |
| Planning Commission tables or conditions an incomplete plan | 3 | The hold happens inside formal review |
| Pre-application meeting, "Preliminary SDP" (Round Rock), concept plan (Denver), "Preliminary Review" (Flint) | not a gate | Early technical review |
| Our own generated checklists (bureau `completeness-check/`, completion-officer) | never evidence | — |

**D6: Rejected along the way** (recorded so they are not reopened without a reason):
- *Per-city knowledge grades (K0–K3) for list depth and verification.* No product action depends
  on them; depth is a recorded number, and verification is a property of individual checklist
  items, not cities (§9).
- *"Fill out thin Tier 1 lists from the baseline."* Never decided; Austin and El Paso were built
  from city material only. Whether to top up a thin list is a separate future product question.
- *"Completeness" wording as the signal.* Nearly every city has some completeness determination
  (statutory in FL/GA/CA/AZ/WA; Texas LGC §245.002(e) is permissive "may"); the word does not
  discriminate.

**D7: Tiers are dated.** A city's tier can change with an ordinance or a state law (Tennessee
Public Chapter 1044 mandates written incomplete-submittal notice from 2027-01-01; Lewisburg TN has
an ordinance pending that adds checklists). Every golden-set entry carries `as_of`; re-verify an
entry older than about a year before trusting it.

**D8: Scope is site plans** — the application that carries the site plan (site development
permit, site plan review, SDP, a commercial building permit when the site plan is reviewed inside
it). Not plats. A golden-set entry must name the application: El Paso commercial building permits
also bounce missing site plans inside formal review ("NO REVIEW PERFORMED 1. Missing site plan"),
while its site plan gate is the Accela "Pre-Application Review".

## 3. Evidence bar

High confidence (the `core` set) requires:

- **Tier 1:** a verbatim quote proving the hold, and the list (title + URL + rough item count) with
  evidence the gate uses it.
- **Tier 2:** a verbatim hold quote, and proof of absence: the official site plan page and its
  forms enumerated in full, the application form read and shown to carry no required-items list,
  the code's submittal language shown not to be tied to the gate.
- **Tier 3:** (a) positive no-hold evidence — the plan goes on receipt to the commission or
  reviewers, the clock runs from filing, no completeness/acceptance clause in the site plan chapter
  or on the form (say what was searched); (b) **practice** evidence — minutes, staff reports or
  review comments showing an incomplete plan entered formal review and was tabled or conditioned;
  (c) the state statute does not mandate a pre-review deficiency loop. Silence alone is never
  enough.

Quotes are verbatim, never paraphrased; each records URL, access date and an `evidence/` file.

## 4. How the set was built (what worked, what did not)

**Sources.**
- **Prospector comments** are in the dsd **Library** Supabase (project `jkbuvkwnrrvunqgrkeol`), table
  `historic_comments`: ~3.47M rows but only 32 of 1,981 jurisdictions. Access through the
  `with-secrets` wrapper with `LIBRARY_SUPABASE_URL` + `LIBRARY_SUPABASE_SERVICE_ROLE_KEY` (now an
  `sb_secret_` key; legacy JWT keys were disabled 2026-09-24). PostgREST times out on unscoped
  jsonb filters; scope every query by `jurisdiction_id`. `raw_metadata` is sometimes a JSON string
  (San Antonio). The App DB (`mgxqsrjutswbciyrltwd`) has no `historic_comments`.
- **Useful in the DB:** stage names. San Antonio's `review_cycle` "Completeness Review" (~35k rows)
  and El Paso's Accela "Pre-Application Review" ("Note: This is only a completeness check. Formal
  technical review begins once all documents are received and fees are paid.") prove a gate.
  Austin's import has no stage field.
- **Not useful in the DB:** first-cycle "missing document" rates do not separate the tiers (San
  Antonio baseline ~0.27%), and the 32 jurisdictions are mostly large Tier 1 cities. The DB will not
  find Tier 2 or Tier 3 cities.
- **Web:** city process pages and forms, code libraries (amlegal, ecode360, municode, zoneomics),
  Planning Commission minutes and packets, the Internet Archive for withdrawn documents.

**Where each tier is found.**
- **Tier 1** is abundant; most cities with a gate publish something. Spares beyond the set:
  Chesterfield County VA, Mesquite TX, Raleigh NC, Louisville KY, Los Angeles County CA, Santa Fe
  NM, Wilmer TX, Defiance OH, The Colony TX, Clayton NC, Jacksonville NC.
- **Tier 2 is rare once any city-written list counts (D2).** The re-sort moved every
  "code-enumerated contents" city but one into Tier 1 (Rockdale, Katy, Papillion, Winchester,
  Sunset Valley, Heppner, Kenansville, Pink Hill), and West Sacramento too. Only Fremont NE is
  high confidence.
- **Tier 3** lives in small places with old, simple codes where the clerk forwards the plan
  straight to the Planning Commission: Michigan townships (the Zoning Enabling Act sets no loop),
  Iowa, Wisconsin, Pennsylvania boroughs. States whose statutes mandate a pre-review deficiency
  loop are dead ends: FL §125.022/§166.033, GA SB 447, CA PSA §65943, AZ ARS 9-835, WV §8A-5-6,
  and TN from 2027. Every Ohio code read had a hold.

**Tier 3 lessons (most of the effort went here).**
- Practice evidence is the bottleneck; searching minutes first for "plans were incomplete",
  "tabled until the applicant provides", "approved contingent upon submission of a lighting plan",
  then reading the code, was the only route that produced a high.
- Practice is necessary but not sufficient: conditioned approvals often led to codes that DO hold
  (Scott County IA, Smithville MO, Windsor WI).
- Always read the administration / zoning-administrator-duties article, not just the site plan
  section; Missouri "forthwith transmit" text is often undercut there, and codes rewritten after
  ~2017 often add "No application shall be accepted… until complete".
- The strongest no-hold evidence is a contrast inside one code: Watertown WI requires rezonings
  and CUPs to be "certified as complete", but not site plans.
- Shared templates split into hold / no-hold variants (Iowa, PA SALDOs, TN's "Incomplete
  information shall result in the site plan being returned").

**Tooling.** amlegal, ecode360, municode and some city sites block headless fetches;
`tools/fetch-page.mjs` (Playwright from surveyor's `node_modules`, full Chromium,
`--headless=new`) gets through. Scanned minutes need OCR; this Mac has no tesseract, so
`tools/ocr.swift` uses macOS Vision. Akamai blocks every `unioncountync.gov` URL from this machine.
Agent-written quotes were wrong about 1 time in 170 (Georgetown "no greater" for "not greater"),
so `verify_quotes.py` is worth running after any edit.

## 5. The golden set (as of 2026-10-20/21)

`core` = high confidence, the set to score against. `extended` = medium/boundary cases, useful for
exploring classifier behaviour, not for pass/fail. Full records are in `golden-set.json`.

### 5.1 Tier 1 — gate + city-written list

| id | Application | The list | Depth |
|---|---|---|---|
| `austin-tx` | Consolidated Site Plan Completeness Check | CC Submittal Checklist (5/6/2024); "Completeness Check Results Letter noting any deficiencies" | ~104 items, deep |
| `fairfax-county-va` | Site plan first submission, Gateway Review | Site Plan First Submission Checklist; Gateway fee $577.50, "comprehensive review will not begin until Gateway passes" | 168 lines, deep |
| `san-diego-ca` | Site Development Permit (SDMC 126.0502), Pre-Screen / completeness review | Minimum Submittal Requirements Checklist; "Staff will review your documents against this checklist" | ~176, deep |
| `georgetown-tx` | Site Development Plan | SDP Application Checklist (UDC Development Manual); UDC 3.02.020 "shall not be considered as officially submitted… until it has been determined to be complete", with a written notice listing missing items | ~40 documents + ~150 sheet items, deep |
| `cedar-park-tx` | Site Development Permit | Application & Checklist (Rev. 01.30.2024); Code §14.03.006 "Incomplete applications shall not be accepted." | ~19 presence + ~70 content |
| `montgomery-county-md` | Site Plan (M-NCPPC) | Site Plan Intake Checklist (3.31.26); Reg 12-23 "within 10 days, either accept the application, or provide initial comments" | ~70, mostly presence |
| `round-rock-tx` | Site Development Permit | SDP packet completeness checklist (Aug 2023) | 23 |
| `el-paso-tx` | DSDP site plan (Accela "Pre-Application Review") | "Required Documentation" list | ~30, thin |

Extended (thin or code-only lists — they test "any city-written list = Tier 1"): `san-antonio-tx`
(no standalone site plan application), `katy-tx` (inside the commercial building permit; 13
documents), `sunset-valley-tx` (code §150.325, ~46 items), `rockdale-tx` and `winchester-mo`
(code-only lists, no form, no practice evidence), `papillion-ne` (15-item checklist, hold only
implied), `west-sacramento-ca` (CUP packet's 13-item site plan checklist), `heppner-or`,
`kenansville-nc`.

### 5.2 Tier 2 — gate, no list found

| id | Set | Hold | Why no list |
|---|---|---|---|
| `fremont-ne` | core | UDC: "If the application is not complete, the Planning Director shall notify the applicant of any deficiencies and shall not process the application until the deficiencies are remedied." | withdrawn: contents deferred to an unpublished "application requirements manual"; the "Site Development Application" link serves a Development Agreement form; the 2017–2023 checklist exists only on Wayback |
| `wallace-nc` | extended | §3.2.A written notice | never_written: defers to an Administrative Manual never published. Tier 1 (1 item) if the Zoning Verification form's "plat map or other suitable diagram" counts |
| `union-county-nc` | extended | UDO 80.010-D5: incomplete applications are "pulled from the processing cycle" | not_obtainable: checklists kept "in the planning department office"; county doc 1280 ("Commercial Development Plan Application", with a checklist) blocked by Akamai — Tier 1 if it opens and is the site plan application |
| `dardenne-prairie-mo` | extended | 2025 P&Z packet: staff "reviewed the items for completeness" before distribution | provisional |
| `clinton-nc` | extended | LDO holds until "complete" (staff judgment) | low; may be Tier 3 |

Tier 2 is short of 5 high-confidence entries and probably will stay that way (§4).

### 5.3 Tier 3 — no gate

| id | No-hold evidence | Practice evidence |
|---|---|---|
| `lenox-twp-mi` | §719.103: Clerk forwards to the PC; only remedy is "Table action and request that the applicant revise the site plan or provide additional documentation" | 2024-01-22: "the storm retention pond was not part of the site plan" → tabled |
| `conway-twp-mi` | PC review standard "(1) Complete application. All required information is provided." | 2024-09-09: "Motion to table the Kreeger Site Plan review until the applicant gives the PC the proper documents" |
| `bangor-twp-mi` | Filed 15 days before the PC meeting "at which the site plan is to be first considered"; "all required information has been provided" is the PC's first standard; no clerk or administrator completeness step | 2023-07-26: "Mr. Hazen stated he knew the site plan wasn't complete" |
| `decorah-ia` | §17.36: zoning administrator reviews and refers; deemed approved if no action in 45 days; fee is the only precondition. **Publishes a checklist, has no hold** | 2021-01-11: tabled "until the plan is completed"; 2024-02-12 "The site plan does not include the legal description…" |
| `greencastle-pa` | SALDO §180-11: reviewed "at its first regular meeting following the date of submittal"; no completeness clause; MPC §508 clock | 2023-02-13: "the plans were incomplete and did not include information related to utilities or stormwater" → tabled; 2023-03-13 tabled pending "a formal lighting plan" |
| `watertown-wi` | §550-145: ZA "Receive, file and forward"; rezonings/CUPs must be "certified as complete", site plans not | 2025-06-23 and 2025-08-11 Site Plan Review Committee approvals contingent on lighting / landscaping plans not yet submitted |

Michigan holds three of six; Iowa, Pennsylvania and Wisconsin one each. Known risks are in each
entry's `note` (Greencastle's form needs copies + fee "before the application will be accepted";
the PC "accepts the submission").

Extended: `cohoctah-twp-mi`, `saukville-wi`, `southern-view-il` (no practice evidence),
`carthage-tn`, `paris-tn` (Tier 3 as of 2026 only, D7), `antis-twp-pa` (Q1).

Ruled out as Tier 3 (they have a gate): Houston TX (permit-tech Pre-Screen with a "Pre-Screen
Resubmit Task"), Colorado Springs CO (§7.5.405 "No application shall be reviewed… until it is
determined to be complete"), Highland / Paw Paw / Pine River Twps MI, Van Meter IA, De Soto KS,
and the rejects listed in the research records.

## 6. How to use the golden set to test intake-prospecting

- The runbook's front half (`0-request` → `1.2-discover` → `1.3-capture` → `1.4-classify`) stops by
  itself at the `1.5-scope` human gate (exit 75). The classifier's answer is
  `1.4-classify/basis.json`; nothing new is needed to collect it. Run each `core` jurisdiction (17
  runs); run `extended` ones to explore.
- **Score gate yes/no first and strictly** (Tier 1 or 2 vs Tier 3) — it is the question that
  matters for the product. Score Tier 1 vs Tier 2 only on gated cities, and read misses there as
  mostly search recall, not judgment (D3). Count "unknown"/`inconclusive` separately from wrong.
- **Today's output can only measure "Tier 1 vs not Tier 1"**: `formal` ≈ Tier 1; `none_found` cannot
  tell Tier 2 from Tier 3. Expected hard cases for the current rule: Decorah (publishes a checklist,
  no gate → likely `formal`, wrong), Fremont (archived checklist), Rockdale/Winchester (list only in
  code).
- The barred list in `1.4-classify/prompt.md:5` already keeps the classifier away from our own
  checklists; keep it that way for these runs.
- Run ops for this runbook (python setsid launch, `CCS_PLAYWRIGHT_FROM=surveyor`, prompts snapshotted
  at setup) are in the memory note `intake_prospecting_impl`. **Ask Will before starting runs.**

## 7. Open questions

**Q1: Does hold wording that is never enforced count as a gate?** Antis Township PA: the planning
page says "Complete proposals must be submitted at least ten days before the next Planning
commission meeting… to be included on the agenda", and the form has a 5-item required list and
warns of "refusals to process applications" (literally Tier 1). But 44 Supervisors and 13 PC
minutes show no refusal, the 90-day clock runs from submission, and gaps are handled by tabling
(Tier 3 in practice). Greencastle carries a milder version of the same risk.

**Q2: Do the two code-only Tier 1 entries need practice evidence?** Rockdale TX and Winchester MO
are high on code text alone (no form, no evidence the screen runs). If Tier 1 "high" should require
evidence that the gate operates, they drop to medium. Both are `extended`, so the core set is
unaffected.

**Q3: Is a one-item form a list?** Wallace NC's Zoning Verification form requires only "plat map
or other suitable diagram". D5 says a short list is a list; whether one generic item counts
decides Wallace's tier.

## 8. Suggested next steps (loose, not a PR plan)

1. Optional quick checks that could move entries: open Union County doc 1280 in a normal browser
   (https://www.unioncountync.gov/home/showpublisheddocument/1280); decide Q1–Q3.
2. Baseline run: the current classifier on the 17 `core` entries (§6), with a small script that
   reads each run's `basis.json` against `golden-set.json` and prints a confusion matrix plus every
   miss with its rationale. Publish the result to inspector-general.
3. Change `1.4-classify` to output `gate` (yes / no / unknown, with its quote) and `tier`, keeping
   `basis` derived from the tier so the rest of the runbook is unchanged (Tier 1 continues to
   extraction; Tier 2 and 3 stop where `none_found` stops today). Re-run and compare.
4. Grow Tier 3 outside Michigan if the classifier looks overfit to the township pattern; leads with
   one missing piece are Saukville WI, Southern View IL, Carthage TN (until 2027), Cheatham County TN
   (practice is strong, but code §9.030 holds).

## 9. Not yet specified

- **Checklist-item provenance.** The nuance Will raised about Austin (stale published items,
  enforced-but-undocumented items) belongs on each checklist item, not on the city: a source
  (city-published / enforced-undocumented / baseline) and a status (current / stale). Intake-stage
  comments in the Library DB (San Antonio's ~35k "Completeness Review" rows, El Paso's
  "Pre-Application Review") are the evidence for "enforced", and comparing them with the published
  checklist would measure how stale a Tier 1 list is.
- **The Tier 2 baseline checklist**: what it contains and when it applies.
- **Re-verification cadence** for dated entries (D7).

## 10. Out of scope

- Plats and subdivision review — Will scoped this to site plans (D8).
- Building the baseline checklist or the item provenance fields — product work for later specs.
- Changing `intake-prospecting` — §8 suggests it; a separate spec or PR decides it.

## Housekeeping left from the session

- The research scratchpad (`/private/tmp/…/intake-golden/`, ~1.1 GB of downloads plus ~3 GB of raw
  Library dumps) is temporary; everything the set depends on is copied into this folder.
- Ida / Powerstation may still hold the legacy Library JWT key, which now returns 401 ("Legacy API
  keys are disabled"); Prospector writes from there would fail until it is replaced with the
  `sb_secret_` key.
