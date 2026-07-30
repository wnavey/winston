# Jurisdiction Conventions — Source of Truth

**Status:** Draft v2 — ✅ **DEV COMPLETE. All 7 phases done** (Phase 7's step 5 cancelled by decision — see D24/D35 revision) (see [Implementation Status](#implementation-status))
**Date:** 2026-07-22 (impl status updated 2026-07-30)
**Supersedes:** winston#182 "Path B" (the deferred jurisdictions-table work). Inherits #182's D1 (canonical id = Bureau slug) and D8 (named-token labeling schemes) unchanged.
**Repos touched:** `substation` (migration: 2 new tables + FK + seed + `workflow_run` grants; read-only jurisdictions API; CRV PDF reads DB; delete inline dict), `cityhall` (reads substation API; delete `SLUG_SCHEME` map; live section-name resolution + unverified-name indicator), `bureau` (per-jurisdiction `conventions.yaml` + linter check + direct-write sync Action; CRC workflow resolves dept names at run time + writes `sectionPrefix`), `claude-plugins` (generate-crc-guides + siblings read DB instead of TSVs; HITL bootstrap writes DB rows; prefix-only H1s), `conductor` (final phase only: review-saver stops writing `jurisdiction_organization_id`), `inspector-general` *(Phase 7 only — added during impl: `on-workflow-completed.ts:74` reads `reviews.jurisdiction_organization_id`; see Q8)*
**Repos NOT touched:** `surveyor` (its slug-keyed `jurisdictions/<slug>.md` configs already work), `dsd` / Library-DB `jurisdictions` table (separate Supabase project, GTM lifecycle — explicit non-goal)

> **Status update (2026-07-30c) — ✅ DEV COMPLETE.** Phase 7 is done and the whole effort is dev-complete. Landed since 30b:
> - **Step 4 (Migration B) — substation #184, applied to prod (verified live):** `reviews.jurisdiction_organization_id` dropped, its FK + index gone, the 365-row `_deprecated_reviews_jurisdiction_org_id` snapshot in place, and the `workflow_run` `organizations` SELECT policy/grant revoked. (Manual apply again skipped the tracking row — backfilled, so `schema_migrations` is 1:1 with the repo.)
> - **Step 5 (soft-delete jurisdiction org rows) — CANCELLED by decision (Will, 2026-07-30).** See the D24/D35 revision below. In brief: the misuse Phase 7 set out to end was the `reviews.jurisdiction_organization_id` *pointer*, not the existence of city-named org rows. A city can legitimately be a **Noetic organization** (a customer owning its own bucket of projects) — distinct from a city as a **jurisdiction** (the registry). Deleting the org rows would conflate those two again in reverse. Decisive evidence: `City of Austin` **owns 11 projects** (`owner_organization_id`) + 8 `project_access` grants — a live customer org; soft-deleting it would orphan them. Migration B already fully de-conflated the data (jurisdiction now derives from `project.jurisdiction_slug` → registry; `organizations` no longer encodes jurisdiction), so step 5 added nothing but risk.
> - **Net:** `organizations` cleanly means *Noetic organizations* (which may be cities); jurisdiction lives entirely in the registry. No design decisions besides the D24/D35 step-5 cancellation. **Nothing left to build.**
>
> **Status update (2026-07-30b) — Phase 7 in flight.** Phase 7 steps 1–3 are done; steps 4–5 remain. Landed since the previous note:
> - **Step 1 (Migration A) — substation #183, applied to prod.** `ALTER TABLE reviews ALTER COLUMN jurisdiction_organization_id DROP NOT NULL`. Verified live: the column is nullable.
> - **Step 2 (conductor stop-write) — conductor #252, merged.** `review-saver.ts` no longer resolves/gates/writes the org id (all three removed together per the validation finding); the now-dead `jurisdiction` field on `ReviewSaveContext` + its one caller assignment and the `resave-reviews.ts` writer are also removed; generated `database.ts` types updated to the nullable schema. Tests 644/644. **Deploy gate: must be deployed before Migration B drops the column** (old code writing a dropped column errors on every insert).
> - **Step 3 (readers) — complete.** cityhall #603 (deployed) + inspector-general #159 (merged). No reader remains; a fresh sweep found no `.select()`/SQL reading `reviews.jurisdiction_organization_id` anywhere.
> - **Migration-history repair (substation prod).** Two manual applies had never been recorded in `supabase_migrations.schema_migrations`: `20260724000000_jurisdiction_conventions` (Phase 1 / #175) **and** `20260730000000_drop_reviews_jurisdiction_org_not_null` (Migration A / #183). Both backfilled (version+name, `statements` NULL — matching the existing convention); repo↔tracking now 1:1 for every repo file. One **pre-existing** orphan flagged for later: `20260602170549` is tracked but has no repo file (June, unrelated to this work) — left untouched.
> - **Prod fact for Migration B planning:** `reviews` is 365 rows / 69 MB; all 365 still carry a non-null org id, 0 NULLs yet (no new review saved since #252). Column drop is catalog-only (no table rewrite) on Postgres — fast, brief ACCESS EXCLUSIVE lock. Org id is a **dead denormalized copy**; the authoritative jurisdiction is `project.jurisdiction_slug`, so even a botched drop loses no source data. Recommended pre-drop safety net: snapshot `SELECT id, jurisdiction_organization_id FROM reviews` into a `_deprecated_*` table (Noetic App is Supabase **Pro** — daily backups, 7-day retention; PITR is a separate add-on, status unconfirmed — so a full-DB restore is the only DB-level rollback otherwise).
> - **Remaining: step 4 (Migration B — drop column + revoke `workflow_run` `organizations` policy + fix 4 test seeds) and step 5 (soft-delete jurisdiction org rows).** No design decisions (D1–D35) changed.
>
> **Status update (2026-07-30).** **Q8 is resolved — option (c).** The inspector-general reader gap that Q8 flagged is fixed: an audit across all repos (inspector-general, substation, cityhall, conductor, bureau) plus every SQL migration/view/RLS policy proved `bureau_checklist_version.jurisdiction_organization_id` is **read by nothing** (IG's own read of that table selects only `id`; every functional `jurisdiction_organization_id` read targets the `reviews` table). It is a write-only/dead column, so IG **stops populating it entirely** rather than re-sourcing from `project.jurisdiction_slug` — **inspector-general PR #159** severs IG from `reviews.jurisdiction_organization_id` (drops it from the reviews SELECT and from the `bureau_checklist_version` insert). This removes IG as a reader of the doomed column, unblocking Phase 7 Migration B. Also corrected here: the stale note in Open items step 3 that claimed the header still lists IG under "Repos NOT touched" (the header was already fixed in the 2026-07-29 update — IG has been under "Repos touched" since). No design decisions (D1–D35) changed. See [Implementation Status](#implementation-status).
>
> **Status update (2026-07-29).** Phases 1–6 are all merged. Phases 4b (substation #181 + cityhall #603), 5 (claude-plugins #169), and 6 (bureau #766) landed since the 2026-07-27 note. Also merged: bureau #816 (Fort Lauderdale registry onboarding + a prod `project.jurisdiction_slug` backfill for the one prod project whose jurisdiction lived only in its review's org row). **Phase 7 (organizations deprecation) is the only remaining phase.** New Q8 records the inspector-general reader gap found during impl (IG is now a Phase-7-touched repo). No design decisions (D1–D35) changed — this is a status/scope-accuracy update. See [Implementation Status](#implementation-status).
>
> **Revision note (v2, 2026-07-22).** Folds in the audit session (11 findings, all verified against code) and Will's decisions on each. Material changes:
> - **D17 revised (audit F1, blocking):** the new tables are NOT service-role-only. Conductor has no service-role key since Sec Wave 9 (`conductor/src/shared/child-env.ts` hard-blocks it); workflow scripts authenticate as the `workflow_run` Postgres role. The migration adds `GRANT SELECT` + permissive `TO workflow_run` policies (the `organizations` precedent). Without this, D18's hard-fail would have killed every CRC run — the July 14–16 hybrid-search outage failure class.
> - **Headline claim reworded (F2) + live resolution designed (F3):** name fixes are one DB row *because consumers resolve display names live via prefix at render time*, not because stored JSON gets patched. New D26–D28: `build-crc-review-comments.ts` writes a deterministic `sectionPrefix`; cityhall + CRV PDF resolve names from the registry; `prefixFromCommentId` is the legacy fallback; section slugs re-key onto prefix (kills the slug-lockstep migration problem).
> - **D15 re-scoped (F4):** v1 deletions are `dept-prefix-dict.ts` + both `SLUG_SCHEME` maps only. `cityhall/src/lib/departments.ts` AND conductor's duplicate `DEPARTMENT_NAMES` (`review-saver.ts:29-56` — store #12, missing from v1's inventory) are review-run vocabulary, deferred per D22/Q4.
> - **Phase 7 reordered (F5):** `reviews.jurisdiction_organization_id` is NOT NULL — drop the constraint *before* review-saver stops writing, else every review save fails in the interim.
> - **Backward compat added (F6, D29):** existing bucket guides are NEVER regenerated. The workflow parser accepts both H1 formats, extracts the prefix only (filename fallback exists), and always resolves the name from the DB, ignoring embedded names.
> - **Jurisdiction plumbing specified (F7, D30):** the CRC workflow derives the slug by querying `project.jurisdiction_slug` via its `projectId` input; NULL slug hard-fails at kickoff. The dead `jurisdiction` workflow input is removed.
> - **Sync semantics completed (F8, D7 extended):** bureau wins both ways — bureau-origin rows absent from `conventions.yaml` are deleted on sync (renames don't strand stale rows).
> - **D5 revised (F9, D32):** sync is a direct DB write from the bureau Action (existing `sync-bureau.yml` precedent — the service key already lives in bureau's Action secrets), not a substation endpoint. Sync failure fails the Action visibly + alerts. Resolves v1 Q3/Q6.
> - **Registry membership is file-gated and LAZY (F10, D33 — Will, 2026-07-22):** `conventions.yaml` presence IS the registry marker, and files are authored only when a jurisdiction is onboarded — v1 authors exactly austin (full) + cedar-park (stub) + whatever the D13 in-use query surfaces. No bulk stubs: front-loading 50+ files means inventing names/conventions before training the jurisdiction, when we don't yet know them. Pseudo-dirs (`federal`, `texas`, `txdot`) simply never earn a file. Replaces v1's "seed all 57 slugs" (D13 revised). Resolves v1 Q7 with no filter machinery.
> - **CRV chain stated (F11, D34):** DB row → `applicableArea` → bare prefix; DB winning over `applicableArea` is intended (the DB is ratified + versioned, unlike the stale dict that caused the incident).
> - Minor: NULL `submission_label_convention` silently falling back to "Submission {n}" is accepted (cosmetic labels — see D10 note); Phase 4's cutover requires Phase 3's API *deployed*, not merely started.

---

## Problem

Jurisdiction conventions — department prefix→name maps, submission numbering (U0/U1), which departments arrive via redlines vs. the MCR, dept→discipline mappings — have **no source of truth**. They were invented ad hoc, copied, and drifted.

### The incident that forced this (2026-07-22)

CRC review `ed5e7ba9-ba03-4000-abb4-1021ebec0631` (Lamar + Collier) displayed comment groups named **"One Water Bureau"**, **"Parks Board / Parkland"**, **"Construction Management"**, and **"Austin Water — Resource Recovery"** — all four invented by an LLM at skill-creation time (claude-plugins commit `aebbb19`, 2026-06-19) and never verified against Austin's org chart. Correct names: Onsite Water Benchmarking, Site Plan Plumbing, Case Manager, Austin Water Reclaim & Reuse.

Worse, the cityhall UI and the Comment Response Review PDF **disagreed** for the same review: the UI showed the (fixed) "Site Plan Plumbing" while the PDF showed "Parks Board / Parkland" — because `substation/src/pdf/dept-prefix-dict.ts` is an inlined copy of the claude-plugins dict whose "keep in sync" doc comment was the only sync mechanism, and it drifted for a month. Its resolution chain (dict → `applicableArea` → bare prefix) meant the stale dict **overrode correct data** already present in `review_comments`.

Remediation took: claude-plugins#161 + substation#171 (both merged 2026-07-22), plus a prod DB patch across 5 reviews / 76 `review_comments` rows including a section-slug migration (cityhall derives section slugs from `sectionName`, so renaming a name orphans comments unless slugs move in lockstep).

### The convention data is scattered across ≥12 stores

| # | Store | Holds | Failure mode |
|---|---|---|---|
| 1 | `organizations` (app DB) | jurisdiction display name via `reviews.jurisdiction_organization_id` | conflates customers + cities. Prod: "City of Austin" org owns 11 projects; Dunaway's projects span `austin` **and** `cedar-park`; winston#182 documented a review whose "jurisdiction" org was `pape-dawson` (a civil firm) |
| 2 | `project.jurisdiction_slug` (app DB) | canonical Bureau slug | TEXT, no FK; slug validity enforced by a 57-element allowlist frozen inside migration `20260720203333` |
| 3 | Library DB `jurisdictions` | GTM/prospector market data | no slug column; unjoinable to the app DB |
| 4 | `bureau/jurisdictions/<slug>/` | codes, review-guides, CC checklists, workflows | the de-facto slug registry (57 dirs); only Austin has a full profile |
| 5 | `claude-plugins .../dept-prefixes/<slug>.tsv` | CRC dept prefix→name | the OWB source; corrected + per-jurisdiction as of #161, but still a repo file no runtime can query |
| 6 | `substation/src/pdf/dept-prefix-dict.ts` | inlined copy of #5 for the CRV PDF | drifted for a month; sync-by-comment |
| 7 | `cityhall/src/lib/departments.ts` | 26 lowercase dept codes → names for review-run display | a fourth independent dept-name map (different vocabulary — see D22) |
| 8 | `cityhall` + `substation` `src/lib/jurisdiction.ts` | `SLUG_SCHEME` (austin → `U_ZERO_BASED`) + adapters | byte-identical duplicates; #182 D17 flags the drift footgun |
| 9 | `claude-plugins .../atomic-mcr/references/taxonomy-austin.json` | comment-prefix → department → discipline, incl. 4 SPLIT depts | Austin-hardcoded in a skill reference |
| 10 | `bureau .../mcr-convert/prompts/convert-mcr.md` | dept→discipline mapping (`aw→WWP`, `ev→EPTP/FWP`…) | hardcoded in prompt prose; likely stale |
| 11 | `surveyor/jurisdictions/<slug>.md` | GIS/source tooling config | healthy (slug-keyed) but disconnected |
| 12 | `conductor/src/shared/review-saver.ts:29-56` `DEPARTMENT_NAMES` | duplicate of #7's vocabulary; writes `reviews.department_name` at insert time | *(v2, audit F4)* fifth independent dept-name map; same review-run vocabulary as #7, deferred with it (D22/Q4) |

### The three review workflows key on different taxonomies

- **review** (formal): universal discipline codes (`wwp`, `sde`, …) as `guideCode`; reads `bureau/jurisdictions/<slug>/review-guides/<code>/`.
- **comment-resolution-check**: city dept prefixes (`OWB`, `TPW`, …) parsed out of generated guide H1s (`header-parse.ts`); its `jurisdiction` workflow input exists but is consumed by nothing.
- **completeness-check**: versioned `cc-N` checklist items, jurisdiction-keyed by directory.

Names flow verbatim from these stores onto applicant-facing surfaces (`review_comments.sectionName` → cityhall UI; dict → CRV PDF). **A wrong name anywhere ships to applicants.**

---

## Design

### Core model: registry/profile split with per-row provenance

- The **`jurisdictions` row** (slug, names, status, labeling convention) is a *registry entry*. Registry entries can be created from either side — a DB-first row is legal (bare-bones "this jurisdiction exists").
- **Bureau-side registry membership is file-gated, and files are authored lazily** *(v2, D33)*: a bureau dir becomes a registry row iff it contains a `conventions.yaml` — even a minimal stub — and a `conventions.yaml` is written **when a jurisdiction is onboarded**, not in bulk. A dir without one (today: everything except austin and cedar-park, including pseudo-dirs like `federal`/`texas`/`txdot`) never syncs into the registry or appears in the project-viewer dropdown. No separate marker file, no filter column, no blocklist: the file that holds the conventions is the flag, and onboarding is what creates it.
- The **conventions** (department rows, JSONB extras) are the *profile*. Every profile row carries provenance: `origin: 'bureau' | 'app'`, `verified`, `bureau_commit`.
- **Bureau is canonical; the DB is a replica** (Option C). `bureau/jurisdictions/<slug>/conventions.yaml` is the PR-reviewed, human-ratified source. A dedicated sync upserts it into the DB on merge.
- **Sync reconciles, bureau wins — both ways** *(v2, D31)*. Sync supersedes any app-origin row with the same key `(jurisdiction_slug, prefix)` (flips `origin→'bureau'`, `verified→true`, stamps `bureau_commit`), and **deletes bureau-origin department rows absent from the synced payload** — a prefix renamed or removed in `conventions.yaml` must not strand a stale, `verified=true` row that runtime resolution would keep serving. Sync **never deletes** app-origin rows bureau doesn't know about — it flags them unreconciled (surfaced as a to-do, not silent drift). **Registry rows are also never deleted by sync** *(v2, D33)*: a removed `conventions.yaml` may leave projects FK-ing the slug — the row is flagged unreconciled instead.
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

-- (v2, D26 — audit F1) Conductor workflow scripts authenticate as the
-- workflow_run role (per-run JWT; no service-role key since Sec Wave 9).
-- Jurisdiction data is non-tenant reference data — mirror the permissive
-- `organizations` SELECT precedent (20260711000000 §7). Without these, the
-- CRC runtime lookup is denied and D18's hard-fail kills every run (the
-- 20260716000000 hybrid-search-outage failure class).
GRANT SELECT ON TABLE jurisdictions, jurisdiction_departments TO workflow_run;

CREATE POLICY "workflow_run: select jurisdictions"
  ON jurisdictions FOR SELECT TO workflow_run USING (true);
CREATE POLICY "workflow_run: select jurisdiction_departments"
  ON jurisdiction_departments FOR SELECT TO workflow_run USING (true);
```

Deliberately trimmed (retrofit when a consumer appears): `aliases`, `active`/soft-delete on department rows, a `disciplines` table (universal disciplines stay bureau-only in `workflows/train/disciplines.json`).

**RLS** *(v2, revises v1 "service-role only")*: no anon/authenticated policies. Readable by `service_role` and (permissive SELECT, above) `workflow_run`. The substation API is the only browser-facing read path; skills read via Supabase MCP (service role); the bureau sync Action writes via service role.

### Rejected: a generic `jurisdiction_conventions` key-value table

A KV table gives rows without schema: per-row lifecycle but no typed columns, every read a `WHERE key='...'` string match over untyped values, and no natural home for per-row provenance semantics that differ by convention type. The hybrid above provides typed columns where the data is hot (departments — every consumer does `WHERE prefix = $1` lookups with per-row `verified` lifecycle) and JSONB where it's cold. The `jurisdictions.conventions` JSONB column is the escape hatch for singleton, one-consumer conventions (e.g. comment-status vocabulary `Pending/New/Rejected` keep vs `Cleared/FYI` drop, MCR text-parsing quirks); a key that gains a second consumer or per-row lifecycle gets promoted to a real column/table.

### Bureau side: `conventions.yaml`

One file per jurisdiction: `bureau/jurisdictions/<slug>/conventions.yaml`. **Its presence is what registers the jurisdiction** (D33) — a minimal stub is a legal, complete file:

```yaml
# bureau/jurisdictions/cedar-park/conventions.yaml — minimal stub
name: City of Cedar Park
short_name: Cedar Park
```

`status` may optionally be set in the file (`status: active`, Austin only for now); it defaults to `prospect`. Full schema:

```yaml
name: City of Austin
short_name: Austin
status: active
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
- **Sync mechanism** *(v2, D32 — revises v1's substation-endpoint design)*: a dedicated script in `bureau/tooling/` (alongside the existing `bun run sync` for `bureau_nodes`), invoked by a GitHub Action on merge-to-main touching `jurisdictions/*/conventions.yaml`, writing **directly to the app DB with the service-role key already present in bureau's Action secrets** (the exact pattern of the existing `.github/workflows/sync-bureau.yml`). Rationale: the v1 substation-endpoint indirection bought little — the service key already lives in bureau's Action environment — and a failed direct write **fails the Action visibly**, whereas a failed POST needs bespoke observability. Reconciliation logic (supersede app rows, delete absent bureau rows, flag unreconciled) lives in this script.
- **Sync failure alerting is a requirement, not a recommendation** *(v2, promotes v1 Q6)*: the Action failing must notify (GH Action failure notification at minimum; BetterStack if wiring exists). A silent sync failure is silent drift reborn.
- DB rows written by sync carry the bureau commit hash. **Manual edits to bureau-origin DB rows are prohibited** — the sync is one-way and will clobber them; that is the design.
- Note: the existing `sync-bureau.yml` also triggers on `jurisdictions/**`, so both syncs fire on a `conventions.yaml` merge — harmless, but the implementer should expect it.

### Substation API (read-only, v1)

- `GET /jurisdictions/:slug` → `{ slug, name, short_name, status, submission_label_convention, conventions, departments: [...] }` (department rows include `verified` — the unverified indicator rides for free)
- `GET /jurisdictions` → registry list (for the project-viewer jurisdiction dropdown; **unfiltered in v1** — see D33)
- **Auth** *(v2, resolves v1 Q3)*: identical to the existing cityhall→substation endpoints — cityhall SSR passes the user's session token as a Bearer header (`cityhall/src/lib/server/substation.ts` pattern); substation validates the session and reads the DB with its own server-side client, so the tables' RLS never sees the user token.
- In-memory cache, ~60s TTL, no invalidation machinery (conventions change ~never at runtime).
- No write endpoints in v1. Writes happen via bureau sync + skill HITL only.

**Who reads what:**

| Consumer | Path |
|---|---|
| cityhall (UI + SSR) | substation API (deliberate precedent: no new direct-supabase reads for this data) |
| substation CRV PDF renderer | in-process DB read |
| claude-plugins skills | direct DB via Supabase MCP (operator tools, as today) |
| conductor workflow scripts | direct DB via the run's token — as the `workflow_run` role, admitted by the D26 policies |

### Runtime resolution replaces baked-in names

- **CRC guides slim to prefix-only.** `generate-crc-guides` stops embedding department display names in guide H1s (H1 becomes `# CRC — {PREFIX} — {project} v{n}`).
- **The workflow parser tolerates both H1 formats and trusts neither's name** *(v2, D29 — audit F6)*. `header-parse.ts` already has a strict pattern, a loose pattern, and a filename fallback (`crc-owb.md` → `OWB`). The revised parser extracts **only the prefix** from either the legacy full-name H1 or the new prefix-only H1, and **always** resolves `prefix → display_name` from `jurisdiction_departments` — any name embedded in a legacy H1 is ignored. Consequences: **existing bucket guides (incl. the stale gen-6 H1s) are never regenerated and can never re-ship a stale name**, and Phase 5 (guide emission) and Phase 6 (workflow parsing) decouple completely.
- **Deterministic `sectionPrefix` in the output** *(v2, D27 — audit F3)*. The prefix flows script-to-script with zero LLM involvement: guide filename → `enrich-findings.ts:311` (`departmentPrefix`, filename fallback) → `build-crc-review-comments.ts` (already holds `grouping.departmentPrefix`, type at line 82). The script now writes `sectionPrefix` into each section of `review_comments.output_json`, alongside `sectionName` (kept as a legacy/fallback value for old readers).
- **Consumers resolve display names live** *(v2, D27)*. cityhall renders section names by joining `(project.jurisdiction_slug, sectionPrefix)` → `display_name` via the substation API at render time; the CRV PDF does the same via its in-process DB read. **This is what makes a future name fix genuinely one DB row** (via one bureau PR) — no guide regeneration, no bucket patching, and no `review_comments` patching, because the stored JSON no longer carries the authoritative name.
- **Legacy rows** *(v2, D28)*: rows predating `sectionPrefix` fall back to deterministic comment-ID derivation — leading letters, uppercased ("TPW 1" → `TPW`, "AW-RL-1" → `AW`; already implemented as `prefixFromCommentId`, `substation/src/pdf/dept-prefix-dict.ts:44-47`, which survives the dict deletion as a pure helper). Those IDs are the city's own MCR comment IDs — the same vocabulary that keys the registry — not LLM output.
- **Section slugs re-key onto prefix** *(v2, D27)*. cityhall currently slugifies `sectionName` to derive section slugs (the incident's slug-lockstep hazard). New sections key their slug on `sectionPrefix` instead — a display-name fix then changes nothing structural: no orphaned comments, no slug migration, ever.
- **Run-time miss = hard-fail.** If the CRC workflow encounters a prefix with no DB row, it fails early at `fetch-crc-guides` (the prefix is available there from guide filenames) with a clear error. No bare-prefix fallback — silent fallback is exactly the drift failure mode. Generation-time HITL means this should never fire; when it does, something is genuinely wrong.
- **Generation-time unknown prefix = HITL.** `generate-crc-guides` (and siblings) resolve prefixes against the DB. An unknown prefix pauses for HITL: the operator supplies the real name; the skill (a) INSERTs the row immediately (`origin='app'`, `verified=false`) so the run proceeds, and (b) drafts the bureau `conventions.yaml` PR that, once merged + synced, ratifies the row (`origin→'bureau'`, `verified→true`). The claude-plugins `dept-prefixes/<slug>.tsv` files (added in #161) are transitional and retire once skills read the DB.
- **Unverified rendering:** applicant-facing PDFs render app-origin names normally, no marker. Internal UIs (cityhall) show an "unverified" indicator — the `verified` flag arrives in the same API response cityhall already fetches for live name resolution (D27), so this is a render conditional, not a new data path.
- **CRV PDF resolution chain** *(v2, D34)*: DB row → `applicableArea` → bare prefix. The DB **intentionally overrides** `applicableArea`. Yes, override-by-lookup is the mechanism that shipped the incident — but the failure was the *stale unversioned dict*, not the override; the registry is PR-ratified and synced, so it outranks per-run data. Implementers must not "fix" the override, or per-run name inconsistency returns.

### Jurisdiction derivation for reviews

Reviews **derive** jurisdiction from `project.jurisdiction_slug` at run-kickoff time. No `reviews.jurisdiction_slug` column.

*(v2, D30 — audit F7)* Concretely for CRC: the workflow already receives `projectId`; it queries `project.jurisdiction_slug` directly (the `workflow_run` role has project SELECT scoped to the run's own project). **`project.jurisdiction_slug IS NOT NULL` is a hard precondition** — a NULL slug fails loudly at kickoff with a clear error, not downstream at `fetch-crc-guides`. The declared-but-unconsumed `jurisdiction` workflow input is removed. `generate-crc-guides` (generation side) likewise takes the project as input and resolves the slug from `project.jurisdiction_slug` rather than trusting an operator-typed slug.

> **Assumption A1 (Will, 2026-07-22): a project never changes jurisdiction.** The spec deliberately does not support historical reviews carrying a different jurisdiction than their project. If this assumption ever breaks, revisit with a stamped column.

### Organizations cleanup (final phase)

The jurisdiction-as-organization **misuse** ends: cityhall's project viewer switches to `project.jurisdiction_slug` + `jurisdictions.name/short_name`; conductor's review-saver stops writing `reviews.jurisdiction_organization_id`; readers migrate; the column drops. The misuse was the `reviews.jurisdiction_organization_id` *pointer* — **not** the existence of city-named org rows. `organizations` returns to meaning *Noetic organizations* — which **may include cities as customers** (a city owning its own bucket of projects is a legitimate org, distinct from that same city as a jurisdiction in the registry).

*(v2, D35 — audit F5; step 5 revised 2026-07-30, Will)* **Order matters because the column is NOT NULL** (the Wave 9 migration even grants `workflow_run` a permissive `organizations` SELECT solely so review-saver can satisfy that insert — `20260711000000` §7). Sequence: (1) migration drops NOT NULL; (2) review-saver stops writing; (3) readers migrate to the registry; (4) the column drops and the now-purposeless `workflow_run` `organizations` policy/grant is revoked. **~~(5) jurisdiction orgs soft-deleted~~ — CANCELLED:** the city-named org rows are kept (see D24/D35). Steps 1–4 already fully de-conflate the data; deleting the org rows would re-conflate city-as-org with city-as-jurisdiction and would orphan real customer projects (`City of Austin` owns 11).

---

## Decisions

Numbered for audit reference. D1–D25 from v1 (grill log with Will, 2026-07-22, three batches); D26+ and in-place revisions from the v2 audit session (same day).

- **D1.** Canonical jurisdiction id = Bureau slug; `jurisdictions.slug` is the natural PK (no uuid). *(inherits #182 D1)*
- **D2.** This spec supersedes winston#182's Path B.
- **D3.** Architecture = Option C: bureau-canonical `conventions.yaml`, one-way structured sync to typed app-DB tables. Not pure-DB (loses PR governance — the OWB lesson), not pure-files (serverless can't fs-read bureau).
- **D4.** One `conventions.yaml` per jurisdiction (not multiple small files): one review unit, one linter schema, one sync unit. Holds slug→display names, dept prefix map, labeling token, JSONB extras.
- **D5.** *(revised v2 → see D32)* Dedicated sync on merge-to-main. v1's substation-endpoint design is replaced by a direct DB write from the bureau Action.
- **D6.** DB rows carry `bureau_commit`; one-way sync; manual edits to bureau-origin rows prohibited.
- **D7.** *(extended v2 → see D31)* Registry/profile split with per-row provenance (`origin`, `verified`); sync supersedes matching app rows, never deletes app-origin rows, flags unreconciled.
- **D8.** `status ∈ {prospect, active}`. `prospect` = registry row only; `active` = bureau regulations exist. Status gates what runs, not existence. A `prospect` jurisdiction CAN run a CRC game day (CRC needs an MCR, not bureau codes); formal review requires `active` by construction.
- **D9.** Two-table schema as specified. Departments are a normalized table (hot row-level lookups + per-row lifecycle); `jurisdictions.conventions` JSONB is the long-tail escape hatch; generic KV `jurisdiction_conventions` table rejected. Trimmed: no `aliases`, no `active` flag, no disciplines table (bureau-only), retrofit on demand.
- **D10.** `submission_label_convention` column stores the named token (`'U_ZERO_BASED'`); adapters stay in code. *(inherits #182 D8; short column name chosen over `submission_iteration_label_convention`)* *(v2 note)*: a NULL token makes `citySubmissionLabel()` fall back silently to generic "Submission {n}" — accepted; labels are cosmetic, unlike department names.
- **D11.** `discipline_codes TEXT[]` on department rows (SPLIT depts get multiple entries). Mapping recorded in DB now; consumers (`atomic-mcr` taxonomy, `convert-mcr` prompt — likely stale) migrate later.
- **D12.** V1 convention set: display names, dept prefix→name, `comment_source` (mcr/redlines/both), dept→discipline, labeling token, JSONB extras. Out: portal metadata, surveyor configs, CC checklist-version pointers.
- **D13.** *(revised v2 — see D33)* `project.jurisdiction_slug` gets a real FK. The registry becomes the ONLY slug allowlist — no more allowlists frozen in migrations. Population: NOT a blanket 57-slug seed — the sync creates rows from bureau dirs bearing a `conventions.yaml` (D33), plus app-origin HITL rows. The Phase-1 migration seeds only the slugs already in use by prod projects (`SELECT DISTINCT jurisdiction_slug FROM project WHERE jurisdiction_slug IS NOT NULL` — austin, cedar-park, …) so the FK is valid before the first sync runs.
- **D14.** Library DB `jurisdictions` untouched (separate Supabase project, GTM lifecycle). Non-goal.
- **D15.** *(re-scoped v2 — audit F4)* V1 deletes exactly: `substation/src/pdf/dept-prefix-dict.ts` (the const map; the pure `prefixFromCommentId` helper survives per D28) and both `SLUG_SCHEME` maps. **`cityhall/src/lib/departments.ts` and conductor's `DEPARTMENT_NAMES` (`review-saver.ts:29-56`) are NOT deleted in v1** — they are review-run vocabulary (D22), deferred to Q4. v1's "all inline dictionaries deleted" wording caused a direct contradiction with D22.
- **D16.** cityhall reads via a new read-only substation API (`GET /jurisdictions/:slug`, `GET /jurisdictions`), not direct supabase. Substation PDF reads in-process; skills via Supabase MCP; conductor scripts via run token (see D26). API auth = existing session-token Bearer pattern *(v2, resolves Q3)*.
- **D17.** *(revised v2 → see D26)* RLS: no anon/authenticated policies; `service_role` + permissive `workflow_run` SELECT. Substation API is the sole browser-facing path. API caches in-memory, ~60s TTL.
- **D18.** CRC guides carry prefix only; the CRC workflow resolves display names from the DB at run time. Run-time miss → hard-fail at `fetch-crc-guides`.
- **D19.** Generation-time unknown prefix → HITL: immediate app-origin DB row (run proceeds) + auto-drafted bureau `conventions.yaml` PR (ratification). Applicant-facing surfaces render unverified names without a marker; internal UIs show one (data path: the D27 API join — `verified` rides the same response).
- **D20.** Bureau linter validates `conventions.yaml` schema in CI.
- **D21.** Seeding: Austin's `conventions.yaml` drafted by merging the corrected `austin.tsv`, substation's dict, and the unverified extras (`EV`, `F`, `LDE`, `IW`, `RW`, `AW`, `AWPE`, `AD`) — the seed PR review is where Will ratifies those (they were deliberately excluded from claude-plugins#161 as unverified).
- **D22.** V1 `jurisdiction_departments` = **city comment-prefix vocabulary only** (CRC/MCR). cityhall's `departments.ts` review-run display map is a *different vocabulary* (Noetic review-run `department_code`s) and migrates in a later phase, possibly keyed via `discipline_codes`. Do not conflate the two in one table without designing it. *(v2)*: conductor's `DEPARTMENT_NAMES` duplicate is part of the same deferral.
- **D23.** Reviews derive jurisdiction from project at kickoff; no `reviews.jurisdiction_slug`. Assumption A1: projects never change jurisdiction. *(v2: concrete mechanics in D30)*
- **D24.** Organizations deprecation is the final phase (in-spec, not deferred out). *(v2: ordered sequence in D35)* *(revised 2026-07-30, Will — see D36)* "Deprecation" means **ending the jurisdiction-as-org pointer, not deleting city org rows.** A city may be a legitimate Noetic organization (customer). Phase 7 = steps 1–4 only.
- **D36.** *(2026-07-30, Will — cancels D35 step 5)* **The jurisdiction org rows in `organizations` are KEPT, not soft-deleted.** City-as-Noetic-organization (a customer owning a bucket of projects) is a distinct, valid concept from city-as-jurisdiction (the registry). Migration B (step 4) already removes the only conflation (the `reviews.jurisdiction_organization_id` FK); jurisdiction now derives from `project.jurisdiction_slug` → registry, so the org row carries no jurisdiction meaning anymore. Deleting it would (a) re-conflate the two concepts in reverse and (b) orphan live data — `City of Austin` owns 11 projects (`owner_organization_id`) + 8 `project_access` grants. There is no separate "customer vs jurisdiction" type column on `organizations`, and none is needed: an org is just an org. *(This also corrects the v1/v2 problem statement, which cited "City of Austin owns 11 projects" as evidence of the conflation — that is the legitimate customer use; only the jurisdiction pointer was the bug.)*
- **D25.** Acceptance scenario: **cedar-park CRC game day** — bootstrap HITL → conventions exist → CRC workflow + cityhall UI + CRV PDF all render correct names with zero code changes. (A Dunaway project already has `jurisdiction_slug='cedar-park'`.)
- **D26.** *(v2, audit F1 — revises D17)* Both tables get `GRANT SELECT` + permissive `USING (true)` SELECT policies `TO workflow_run` (the `organizations` precedent, `20260711000000` §7). Conductor has no service-role key (Sec Wave 9; `child-env.ts` `REMOVED_ENV_VARS`); without these policies the runtime lookup is denied and D18's hard-fail becomes a total CRC outage — the `20260716000000` hybrid-search failure class.
- **D27.** *(v2, audit F2/F3)* Live name resolution: `build-crc-review-comments.ts` writes a deterministic `sectionPrefix` per section (prefix already in hand as `grouping.departmentPrefix` from `enrich-findings.ts:311`; zero LLM involvement); cityhall + CRV PDF resolve `(jurisdiction_slug, sectionPrefix) → display_name` from the registry at render time; `sectionName` still written as legacy fallback; **section slugs key on `sectionPrefix`**, decoupling display names from comment grouping permanently. The "one DB row fix" claim is true *because of this*, and only for surfaces that resolve live.
- **D28.** *(v2)* Legacy rows without `sectionPrefix` derive the prefix from comment IDs (leading letters, uppercased — `prefixFromCommentId`, which is retained as a pure helper). Those IDs originate from the city's own MCR, in the registry's key vocabulary; casing variance is handled by the uppercase.
- **D29.** *(v2, audit F6)* The CRC workflow parser accepts both H1 formats (legacy full-name and new prefix-only), extracts **only the prefix** (filename fallback), and always resolves the display name from the DB, ignoring any embedded name. **Existing bucket guides are never regenerated**; stale gen-6 H1 names become inert.
- **D30.** *(v2, audit F7)* The CRC workflow queries `project.jurisdiction_slug` via its `projectId` input (`workflow_run` has scoped project SELECT). NULL slug → hard-fail at kickoff. The dead `jurisdiction` workflow input is removed. `generate-crc-guides` resolves the slug from the project the same way.
- **D31.** *(v2, audit F8 — extends D7)* Bureau wins both ways: sync deletes bureau-origin rows absent from the synced `conventions.yaml` payload (modifications = updates, removals = deletes). App-origin rows remain delete-exempt + flagged.
- **D32.** *(v2, audit F9 — revises D5)* Sync = direct DB write from a `bureau/tooling/` script run by the merge-to-main Action with the service-role key already in bureau's Action secrets (the `sync-bureau.yml` precedent). No substation sync endpoint. Sync failure fails the Action visibly **and alerts** (requirement, promoted from v1 Q6).
- **D33.** *(v2, audit F10 + Will — resolves v1 Q7, revises D13)* **`conventions.yaml` presence = registry membership, and files are authored LAZILY at onboarding.** A jurisdiction gets its `conventions.yaml` (minimal stub: `name` + `short_name`; optional `status`, default `prospect`) when we start real work there — the moment we can actually know its names and conventions — not in a bulk backfill. Rationale (Will): bulk-stubbing all 57 dirs front-loads implementation details (department names, conventions) we can't answer until the jurisdiction is trained/onboarded. **v1 authors exactly: austin (full profile, `status: active`) + cedar-park (stub) + a file for any other slug the D13 in-use query surfaces.** Everything else — including pseudo-dirs (`federal`, `texas`, `txdot`) — has no file, no registry row, no dropdown entry; no filter machinery or blocklist needed. Jurisdiction display names are PR-ratified in bureau at onboarding time instead of frozen in a seed migration. Consequence: creating a project in a brand-new jurisdiction requires the two-line stub PR + sync first (the registry is the only slug allowlist, D13) — a deliberate ~5-minute onboarding gate, with the app-origin DB-first registry row as the escape hatch if it ever can't wait. Sync never deletes registry rows (projects may FK them — see D31 note); a removed file flags the row unreconciled. `GET /jurisdictions` ships unfiltered in v1 (it only contains onboarded jurisdictions).
- **D34.** *(v2, audit F11)* CRV PDF resolution chain: registry row → `applicableArea` → bare prefix. The registry intentionally overrides `applicableArea` (it is ratified + versioned; the incident's cause was the stale *unversioned* dict, not override-by-lookup). Do not "fix" the override.
- **D35.** *(v2, audit F5; step 5 cancelled 2026-07-30 — see D36)* Phase 7 sequence: drop NOT NULL on `reviews.jurisdiction_organization_id` → review-saver stops writing → readers migrate → drop column + revoke the `workflow_run` `organizations` policy → ~~soft-delete jurisdiction orgs~~ (cancelled; org rows kept per D36). Phase 7 = steps 1–4.

## Phases

1. **Migration** (substation): create tables, seed only the in-use slugs (D13) so the FK is valid, add FK, add `workflow_run` grants/policies (D26).
2. **Bureau**: Austin's full `conventions.yaml` + cedar-park stub (+ a stub for any other slug the D13 in-use query surfaced — lazy per D33, no bulk stubs), linter check, direct-write sync script + Action + failure alerting (D32). First sync populates the registry.
3. **Substation**: jurisdictions API (session-token auth); CRV PDF resolves from DB (chain per D34, legacy fallback per D28); delete the `dept-prefix-dict.ts` const map.
4. **Cityhall**: read API; delete `SLUG_SCHEME`; live section-name resolution keyed on `sectionPrefix` with comment-ID fallback (D27/D28); slug re-key; unverified indicator; project-viewer jurisdiction display + dropdown. **`departments.ts` is NOT deleted (D15/D22).** Cutover requires Phase 3's API *deployed*, not merely merged — until then the viewer keeps the legacy `jurisdiction_organization_id` path.
5. **Skills** (claude-plugins): generate-crc-guides + siblings read DB; resolve slug from project (D30); emit prefix-only H1s; HITL writes rows + drafts bureau PR; retire `dept-prefixes/*.tsv`.
6. **CRC workflow** (bureau): both-format prefix-only parser (D29); runtime DB resolution; write `sectionPrefix` (D27); hard-fail on miss (D18); derive slug from project, NULL → kickoff hard-fail (D30). No guide regeneration.
7. **Organizations deprecation** (ordered per D35): drop NOT NULL → review-saver stops writing → readers migrate → drop `reviews.jurisdiction_organization_id` + revoke `workflow_run` organizations policy → soft-delete jurisdiction orgs.

Phases 3–6 parallelize once 1–2 land (D29 decouples 5 from 6; D28's comment-ID fallback lets Phase 4 ship live resolution before Phase 6 writes `sectionPrefix`). Phase ordering constraint: 1 → 2 → (3|4|5|6) → 7, with Phase 4's cutover additionally gated on Phase 3's deploy.

## Implementation Status

*(As of 2026-07-30. Implementation session, Will + Claude. Each shipped phase is a merged PR; author-only on prod-DB migrations — Will applied them. ✅ **DEV COMPLETE — all 7 phases done** (Phase 7 = steps 1–4; step 5 cancelled per D36).)*

| Phase | Repo | PR | State |
|---|---|---|---|
| 1. Migration (2 tables + FK + `workflow_run` grants + seed in-use slugs) | substation | **#175** | ✅ merged + **applied to prod** |
| 2. `conventions.yaml` (austin full + cedar-park stub) + linter (in CI) + direct-write sync Action | bureau | **#710** | ✅ merged + **first sync ran** — registry live |
| 3. Read-only jurisdictions API + CRV PDF DB resolution + delete `dept-prefix-dict` const map | substation | **#176** | ✅ merged + **deployed** |
| 4a. Live CRC section-name resolution + unverified indicator (read path) | cityhall | **#595** | ✅ merged |
| 4b. Delete `SLUG_SCHEME` (both copies) + jurisdiction picker + project-viewer/list display switch + `jurisdiction_slug` on the project API | substation + cityhall | **substation #181** + **cityhall #603** | ✅ merged |
| 5. Skills read DB, prefix-only H1s, HITL writes DB row + drafts bureau PR, retire TSVs | claude-plugins | **#169** | ✅ merged |
| 6. CRC workflow: both-format prefix-only parser (D29), runtime DB resolution, write `sectionPrefix`, hard-fail on miss, slug-from-project + remove dead input | bureau | **#766** | ✅ merged |
| 7. Organizations deprecation (steps 1–4; step 5 cancelled per D36) | substation + conductor + cityhall + inspector-general | IG **#159** · substation **#183** (Migration A) · conductor **#252** (stop-write) · substation **#184** (Migration B) | ✅ **done** — all 4 steps applied to prod; step 5 (soft-delete) cancelled by decision (D36). |

*(Also merged alongside 4b: **bureau #816** onboarded Fort Lauderdale into the registry — a `conventions.yaml` stub (`status: active`) + a prod `project.jurisdiction_slug='fort-lauderdale'` backfill — so the one prod project whose jurisdiction lived only in its review's org row still renders after 4b's display switch. It was the only project in that gap. See the Phase 7 note on this class of data.)*

**Prod state after Phases 1–2:** `jurisdictions` has `austin` (`status=active`, `U_ZERO_BASED`, 18 department rows, `conventions` JSONB populated) + `cedar-park` (stub, `status=prospect`, 0 departments). All 18 austin `jurisdiction_departments` rows are `origin=bureau`, `verified=true`, stamped with the sync commit. The 6 formerly-unverified extras (`EV/F/LDE/IW/RW/AWPE`) were ratified in the #710 review and synced as `verified=true`.

**Net effect today (Phases 1–6 all merged):** the applicant-facing incident ("One Water Bureau") is **structurally fixed end-to-end** — the CRV PDF (Phase 3), the cityhall CRC UI (Phase 4a), and the CRC workflow output (Phase 6) resolve department names live from the registry and ignore any name baked into a guide; the cityhall projects-list + project-viewer jurisdiction display and the submission-label scheme resolve from the registry (Phase 4b, no more `SLUG_SCHEME` in either repo); and the generation-side skills read `jurisdiction_departments` from the DB, emit prefix-only H1s, and onboard unknown prefixes via HITL DB-writes + a drafted bureau PR (Phase 5, TSVs retired). Existing bucket guides are never regenerated. **Phase 7 (organizations deprecation) is now also done** — `reviews.jurisdiction_organization_id` is dropped, jurisdiction derives from `project.jurisdiction_slug` → registry, and city org rows are kept as legitimate Noetic organizations (D36). **The spec is dev-complete.**

### Open items (for the next session)

**None — the spec is dev-complete.** Phase 7 is done (steps 1–4 applied to prod; step 5 cancelled per D36). The checklist below is retained as the completion record. Ordered per D35 (order was load-bearing because `reviews.jurisdiction_organization_id` was NOT NULL):

1. ✅ **Migration A** (substation **#183**, applied to prod): dropped `NOT NULL` on `reviews.jurisdiction_organization_id`. Verified live: column nullable.
2. ✅ **conductor** (**#252**, merged): `review-saver.ts` no longer writes it — the by-slug **org lookup**, the **hard-abort gate**, and the **insert write** were removed *together* (per the validation finding; keeping any one would abort every save). Also removed: the now-dead `jurisdiction` field on `ReviewSaveContext` + its sole caller assignment (`engine.ts`), the `resave-reviews.ts` writer, and the org id from the generated `database.ts` types (now nullable/optional). Tests 644/644, tsc clean, biome clean. **Not yet confirmed deployed — see gate below.**
3. ✅ **Readers migrated off the column** — complete:
   - cityhall's 2 display sites — Phase 4b (#603), **deployed**. ✅
   - **inspector-general `on-workflow-completed.ts`** — Q8 → option c; IG PR #159, merged. ✅
   - Fresh sweep confirms **no `.select()`/SQL reads `reviews.jurisdiction_organization_id` anywhere**.
4. ✅ **Migration B** (substation **#184**, applied to prod): dropped the `reviews.jurisdiction_organization_id` column (auto-dropped its FK + index) + revoked the now-purposeless `workflow_run` `organizations` SELECT policy/grant (`20260711000000` §7); fixed the 4 integration-test seeds; snapshotted the 365 rows into RLS-locked `_deprecated_reviews_jurisdiction_org_id` (reversibility net; safe to drop in a few weeks). Verified live: column gone, snapshot 365 rows, policy revoked. Tracking row backfilled (manual apply gap, same as A).
5. ❌ **CANCELLED (D36, 2026-07-30):** ~~soft-delete the jurisdiction org rows in `organizations`~~. The city-named org rows are **kept** — a city can be a legitimate Noetic organization (customer). Steps 1–4 already fully de-conflate the data; deleting the rows would re-conflate the two concepts and orphan real projects (`City of Austin` owns 11). No registry-slug-driven delete list is built. Nothing to do here.

**Rollout gate (Migration-B gate) — SATISFIED.** Step 4 (Migration B, drop column) required conductor **#252 deployed** first (old code writing a dropped column would error `column does not exist`). #252 was confirmed deployed before Migration B was applied; the drop is done and no insert errors resulted. Gate closed.

### Key implementation findings & gotchas

- **Phase-6 hard-fail ↔ Phase-5 onboarding interaction (now resolved by Phase 5).** Phase 6 makes the CRC workflow **hard-fail** at `fetch-crc-guides` if any guide's department prefix has no `jurisdiction_departments` row (D18). Before Phase 5, the only writer to that table was the Phase-2 sync, so a brand-new jurisdiction's CRC run would hard-fail. **Phase 5 (#169) closed this:** `generate-crc-guides` now resolves prefixes against the DB and, on an unknown prefix, HITL INSERTs an app-origin row + drafts the ratifying bureau PR — so onboarding writes the DB row that keeps the run alive. The TSVs are retired.
- **Guide H1s are now prefix-only (Phase 5).** `generate-crc-guides` emits `# CRC — {PREFIX} — …`; Phase 6's D29 parser tolerates both that and the legacy `{NAME} ({PREFIX})` form and always resolves the display name from the DB. Existing bucket guides are never regenerated and can never re-ship a stale name.
- **`sectionPrefix` persistence verified.** CRC is `output_schema='legacy'`; conductor's review-saver stores `reviewData` **wholesale** for legacy (`review-saver.ts:499-500`), so the new `sectionPrefix` field persists to `reviews.output_json.sections[]`, and review-saver only reads `sectionName` (for slugs). `validate-output.ts` does not strict-check section shape. So nothing drops or rejects `sectionPrefix`. Once a fresh CRC run happens post-#766, cityhall (4a) prefers `section.sectionPrefix`; older reviews keep working via 4a's `sectionCode`-derivation fallback.
- **D34 behavior change to eyeball.** Registry wins over the baked-in name (intended anti-drift). Real example: an existing section titled `"AW Utility Development Services"` now renders as the registry's `"Austin Water"`. Confirm the registry names read well in the UI; if any is off, the fix is a one-line `austin/conventions.yaml` edit + re-sync.
- **Phase 4a scope notes.** The unverified indicator renders on the CRC review-overview group headers only (not the section-detail heading, which is a single derived string — deferred, low value). The project-viewer display switch was moved to 4b (grouped with the identity plumbing). Verification was unit-tests + Will's manual eyeball (cityhall app not runnable in-session).
- **Phase 3 API contract.** The jurisdictions endpoints follow substation's Stripe-style envelope (`{ data, has_more }` / `{ id, object, created_at, snake_case }`) with a **documented natural-key exception** (`id` = slug / prefix, unprefixed) added to `substation/docs/api-design.md`. This is the wire contract cityhall (4a, and 4b) build against.
- **Minor spec deltas found during impl (none change the design):** the "57-element allowlist" in migration `20260720203333` is a *backfill array literal*, not a column CHECK — so `project.jurisdiction_slug` had **zero** validity enforcement before Phase 1's FK. Bureau has **60** slug dirs, not 57. The real CRC H1 already embeds the prefix in parens (`{NAME} ({PREFIX})`), so the strict parser matched it pre-change. `bun run sync` in bureau is austin-hardcoded to `bureau_nodes`, so the conventions sync is genuinely new code (new script + new `sync-conventions.yml` Action), not a trigger tweak. Only `parse-crc-comment-response-pdf` (not `generate-crc-guides-from-redlines` or `atomic-mcr`) reads the shared dept-prefix TSVs.
- **Tooling notes for implementers.** Bureau CI's biome is scoped to `tooling/` and there is **no `tsc`/lint gate for the `workflows/` scripts** (they run in the conductor sandbox with deps installed there); Phase 6 added the CRC `header-parse` self-contained test to the CI "workflow script tests" step. Bureau's `conventions.yaml` linter + sync use built-in `Bun.YAML` (no `js-yaml` dep). Substation prod migrations are applied manually by Will (migration-tracking table is fragile after manual applies) — keep migrations author-only.

### Acceptance scenario (D25) — unblocked, not yet run

The **cedar-park CRC game day** (D25) is **no longer blocked** now that Phase 5 (#169) is merged: cedar-park is still a registry stub with zero department rows, but Phase 5's HITL bootstrap now onboards its dept roster (app-origin DB rows) during `generate-crc-guides`, which keeps the Phase-6 hard-fail from tripping. The game day itself has **not been run** (running a CRC is a gated action). When run, the CRC workflow + cityhall UI + CRV PDF should render correct names with no further code changes.

## Open Questions

- **Q1.** Exact Austin department list ratification (the 8 unverified prefixes) — resolved in the Phase-2 bureau PR review, but flagging: if any of those 8 is wrong, it ships. Auditors: sanity-check the names against the MCR PDFs in the `crc-guides` bucket / Austin's published org structure. (The D33 lazy rule shrinks the name-ratification surface to austin + cedar-park.)
- **Q2.** `conventions.yaml` v1 key naming (draft above) — auditors: check the YAML shape round-trips cleanly to both tables and that `conventions:` extras can't collide with top-level keys.
- **Q3.** ~~Substation sync endpoint auth mechanism~~ *(resolved v2: no sync endpoint — D32; read-API auth = session-token pattern — D16)*
- **Q4.** Review-run department vocabulary (D22 deferral): design for migrating `departments.ts` + conductor's `DEPARTMENT_NAMES` / `reviews.department_code` display onto the registry. Deliberately out of v1.
- **Q5.** ~~generate-crc-guides Phase-0 preflight records registry status + row counts~~ *(resolved: implemented in Phase 5 / #169 — preflight `jurisdiction` block now carries `registry_status`, `department_row_count`, `bootstrap_mode`)*
- **Q6.** ~~Sync failure observability~~ *(resolved v2: promoted to a requirement — D32)*
- **Q7.** ~~`GET /jurisdictions` status filter~~ *(resolved v2: unfiltered in v1 — D33)*
- **Q8.** ~~*(new, Phase 7)* **inspector-general's replacement source for `reviews.jurisdiction_organization_id`.**~~ *(resolved 2026-07-30 → **option (c)**, IG PR #159.)* The recommendation was to validate (c) first by enumerating consumers of `bureau_checklist_version.jurisdiction_organization_id`. That enumeration — across inspector-general, substation, cityhall, conductor, bureau, plus every SQL migration, view, and RLS policy — found **zero readers**: IG's own read of that table (`supabase-backend.ts:334`) selects only `id`; every functional `jurisdiction_organization_id` read targets the **`reviews`** table; the remaining hits are auto-generated `database.types.ts` schema/FK boilerplate. The column is write-only/dead, so **(c)** applies: IG **stops populating it** (no re-source needed — (a)/(b) would compute a value no consumer reads). IG PR #159 drops the column from IG's `reviews` SELECT and from the `bureau_checklist_version` insert; new rows get `NULL` there (the column is nullable). Removes IG as a reader of `reviews.jurisdiction_organization_id`, satisfying the "resolve before Migration B" gate.
  - **Provenance footnote (loose end for Phase 7 step 5/Migration B):** `bureau_checklist_version.jurisdiction_organization_id` has **no tracked migration** creating it — it appears in the generated `database.types.ts` with an FK to `organizations`, but no `ADD COLUMN` exists in any repo's migration history (consistent with the "manual prod applies record nothing" pattern). When Phase 7 revokes/soft-deletes on the `organizations` side, remember this untracked FK exists on `bureau_checklist_version` in addition to the `reviews` one.

## Prior art / references

- winston#182 — `workspaces/comment-resolution-check/jurisdiction-correction-and-submission-labeling/DESIGN-SPEC.md` (P2 problem statement, D1, D8, D17, Path A migration `20260720203333`).
- winston#184 — this spec's Draft v1 PR; the v2 audit session's findings are folded in above.
- claude-plugins#161 (merged 2026-07-22) — per-jurisdiction `dept-prefixes/<slug>.tsv` + HITL bootstrap; transitional, retired by Phase 5.
- substation#171 (merged 2026-07-22) — CRV PDF dict corrections; the dict's const map deleted in Phase 3 (`prefixFromCommentId` helper survives, D28).
- `substation/supabase/migrations/20260711000000_workflow_run_role_and_rls.sql` — the `workflow_run` role + the permissive `organizations` precedent D26 mirrors; `20260716000000` — the silent-permission-gap outage D26 prevents recurring.
- The 2026-07-22 DB patch: 5 CRC reviews / 76 `review_comments` rows, name + section-slug migration (the incident this spec prevents from recurring — structurally, via D27's live resolution + prefix-keyed slugs).
