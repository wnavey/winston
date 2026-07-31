# SIR Publishing — `upload-sir` skill + `diligence-report` integration

**Status:** Draft v1
**Date:** 2026-07-31
**Type:** Implementable spec. This is the **publish step** the companion data-model spec (`../sir-product-experience/data-model.md`, winston#… "SIR Data Model") repeatedly defers to — it resolves that spec's Q1 (`created_by`) and Q2 (`title`/`description`), and it **supersedes data-model §5's "publish endpoint (service-role backed)" for the MVP** (see D1). It is the P0 "run-sync bridge" of the north-star `../sir-product-experience/DESIGN-SPEC.md` (winston#192), narrowed to the near-term local-run operating model.
**Repos touched:** `substation` (one additive migration — relax the `sir_artifact.format` constraint), `claude-plugins` (new `upload-sir` skill under `plugins/noetic-tools/skills/`; a wording edit to the `diligence-report` skill).
**Repos NOT touched:** `cityhall` (the SIR read UI is a separate spec), `conductor`, `surveyor`, `bureau`, `quarry`, `navalbase`, `radar`, `field-agent`.

> **One-line goal:** After a `diligence-report` run finishes on a staffer's laptop, let them publish the deliverable to the app: pick/create the `organization` → `project` home interactively, write one `site_intelligence_report` row + N `sir_artifact` rows, upload the files to the `sir-artifacts` Supabase Storage bucket, and record what was published so a re-run publishes a new **version** rather than a duplicate. Packaged as a standalone `upload-sir` skill and invoked (unchanged, no clone) as an opt-in final gate of `diligence-report`.

---

## 1. Problem

The `diligence-report` skill produces its entire deliverable **on disk only**. Its own SKILL.md states: *"Does not auto-publish — deliverables land in the working directory; the user decides what to send."* Delivery today is a manual Google-Drive step. The data-model spec created the destination — `site_intelligence_report` + `sir_artifact` tables and the private `sir-artifacts` bucket — but left the **write path** unspecified (its Q1/Q2 and §5 are deferred to "the P0 publish-step spec"). This spec is that write path.

The near-term operating model (data-model §v3 revision note) is: **a Noetic staffer runs the skill locally and publishes on completion.** There is no in-app intake chat, no Inngest event, no `field-agent` worker. So the publish step is a **local action with direct database + storage access**, not an app-triggered server job.

## 2. Verified current state (prod `mgxqsrjutswbciyrltwd`, 2026-07-31)

All checked live against prod this session:

- **Both tables exist and are empty.** `public.site_intelligence_report` (0 rows) and `public.sir_artifact` (0 rows). Columns match the data-model DDL (§3.2/§3.3 of data-model.md).
- **The `sir-artifacts` bucket exists and is private** (`storage.buckets`: `sir-artifacts`, `public = false`).
- **The `format` check is the one blocker for supporting docs.** `sir_artifact` has exactly two check constraints:
  - `sir_artifact_kind_check` → `kind IN ('report','research_appendix','supporting_document')`
  - `sir_artifact_format_check` → `format IN ('pdf','docx','html')` ← **too narrow** for arbitrary supporting-document file types (png/jpg/kml/zip/txt/xlsx). Relaxed by this spec (§8).
- **RLS / visibility (from `substation/supabase/functions/rls_helpers.sql`):**
  - `user_can_see_project(project_id, uid)` short-circuits `true` when `is_noetic_admin(uid)` — so **any Noetic admin sees every SIR** regardless of `project_access`. This is why a service-role insert (which grants no `project_access`) is acceptable for staff-only MVP (D6).
  - `grant_project_creator_access()` (AFTER INSERT on `project`) **only inserts a `project_access` row when `auth.uid() IS NOT NULL`.** A service-role insert has a null `auth.uid()`, so **no `project_access` is granted** on project creation. Accepted (D6); customer-facing entitlement is out of scope (§10).
- **`organizations`** = `id, name (NOT NULL), slug (NOT NULL, UNIQUE via `organizations_slug_idx`, default ''), created_at`. **No `updated_at`.** Slug collision is a hard unique-constraint failure (drives §5's collision handling).
- **`project`** = `name (NOT NULL), site_address (nullable), site_plan_number, zoning, owner_organization_id (NOT NULL, ON DELETE RESTRICT), timestamps`.

`diligence-report` deliverable layout the skill reads from (`working-dir.md`):

```
$NOETIC_DILIGENCE_DIR/
├── location-resolution/location-resolution.md   # canonical address + lat/lon + parcel set
├── seed-site-data.md                            # inputs incl. intended use
├── hitl/intake-transcript.md                    # optional — buyer/requester (org-name inference)
├── run-manifest.json                            # NEVER modified by this skill (replay owns it)
└── sir/deliverable/
    ├── site-intelligence-report.pdf             # kind=report, format=pdf
    ├── site-intelligence-report.docx            # kind=report, format=docx
    └── supporting-documents/*                    # kind=supporting_document (ALL files, any ext)
```

## 3. Architecture

- **Direct, no API (D1).** No substation HTTP endpoint for MVP. Writes go straight to prod Postgres + Storage.
- **Execution mechanism = a bundled local script** (`scripts/publish.ts`, run via `tsx`/`bun`) using `@supabase/supabase-js` with a **service-role** key. Rationale (D2): the deliverable PDF is 180–340 pages / often tens of MB; the only MCP upload path (`Noetic.storage_upload`) takes **base64 content inline**, which would pull the whole file through the model context — not viable. A script streams the file. The same script does the DB inserts and the `auth.users` lookup, so there is one credential path and no partial-MCP juggling.
- **Credentials (D3):** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` from the run env / `~/.env`. Fail fast with a clear message if absent. Target is **prod only**; no local-Supabase branch.
- **Service role bypasses RLS (D4)** — the operator needs no `project_access`; matches data-model D9 ("writes are service-role at publish").
- **`created_by` (resolves data-model Q1):** resolve the operator's `auth.users.id` by email at publish time (`select id from auth.users where email = :email`). Email defaults to the git user email (`git config user.email`), overridable by a skill arg / env var. If the lookup returns no row, warn and write `created_by = null` (nullable per the DDL).

## 4. The interactive flow

The skill runs as an ordered pipeline. **Every DB/storage write is behind a single all-up confirmation (§4.6, D26).** All operator prompts use `AskUserQuestion`.

### 4.0 Locate the run & preflight
- Run dir = `$NOETIC_DILIGENCE_DIR` if set, else a run-dir path argument, else error (D41).
- Assert `sir/deliverable/site-intelligence-report.{pdf,docx}` — at least one must exist (D39).
- Read `sir-publishing-record.json` at the run root if present → drives re-publish (§7).
- Preflight the destination: service-role creds present; both tables reachable; `sir-artifacts` bucket reachable.

### 4.1 Derive the naming tokens (all operator-confirmed)
- **Short intended-use token** (e.g. `Walmart`, `Carwash`): seed a guess from `seed-site-data.md`'s intended-use line, then have the operator confirm/override — "Expanding an existing Walmart" must collapse to `Walmart`, which needs human judgment (D35).
- **City, state**: parse from the canonical resolved address in `location-resolution.md`; if not cleanly present, prompt (D36).
- **Address**: the canonical single-line address from `location-resolution.md`.
- **Description**: intended use in a few sentences, e.g. "Expanding the square footage of an existing Walmart." (D16). Seeded from `seed-site-data.md`, operator-editable.
- **Location fields**: `address`, `latitude`, `longitude`, `parcel_ids text[]` — all from `location-resolution.md` (D16). Any missing → left null.

### 4.2 Choose the organization
- **Infer a candidate org name**: if `hitl/intake-transcript.md` exists, extract the buyer/requester/company name and present it to the operator for validation; else ask the operator for the org name (D7).
- **Fuzzy-match** that string against all `organizations.name` — normalized (lowercase, strip punctuation and `Inc/LLC/Co`), best match above a threshold surfaced as the top suggestion; **never auto-selected** (D8).
- **Present via `AskUserQuestion`** (D9): options = `[recommended match (if any), "Create a new organization", up to 2 other existing orgs]`. If org count exceeds the 4-option cap, offer `recommended + "Create new" + "Pick from full list"` (operator types the name to filter).

**New organization path:**
1. Compute slug: lowercase, kebab-case, strip non-alphanumerics, drop `inc/llc/co`, collapse dashes — e.g. `"ExtraStorage Containers, Inc." → extrastorage-containers` (D10).
2. **Present the computed slug for confirmation.**
3. **Query for the slug before insert** (D11). If taken, it almost certainly means the org already exists → surface it and ask "use existing org X, or pick a different name?". If the operator insists on a distinct org, append `-2`, `-3`… and re-confirm the slug.
4. Insert the org (`name`, `slug`).
5. **A new org auto-creates a project** (§4.3, new-org branch) — no project-selection prompt.

### 4.3 Choose the project

**New-org branch (auto):**
- Project `name` = `"{intended use} - {city, state}"`, e.g. `Walmart - West Sacramento, CA` (D12). Address is appended **only on collision** (below). Overlap with the org name is acceptable (Walmart building a Walmart).
- Insert the project (`name`, `owner_organization_id`).

**Existing-org branch:**
- Query `project WHERE owner_organization_id = :orgId`; present via `AskUserQuestion`: the project list + "Create a new project" (D13).
- Picking an existing project just attaches the SIR to it — **N SIRs per project is expected** (D14), no uniqueness check.
- "Create new project" → same name rule as the new-org branch.

**Collision handling for a newly created project (D12, D32–D34):**
- **Scope:** collision = an existing project **under the chosen org** whose `name` equals the bare `"{use} - {city, state}"`. Project names are not globally unique; cross-org overlap is meaningless.
- **On collision:** create ours as `"{use} - {city, state} - {address}"`. Then **offer (confirm, best-effort) to rename the prior bare-named project** by appending ITS own address — pulled from that project's `site_address`, or from its SIR's `address` if `site_address` is null. If neither is determinable, **skip the prior rename and warn** — never guess.
- **Only a project still holding the bare (un-disambiguated) name is ever renamed.** If ≥2 collided projects already exist (all previously address-disambiguated), just add ours with its address; touch none of the others.

### 4.4 Assemble the SIR row
- `project_id` = chosen/created project.
- `title` = `"{use} - {city, state} - {address} - {publish date yyyy-MM-dd}"`, e.g. `Walmart - West Sacramento, CA - 123 Main St - 2026-07-26`. **Date = the publish date** (the moment `upload-sir` runs), not the render date (D15, D37). Operator can override at the final confirm.
- `description` = §4.1 sentences.
- `address`, `latitude`, `longitude`, `parcel_ids` = §4.1 location fields.
- `version = 0`, `current_version = 0` for a fresh SIR (D17). Re-publish → §7.
- `created_by` = §3 resolved user id.

### 4.5 Assemble the artifact set (compute paths; don't upload yet)
Enumerate the files and compute the deterministic storage path for each **before insert** (D19 — the earlier "leave storage_path empty" idea is dropped; both columns are `NOT NULL`, so the row carries the real path from the start and the upload targets it):

| Source file | `kind` | `format` | `mime_type` |
|---|---|---|---|
| `site-intelligence-report.pdf` | `report` | `pdf` | `application/pdf` |
| `site-intelligence-report.docx` | `report` | `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| each file in `supporting-documents/*` | `supporting_document` | lowercased extension (`png`, `kml`, `zip`, …) | best-effort from extension; null if unknown |

- **Grab every file** in `supporting-documents/`, any extension (D38). Extensionless → `format = 'bin'`, null mime, still uploaded (D45).
- `file_name` = original basename; `byte_size` = `stat`. (D20, D40)
- **No `research_appendix` rows** — v9 folded the appendix into the report document (D20).
- **Missing report format** (e.g. no `.docx`) → upload whichever report formats exist, warn on the missing one, don't hard-fail (D39).
- **Storage path** = `sir/<sir_id>/v<version>/<filename>` in bucket `sir-artifacts` (§6). Basename collision within one version → append a numeric suffix and log it (theoretically impossible given the per-file names, but a backstop) (D18).

### 4.6 Single all-up confirmation, then write (D26)
Present ONE summary — org (existing/new + slug), project (existing/new + name, any prior-project rename), SIR title/description/location, and the full artifact list with computed paths — and require **explicit approval** before the first insert (consistent with "no firing without green light"). Standalone `upload-sir` invocation is itself the green light to *start*, but the all-up confirm still gates the writes.

**Write order (D22):** org → project → `site_intelligence_report` → `sir_artifact` rows → **upload bytes** → write `sir-publishing-record.json`. No cross-DB/storage transaction is possible; instead the whole operation is **idempotent and re-runnable** (§9), so a failure is fixed by re-running, not by manual cleanup.

## 5. (org/project creation details — see §4.2/§4.3)

## 6. Storage convention

- **Bucket:** `sir-artifacts` (private; reads are server-minted signed URLs — a read-side concern, out of scope here).
- **Path:** `sir/<site_intelligence_report_id>/v<version>/<filename>`.
  - v0 report PDF → `sir/<uuid>/v0/site-intelligence-report.pdf`
  - a supporting plat → `sir/<uuid>/v0/plat.pdf`
  - a revised render → `sir/<uuid>/v1/site-intelligence-report.pdf`
- Filenames are the original basenames. Versions are isolated by the `v<n>` path segment, so v0 and v1 never collide.

## 7. Re-run & versioning

Driven by `sir-publishing-record.json` at the run root (§8) plus a DB re-check.

- **No record file** → first publish: create the SIR (`version=0`, `current_version=0`), insert artifacts at `version=0`, upload, write the record.
- **Record file present** → re-publish. Before offering anything, **re-query the DB for the recorded `site_intelligence_report_id`** (D29). If the row is gone, treat as first publish (create fresh) and warn that the recorded SIR no longer exists.
- **If the SIR row exists**, recommend (and confirm) publishing as the **next version**: `next = current_version + 1`; upload the new files under `v<next>`; insert `sir_artifact` rows at `version = next`; **leave prior versions' rows and files intact**; prompt for a `versioning_label` (a 1–2-sentence, commit-message-style description of the changes) written identically to every artifact row of that version (D31, data-model D11); then **advance `current_version` to `next`** (D30 — every publish advances; the "hold back until customer-final" nuance from data-model §3.4 is deferred until customer entitlement exists).

## 8. `sir-publishing-record.json` (D27, D28)

- **Location:** run root, alongside `run-manifest.json`. **Deliberately NOT written into `run-manifest.json`** — `diligence-replay-phase-5` re-derives `run-manifest.json` on every replay and its contract says the production manifest "is never modified"; a publish block there would be clobbered. A sidecar is safe.
- **Writer:** `upload-sir` only. **Written once per successful publish** (after DB rows + all uploads succeed). Append-only over `publishes`.
- **Read:** a missing file = "first publish."
- **Shape:**

```json
{
  "site_intelligence_report_id": "uuid",
  "project_id": "uuid",
  "organization_id": "uuid",
  "current_version": 1,
  "publishes": [
    {
      "version": 0,
      "published_at": "2026-07-31T18:22:04Z",
      "created_by": "uuid",
      "versioning_label": null,
      "artifacts": [
        { "kind": "report", "format": "pdf", "storage_path": "sir/<uuid>/v0/site-intelligence-report.pdf", "byte_size": 22384512 },
        { "kind": "report", "format": "docx", "storage_path": "sir/<uuid>/v0/site-intelligence-report.docx", "byte_size": 5120344 },
        { "kind": "supporting_document", "format": "pdf", "storage_path": "sir/<uuid>/v0/concept-plan.pdf", "byte_size": 812004 }
      ]
    }
  ]
}
```

## 9. Schema change — relax `sir_artifact.format` (D38, D44)

Supporting documents can be any file type; the current `format IN ('pdf','docx','html')` check blocks them. **Drop the constraint entirely — `format` becomes free-text** (Will's call: simplest; `mime_type` carries the precise type anyway).

Additive, safe (table is empty):

```sql
-- substation/supabase/migrations/<timestamp>_relax_sir_artifact_format.sql
alter table public.sir_artifact drop constraint sir_artifact_format_check;
```

- **`kind` stays constrained** (`report/research_appendix/supporting_document`) — unchanged.
- **Deploy order (D46, D47):** this migration lands as its own `substation` PR and **must be applied to prod before `upload-sir` writes any non-pdf/docx/html supporting doc.** This spec *specifies* the migration; applying it is a separate, operator-gated step (no firing from this session). The skill should fail fast with a clear message if a write is rejected by the old constraint (i.e. migration not yet applied).
- Regenerate DB types (substation + cityhall) after apply.

## 10. `diligence-report` integration & wording change (D23, D24, D43)

- **Invocation:** `diligence-report`'s final step invokes the **same** `upload-sir` skill via the Skill tool — **not a clone** (single source of truth).
- **Opt-in gate:** it is an **APPROVAL gate** at the very end — the run asks "Publish this SIR to the app?" and proceeds only on explicit go. It never auto-uploads.
- **Wording edit:** replace `diligence-report` SKILL.md's two lines —
  - *"Does not auto-publish — deliverables land in the working directory; the user decides what to send"* (in "What this skill does NOT do"), and
  - the matching note in the Phase table / pipeline —
  with a pointer to the new opt-in final publish gate (publishing happens only on explicit operator go). The spirit is preserved: no silent auto-upload.

## 11. Skill packaging (D23, D41, D47)

- **Location:** `claude-plugins/plugins/noetic-tools/skills/upload-sir/` (sibling of `diligence-report`).
- **Standalone invocation:** honors `$NOETIC_DILIGENCE_DIR`, else a run-dir path arg, else errors.
- **Contents:** `SKILL.md` (the interactive flow §4) + a bundled `scripts/publish.ts` (the `@supabase/supabase-js` service-role writer/uploader + `auth.users` lookup).
- **Repos & order:** `substation` migration PR first (§9), then the `claude-plugins` PR (new skill + `diligence-report` wording).

## 12. Failure modes & idempotency

- **Partial write** (rows inserted, upload dies): re-run. Uploads overwrite at the same deterministic path; row inserts are guarded by the `unique (site_intelligence_report_id, version, kind, format)` constraint → treat as upsert (on conflict, update path/size). Net effect: re-running heals a partial publish.
- **Slug collision on new org:** handled interactively (§4.2) — never a raw constraint error surfaced to the operator.
- **`auth.users` email miss:** warn, write `created_by = null`, continue.
- **Missing report format / unknown extension:** warn + continue (§4.5).
- **Old `format` constraint still live:** first non-pdf supporting-doc insert fails → fail fast with "apply the §9 migration first."
- **Recorded SIR row deleted:** detected in §7 → fresh publish + warning.
- **No rollback of created org/project on a later failure:** an org/project with no SIR is harmless and re-run reuses it (the operator re-selects it). Documented, accepted.

## 13. Decisions

- **D1 — Direct DB + storage writes, no substation endpoint for MVP.** Supersedes data-model §5. The endpoint returns as a later hardening step if/when app-triggered publishing exists.
- **D2 — Mechanism = bundled local script (`@supabase/supabase-js`, service role).** MCP `storage_upload` is base64-inline only → unusable for a tens-of-MB PDF through model context.
- **D3 — Creds from env (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`); prod only; fail fast if absent.**
- **D4 — Service role (bypasses RLS).** Matches data-model D9.
- **D5 — `created_by` resolved from `auth.users` by operator email (default git email); null on miss.** Resolves data-model Q1.
- **D6 — Rely on the noetic-admin visibility override; no manual `project_access` grant.** Service-role insert → `grant_project_creator_access` no-ops (null `auth.uid()`); staff still see everything. Customer entitlement deferred.
- **D7 — Org name inferred from `hitl/intake-transcript.md` (operator-validated) if present, else asked.**
- **D8 — Normalized fuzzy match, top suggestion only, never auto-selected.**
- **D9 — `AskUserQuestion` for org/project selection.**
- **D10 — Slug = kebab, strip non-alphanumerics + Inc/LLC/Co, collapse dashes; confirmed before insert.**
- **D11 — Query slug before insert; collision → surface existing / append `-2`…; re-confirm.**
- **D12 — New org auto-creates a project `"{use} - {city, state}"`; address suffix only on collision; org-name overlap OK.**
- **D13 — Existing-org lists projects + "create new"; same name rule.**
- **D14 — N SIRs per project allowed; no uniqueness check.**
- **D15/D37 — SIR `title` = `"{use} - {city, state} - {address} - {publish yyyy-MM-dd}"`, date = publish date.**
- **D16 — `description` = intended use in a few sentences.** Resolves data-model Q2 alongside D15.
- **D17 — Fresh SIR: `version=0`, `current_version=0`.**
- **D18 — Storage path `sir/<sir_id>/v<version>/<filename>`; numeric-suffix backstop on same-version basename clash.**
- **D19 — Compute path → insert rows (real path) → upload bytes.** (Both storage columns are `NOT NULL`.)
- **D20 — Populate `file_name`/`mime_type`/`byte_size`; no `research_appendix` rows.**
- **D22 — Write order org→project→SIR→artifact rows→upload→record; no cross-store txn; idempotent re-run instead.**
- **D26 — One all-up confirmation before any write.**
- **D27 — Record file `sir-publishing-record.json` at run root.**
- **D28 — Written once per successful publish, append-only; missing = first publish.**
- **D29 — Re-query DB before offering a version bump; absent row → fresh + warn.**
- **D30 — `current_version` advances on every publish** (partial/continuous-publish model dropped).
- **D31 — `versioning_label` = 1–2-sentence change note on v≥1; written to every artifact row of the version.**
- **D32 — Project-name collision scoped to the chosen org.**
- **D33 — On collision: our project gets the address suffix; offer (confirm, best-effort) to rename the prior bare-named project by its own address; skip+warn if indeterminate.**
- **D34 — Only rename a project still holding the bare name; never re-touch already-disambiguated ones.**
- **D35 — Short intended-use token derived-but-operator-confirmed.**
- **D36 — City/state from `location-resolution.md`; prompt if absent.**
- **D38/D44 — Grab all supporting-doc files; drop `sir_artifact_format_check` entirely (`format` free-text).**
- **D39 — Upload whichever report formats exist; warn on missing; don't hard-fail.**
- **D40 — Mimes: `application/pdf`, docx OpenXML, `text/html`; `file_name` = basename.**
- **D41 — Standalone honors `$NOETIC_DILIGENCE_DIR`, else path arg, else error.**
- **D42 — Scope exclusions (§below).**
- **D43 — Reframe `diligence-report` "does not auto-publish" wording to point at the opt-in final gate.**
- **D45 — Extensionless supporting file → `format='bin'`, null mime, still uploaded.**
- **D46 — §9 migration specified here, applied separately (operator-gated); skill fail-fasts if unapplied.**
- **D47 — Two repos, migration-first: `substation` then `claude-plugins`.**

## 14. Open questions

- **Q1 — Threshold + library for the org-name fuzzy match.** A normalized exact/substring match covers most cases; a fuzzy lib (e.g. token-set ratio) is nicer but adds a dep. Recommend: start with normalized substring/token overlap, no new dep; upgrade only if it misses in practice.
- **Q2 — Should `upload-sir` also stamp the published SIR's URL back into the run dir** (e.g. the cityhall detail path) for operator convenience once the read UI exists? Deferred until the cityhall SIR page has a stable route.
- **Q3 — Where does the service-role key live on operators' laptops** in practice (per-machine `~/.env` vs a shared secret manager)? Ops question, not a schema question; the skill only cares that it's in env.

## 15. Scope boundaries (explicitly deferred, D42)

- The **cityhall read UI** (SIR list/detail, signed-URL View/Download, version switcher) — separate spec.
- Any **scrub/PII pass** — Phase 5 already scrubbed the deliverable; `upload-sir` uploads verbatim.
- The **substation publish endpoint** — deferred (D1); this spec supersedes data-model §5 for MVP.
- **Backfilling** historical on-disk runs.
- The **customer-vs-internal version entitlement** (data-model §3.5 / catalog G2) — near-term all readers are staff.
- Retiring the legacy feasibility/`diligence_runs`/`diligence_artifacts` tables (data-model §4 Q4).
