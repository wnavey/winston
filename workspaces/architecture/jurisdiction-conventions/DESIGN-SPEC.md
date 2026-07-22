# Jurisdiction Conventions — Source of Truth

**Status:** Draft v1
**Date:** 2026-07-22
**Supersedes:** winston#182 "Path B" (the deferred jurisdictions-table work). Inherits #182's D1 (canonical id = Bureau slug) and D8 (named-token labeling schemes) unchanged.
**Repos touched:** `substation` (migration: 2 new tables + FK + seed; read-only jurisdictions API; sync endpoint; CRV PDF reads DB; delete inline dict), `cityhall` (reads substation API; delete `departments.ts` dept map + `SLUG_SCHEME` map; unverified-name indicator), `bureau` (per-jurisdiction `conventions.yaml` + linter check + sync Action; CRC workflow resolves dept names at run time), `claude-plugins` (generate-crc-guides + siblings read DB instead of TSVs; HITL bootstrap writes DB rows), `conductor` (final phase only: review-saver stops writing `jurisdiction_organization_id`)
**Repos NOT touched:** `surveyor` (its slug-keyed `jurisdictions/<slug>.md` configs already work), `dsd` / Library-DB `jurisdictions` table (separate Supabase project, GTM lifecycle — explicit non-goal), `inspector-general`

---

## Problem

Jurisdiction conventions — department prefix→name maps, submission numbering (U0/U1), which departments arrive via redlines vs. the MCR, dept→discipline mappings — have **no source of truth**. They were invented ad hoc, copied, and drifted.

### The incident that forced this (2026-07-22)

CRC review `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (Lamar + Collier) displayed comment groups named **"One Water Bureau"**, **"Parks Board / Parkland"**, **"Construction Management"**, and **"Austin Water — Resource Recovery"** — all four invented by an LLM at skill-creation time (claude-plugins commit `aebbb19`, 2026-06-19) and never verified against Austin's org chart. Correct names: Onsite Water Benchmarking, Site Plan Plumbing, Case Manager, Austin Water Reclaim & Reuse.

Worse, the cityhall UI and the Comment Response Review PDF **disagreed** for the same review: the UI showed the (fixed) "Site Plan Plumbing" while the PDF showed "Parks Board / Parkland" — because `substation/src/pdf/dept-prefix-dict.ts` is an inlined copy of the claude-plugins dict whose "keep in sync" doc comment was the only sync mechanism, and it drifted for a month. Its resolution chain (dict → `applicableArea` → bare prefix) meant the stale dict **overrode correct data** already present in `review_comments`.

Remediation took: claude-plugins#161 + substation#171 (both merged 2026-07-22), plus a prod DB patch across 5 reviews / 76 `review_comments` rows including a section-slug migration (cityhall derives section slugs from `sectionName`, so renaming a name orphans comments unless slugs move in lockstep).

### The convention data is scattered across ≥11 stores

| # | Store | Holds | Failure mode |
|---|---|---|---|
| 1 | `organizations` (app DB) | jurisdiction display name via `reviews.jurisdiction_organization_id` | conflates customers + cities. Prod: "City of Austin" org owns 11 projects; Dunaway's projects span `austin` **and** `cedar-park`; winston#182 documented a review whose "jurisdiction" org was `pape-dawson` (a civil firm) |
| 2 | `project.jurisdiction_slug` (app DB) | canonical Bureau slug | TEXT, no FK; slug validity enforced by a 57-element allowlist frozen inside migration `20260720203333` |
| 3 | Library DB `jurisdictions` | GTM/prospector market data | no slug column; unjoinable to the app DB |
| 4 | `bureau/jurisdictions/<slug>/` | codes, review-guides, CC checklists, workflows | the de-facto slug registry (57 dirs); only Austin has a full profile |
| 5 | `claude-plugins .../dept-prefixes/<slug>.tsv` | CRC dept prefix→name | the OWB source; corrected + per-jurisdiction as of #161, but still a repo file no runtime can query |
| 6 | `substation/src/pdf/dept-prefix-dict.ts` | inlined copy of #5 for the CRV PDF | drifted for a month; sync-by-comment |
| 7 | `cityhall/src/lib/departments.ts` | 23 lowercase dept codes → names for review-run display | a fourth independent dept-name map (different vocabulary — see D22) |
| 8 | `cityhall` + `substation` `src/lib/jurisdiction.ts` | `SLUG_SCHEME` (austin → `U_ZERO_BASED`) + adapters | byte-identical duplicates; #182 D17 flags the drift footgun |
| 9 | `claude-plugins .../atomic-mcr/references/taxonomy-austin.json` | comment-prefix → department → discipline, incl. 4 SPLIT depts | Austin-hardcoded in a skill reference |
| 10 | `bureau .../mcr-convert/prompts/convert-mcr.md` | dept→discipline mapping (`aw→WWP`, `ev→EPTP/FWP`…) | hardcoded in prompt prose; likely stale |
| 11 | `surveyor/jurisdictions/<slug>.md` | GIS/source tooling config | healthy (slug-keyed) but disconnected |

### The three review workflows key on different taxonomies

- **review** (formal): universal discipline codes (`wwp`, `sde`, …) as `guideCode`; reads `bureau/jurisdictions/<slug>/review-guides/<code>/`.
- **comment-resolution-check**: city dept prefixes (`OWB`, `TPW`, …) parsed out of generated guide H1s (`header-parse.ts`); its `jurisdiction` workflow input exists but is consumed by nothing.
- **completeness-check**: versioned `cc-N` checklist items, jurisdiction-keyed by directory.

Names flow verbatim from these stores onto applicant-facing surfaces (`review_comments.sectionName` → cityhall UI; dict → CRV PDF). **A wrong name anywhere ships to applicants.**

---

## Design

### Core model: registry/profile split with per-row provenance

- The **`jurisdictions` row** (slug, names, status, labeling convention) is a *registry entry*. Registry entries can be created from either side — a DB-first row is legal (bare-bones "this jurisdiction exists").
- The **conventions** (department rows, JSONB extras) are the *profile*. Every profile row carries provenance: `origin: 'bureau' | 'app'`, `verified`, `bureau_commit`.
- **Bureau is canonical; the DB is a replica** (Option C). `bureau/jurisdictions/<slug>/conventions.yaml` is the PR-reviewed, human-ratified source. A dedicated sync upserts it into the DB on merge.
- **Sync reconciles, bureau wins.** Sync supersedes any app-origin row with the same key `(jurisdiction_slug, prefix)` (flips `origin→'bureau'`, `verified→true`, stamps `bureau_commit`). Sync **never deletes** app-origin rows bureau doesn't know about — it flags them unreconciled (surfaced as a to-do, not silent drift).
- **Invariant (the OWB lesson, structural):** anything applicant-facing that came from the app side is visibly *unverified* in internal UIs until bureau ratifies it — but it renders (the HITL operator supplied it deliberately; blocking renders would re-block game days).

`status` gates *what can run*, not *whether the jurisdiction may exist*: `prospect` = registry row only (projects may point at it; CRC game days may run); `active` = bureau dir with regulations exists (formal review requires this by construction — it reads bureau review-guides).

### Schema (app DB, `mgxqsrjutswbciyrltwd`)

```sql
CREATE TABLE jurisdictions (
  slug        TEXT PRIMARY KEY,                 -- Bureau slug: 'austin'
  name        TEXT NOT NULL,                    -- 'City of Austin'
  short_name  TEXT,                             -- 'Austin'
  status      TEXT NOT NULL DEFAULT 'prospect'
              CHECK (status IN ('prospect','active')),
  submission_label_convention TEXT,             -- token, e.g. 'U_ZERO_BASED'; adapters stay in code
  conventions JSONB NOT NULL DEFAULT '{}',      -- long-tail escape hatch (see D9)
  bureau_commit TEXT,                           -- last synced bureau commit for this jurisdiction
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE jurisdiction_departments (
  jurisdiction_slug TEXT NOT NULL REFERENCES jurisdictions(slug),
  prefix          TEXT NOT NULL,                -- 'OWB' (city comment-ID prefix, uppercase)
  display_name    TEXT NOT NULL,                -- 'Onsite Water Benchmarking'
  comment_source  TEXT
                  CHECK (comment_source IN ('mcr','redlines','both')),
  discipline_codes TEXT[],                      -- ['WWP']; SPLIT depts: ev → ['EPTP','FWP']
  origin          TEXT NOT NULL DEFAULT 'bureau'
                  CHECK (origin IN ('bureau','app')),
  verified        BOOLEAN NOT NULL DEFAULT true, -- false for app-origin rows until bureau ratifies
  bureau_commit   TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (jurisdiction_slug, prefix)
);

ALTER TABLE project
  ADD CONSTRAINT project_jurisdiction_slug_fkey
  FOREIGN KEY (jurisdiction_slug) REFERENCES jurisdictions(slug);
```

Deliberately trimmed (retrofit when a consumer appears): `aliases`, `active`/soft-delete on department rows, a `disciplines` table (universal disciplines stay bureau-only in `workflows/train/disciplines.json`).

**RLS:** both tables service-role only. No anon/authenticated policies. The substation API is the only browser-facing read path.

### Rejected: a generic `jurisdiction_conventions` key-value table

A KV table gives rows without schema: per-row lifecycle but no typed columns, every read a `WHERE key='...'` string match over untyped values, and no natural home for per-row provenance semantics that differ by convention type. The hybrid above provides typed columns where the data is hot (departments — every consumer does `WHERE prefix = $1` lookups with per-row `verified` lifecycle) and JSONB where it's cold. The `jurisdictions.conventions` JSONB column is the escape hatch for singleton, one-consumer conventions (e.g. comment-status vocabulary `Pending/New/Rejected` keep vs `Cleared/FYI` drop, MCR text-parsing quirks); a key that gains a second consumer or per-row lifecycle gets promoted to a real column/table.

### Bureau side: `conventions.yaml`

One file per jurisdiction: `bureau/jurisdictions/<slug>/conventions.yaml`. Draft v1 schema:

```yaml
name: City of Austin
short_name: Austin
submission_label_convention: U_ZERO_BASED
departments:
  - prefix: OWB
    display_name: Onsite Water Benchmarking
    comment_source: mcr
    discipline_codes: [WWP]
  - prefix: AW
    display_name: Austin Water
    comment_source: redlines
    discipline_codes: [WWP]
  # ...
conventions:            # → jurisdictions.conventions JSONB, verbatim
  comment_status_vocabulary:
    keep: [Pending, New, Rejected]
    drop: [Cleared, FYI, Informational]
```

- A **bureau linter check** (`bureau/tooling/`) validates the schema in CI — a malformed PR fails before sync ever sees it.
- **Sync trigger:** GitHub Action in bureau, on merge-to-main touching `jurisdictions/*/conventions.yaml`, POSTs the parsed payload to a service-authed substation sync endpoint (write logic lives in one place — substation owns the DB). Push-on-merge, no polling.
- DB rows written by sync carry the bureau commit hash. **Manual edits to bureau-origin DB rows are prohibited** — the sync is one-way and will clobber them; that is the design.

### Substation API (read-only, v1)

- `GET /jurisdictions/:slug` → `{ slug, name, short_name, status, submission_label_convention, conventions, departments: [...] }`
- `GET /jurisdictions` → registry list (for the project-viewer jurisdiction dropdown)
- In-memory cache, ~60s TTL, no invalidation machinery (conventions change ~never at runtime).
- No write endpoints in v1. Writes happen via bureau sync + skill HITL only.

**Who reads what:**

| Consumer | Path |
|---|---|
| cityhall (UI + SSR) | substation API (deliberate precedent: no new direct-supabase reads for this data) |
| substation CRV PDF renderer | in-process DB read |
| claude-plugins skills | direct DB via Supabase MCP (operator tools, as today) |
| conductor workflow scripts | direct DB via the run's Supabase token |

### Runtime resolution replaces baked-in names

- **CRC guides slim to prefix-only.** `generate-crc-guides` stops embedding department display names in guide H1s (H1 becomes `# CRC — {PREFIX} — {project} v{n}`). The CRC workflow (`enrich-findings.ts` via `header-parse.ts`) resolves `prefix → display_name` from `jurisdiction_departments` at run time; `build-crc-review-comments.ts` consumes the resolved name. A future name fix is **one DB row** (via one bureau PR) — no guide regeneration, no bucket patching, no `review_comments` migration.
- **Run-time miss = hard-fail.** If the CRC workflow encounters a prefix with no DB row, it fails early at `fetch-crc-guides` with a clear error. No bare-prefix fallback — silent fallback is exactly the drift failure mode. Generation-time HITL means this should never fire; when it does, something is genuinely wrong.
- **Generation-time unknown prefix = HITL.** `generate-crc-guides` (and siblings) resolve prefixes against the DB. An unknown prefix pauses for HITL: the operator supplies the real name; the skill (a) INSERTs the row immediately (`origin='app'`, `verified=false`) so the run proceeds, and (b) drafts the bureau `conventions.yaml` PR that, once merged + synced, ratifies the row (`origin→'bureau'`, `verified→true`). The claude-plugins `dept-prefixes/<slug>.tsv` files (added in #161) are transitional and retire once skills read the DB.
- **Unverified rendering:** applicant-facing PDFs render app-origin names normally, no marker. Internal UIs (cityhall) show an "unverified" indicator on names from `verified=false` rows.

### Jurisdiction derivation for reviews

Reviews **derive** jurisdiction from `project.jurisdiction_slug` at run-kickoff time. No `reviews.jurisdiction_slug` column.

> **Assumption A1 (Will, 2026-07-22): a project never changes jurisdiction.** The spec deliberately does not support historical reviews carrying a different jurisdiction than their project. If this assumption ever breaks, revisit with a stamped column.

### Organizations cleanup (final phase)

The jurisdiction-as-organization misuse ends: cityhall's project viewer switches to `project.jurisdiction_slug` + `jurisdictions.name/short_name`; conductor's review-saver stops writing `reviews.jurisdiction_organization_id`; readers migrate; the column drops; jurisdiction rows in `organizations` ("City of Austin", "City of Cedar Park") are soft-deleted. `organizations` returns to meaning *customer organizations* only.

---

## Decisions

Numbered for audit reference. (Grill log with Will, 2026-07-22, three batches.)

- **D1.** Canonical jurisdiction id = Bureau slug; `jurisdictions.slug` is the natural PK (no uuid). *(inherits #182 D1)*
- **D2.** This spec supersedes winston#182's Path B.
- **D3.** Architecture = Option C: bureau-canonical `conventions.yaml`, one-way structured sync to typed app-DB tables. Not pure-DB (loses PR governance — the OWB lesson), not pure-files (serverless can't fs-read bureau).
- **D4.** One `conventions.yaml` per jurisdiction (not multiple small files): one review unit, one linter schema, one sync unit. Holds slug→display names, dept prefix map, labeling token, JSONB extras.
- **D5.** Dedicated sync (bureau GH Action on merge → substation service-authed endpoint), not the existing `bureau_nodes` replica (that's embedding-oriented content storage, not typed rows).
- **D6.** DB rows carry `bureau_commit`; one-way sync; manual edits to bureau-origin rows prohibited.
- **D7.** Registry/profile split with per-row provenance (`origin`, `verified`); sync supersedes matching app rows, never deletes, flags unreconciled.
- **D8.** `status ∈ {prospect, active}`. `prospect` = registry row only; `active` = bureau regulations exist. Status gates what runs, not existence. A `prospect` jurisdiction CAN run a CRC game day (CRC needs an MCR, not bureau codes); formal review requires `active` by construction.
- **D9.** Two-table schema as specified. Departments are a normalized table (hot row-level lookups + per-row lifecycle); `jurisdictions.conventions` JSONB is the long-tail escape hatch; generic KV `jurisdiction_conventions` table rejected. Trimmed: no `aliases`, no `active` flag, no disciplines table (bureau-only), retrofit on demand.
- **D10.** `submission_label_convention` column stores the named token (`'U_ZERO_BASED'`); adapters stay in code. *(inherits #182 D8; short column name chosen over `submission_iteration_label_convention`)*
- **D11.** `discipline_codes TEXT[]` on department rows (SPLIT depts get multiple entries). Mapping recorded in DB now; consumers (`atomic-mcr` taxonomy, `convert-mcr` prompt — likely stale) migrate later.
- **D12.** V1 convention set: display names, dept prefix→name, `comment_source` (mcr/redlines/both), dept→discipline, labeling token, JSONB extras. Out: portal metadata, surveyor configs, CC checklist-version pointers.
- **D13.** `project.jurisdiction_slug` gets a real FK; registry seeded with all 57 bureau slugs (`prospect` except austin `active`). The registry becomes the ONLY slug allowlist — no more allowlists frozen in migrations.
- **D14.** Library DB `jurisdictions` untouched (separate Supabase project, GTM lifecycle). Non-goal.
- **D15.** All inline dictionaries deleted: `substation/src/pdf/dept-prefix-dict.ts`, `cityhall/src/lib/departments.ts` (dept-name map — see D22 scope note), both `SLUG_SCHEME` maps. Replaced by runtime reads.
- **D16.** cityhall reads via a new read-only substation API (`GET /jurisdictions/:slug`, `GET /jurisdictions`), not direct supabase. Substation PDF reads in-process; skills via Supabase MCP; conductor scripts via run token.
- **D17.** RLS: service-role only on both tables; substation API is the sole browser-facing path. API caches in-memory, ~60s TTL.
- **D18.** CRC guides carry prefix only; the CRC workflow resolves display names from the DB at run time. Run-time miss → hard-fail at `fetch-crc-guides`.
- **D19.** Generation-time unknown prefix → HITL: immediate app-origin DB row (run proceeds) + auto-drafted bureau `conventions.yaml` PR (ratification). Applicant-facing surfaces render unverified names without a marker; internal UIs show one.
- **D20.** Bureau linter validates `conventions.yaml` schema in CI.
- **D21.** Seeding: Austin's `conventions.yaml` drafted by merging the corrected `austin.tsv`, substation's dict, and the unverified extras (`EV`, `F`, `LDE`, `IW`, `RW`, `AW`, `AWPE`, `AD`) — the seed PR review is where Will ratifies those (they were deliberately excluded from claude-plugins#161 as unverified).
- **D22.** V1 `jurisdiction_departments` = **city comment-prefix vocabulary only** (CRC/MCR). cityhall's `departments.ts` review-run display map is a *different vocabulary* (Noetic review-run `department_code`s) and migrates in a later phase, possibly keyed via `discipline_codes`. Do not conflate the two in one table without designing it.
- **D23.** Reviews derive jurisdiction from project at kickoff; no `reviews.jurisdiction_slug`. Assumption A1: projects never change jurisdiction.
- **D24.** Organizations deprecation is the final phase (in-spec, not deferred out).
- **D25.** Acceptance scenario: **cedar-park CRC game day** — bootstrap HITL → conventions exist → CRC workflow + cityhall UI + CRV PDF all render correct names with zero code changes. (A Dunaway project already has `jurisdiction_slug='cedar-park'`.)

## Phases

1. **Migration** (substation): create tables, seed 57 registry rows + Austin profile, add FK.
2. **Bureau**: `conventions.yaml` (Austin), linter check, sync Action + substation sync endpoint.
3. **Substation**: jurisdictions API; CRV PDF resolves from DB; delete `dept-prefix-dict.ts`.
4. **Cityhall**: read API; delete `departments.ts` dept map + `SLUG_SCHEME`; unverified indicator.
5. **Skills** (claude-plugins): generate-crc-guides + siblings read DB; HITL writes rows + drafts bureau PR; retire `dept-prefixes/*.tsv`.
6. **CRC workflow** (bureau): prefix-only guides; runtime resolution; hard-fail on miss.
7. **Organizations deprecation**: viewer on registry, review-saver stops writing, drop `reviews.jurisdiction_organization_id`, soft-delete jurisdiction orgs.

Phases 3–6 parallelize once 1–2 land. Phase ordering constraint: 1 → 2 → (3|4|5|6) → 7.

## Open Questions

- **Q1.** Exact Austin department list ratification (the 8 unverified prefixes) — resolved in the Phase-2 seed PR review, but flagging: if any of those 8 is wrong, it ships. Auditors: sanity-check the names in the seed PR against the MCR PDFs in `crc-guides` bucket / Austin's published org structure.
- **Q2.** `conventions.yaml` v1 key naming (draft above) — auditors: check the YAML shape round-trips cleanly to both tables and that `conventions:` extras can't collide with top-level keys.
- **Q3.** Substation sync endpoint auth mechanism (service key header vs. Inngest event) and API route naming — implementation detail, decide in Phase 2/3 PRs.
- **Q4.** Review-run department vocabulary (D22 deferral): design for migrating `departments.ts` / `reviews.department_code` display onto the registry. Deliberately out of v1.
- **Q5.** generate-crc-guides' Phase-0 `jurisdiction` preflight block (added in claude-plugins#161 today) — extend to record registry `status` + row counts when skills move to DB reads (Phase 5).
- **Q6.** Sync failure observability: does the bureau Action alert (BetterStack?) when the substation sync endpoint rejects a payload? Recommend: yes, minimal — a failed sync is silent drift reborn.
- **Q7.** Whether `GET /jurisdictions` list endpoint should filter by `status` for the project-viewer dropdown (probably yes — `prospect` rows are assignable, so probably no filter; confirm UX in Phase 4).

## Prior art / references

- winston#182 — `workspaces/comment-resolution-check/jurisdiction-correction-and-submission-labeling/DESIGN-SPEC.md` (P2 problem statement, D1, D8, D17, Path A migration `20260720203333`).
- claude-plugins#161 (merged 2026-07-22) — per-jurisdiction `dept-prefixes/<slug>.tsv` + HITL bootstrap; transitional, retired by Phase 5.
- substation#171 (merged 2026-07-22) — CRV PDF dict corrections; the dict itself deleted in Phase 3.
- The 2026-07-22 DB patch: 5 CRC reviews / 76 `review_comments` rows, name + section-slug migration (the incident this spec prevents from recurring).
