# SIR Data Model — `site_intelligence_report` + `sir_artifact` (human-kickoff, local runs)

**Status:** Draft v3
**Date:** 2026-07-30
**Type:** Implementable spec — table creation. The **first build step** of the SIR product effort (companion to the north-star `DESIGN-SPEC.md`, winston#192). Concrete enough to execute.
**Repos touched:** `substation` (the migration + a publish endpoint + shared-DB schema), `cityhall` (the SIR list/detail read UI, type regen)
**Repos NOT touched (by design):** `conductor`, `surveyor`, `bureau`, `quarry`, `navalbase`, `radar`, and — new in v3 — `field-agent` (out of the near-term picture entirely).

> **Revision note (v3, 2026-07-30):** Major reshaping to match the **near-term operating model**: SIRs are **kicked off by a human on their local machine** (Claude Code running the `diligence-report` skill), **not** via the in-app intake chat, and **not** via `field-agent` / Inngest. On completion the local run **publishes** the deliverable to Supabase DB + storage, where it gets a home in the app UI. Consequences, all folded in below:
> - **Dropped the `diligence_runs` reuse (was v2's plan).** It's an async run-tracking table (`queued`→`running` status, `conversation_id` + `document_version_id` FKs) built for app-triggered, worker-executed cloud runs. In the local-run world half its columns go permanently null — it fails a 1:1-reuse test. The run collapses into the SIR entity. (New **D2**, **D9**.)
> - **Dropped `conversation_id` from the SIR** and the whole intake-chat reuse (`conversations`, `chat_message`, `document`/`document_version`/`document_section`, Gemini extraction). None of it is on the near-term SIR path. (New **D10**.)
> - **New second table `sir_artifact`** (fresh, not a re-anchored `diligence_artifacts`) carrying **flat versioning**: a `version` integer + a `versioning_label`, with `site_intelligence_report.current_version` naming the one version the customer sees. Supports "preserve v0 & v1, compare, restart, customer-sees-final-only" without a third table. (New **D8**, **D11**.)
> - **`origin` enum and the coarse `status` enum removed** — there is one origin (a local publish) and no app-side lifecycle to track under completion-only publishing. (Revises v2 **D4**.)
> - **Holding-org / prospect re-home (v2 §3.6, D8) moved out of near-term scope** → it exists to isolate *self-serve prospect intake*, which the human-kickoff model removes. Now a Future concern (north-star §5 / catalog G1). (New **D12**.)
> - **Field simplification (2026-07-31, same PR):** the SIR is now a **light container** — optional `title` + `description` plus a small optional subject-location set (`address`, `latitude`, `longitude`, `parcel_ids text[]`). Dropped from the earlier shape: the `input_address`/`resolved_address` split (→ a single `address`), `jurisdiction_slug`, and `intended_use`. (Repurposes **D3**.)
>
> Unchanged from v2: the `project`-as-neutral-container thesis (§1), the verified current-state facts (§2), `project` columns left untouched (D5), SIR→site-plan linkage deferred (D6).

> **One-line goal:** Give the Site Intelligence Report its own first-class entity — `site_intelligence_report` — a light container (`title`/`description` + optional location) with a flat-versioned set of output files (`sir_artifact`), populated by a **local `diligence-report` run that publishes on completion**. No `submission` shoehorn, no intake-chat dependency, no `field-agent`.

---

## 1. Problem

SIRs are currently modeled as `submission` rows with `submission_type = 'feasibility'` under a `project`, wired to an in-app intake chat that triggers a `field-agent` worker via Inngest. Two things are wrong for where the product is actually going:

1. **`submission` is the wrong shape.** Its entire value is its children — `submission_version` (U0/U1 city resubmittal cycles), `submission_document`, `submission_plan_set` → `plan_set_version`. That's site-plan review machinery. An SIR has none of it. The `submission type='feasibility'` row is a **routing placeholder** that exists only to anchor the intake URL. (Verified §2.2.)

2. **The whole intake-chat + `field-agent` kickoff path is not the near-term operating model.** In the near term, an SIR is **kicked off by a Noetic staffer on their laptop** — they run the `diligence-report` skill in Claude Code, and on completion it publishes the deliverable to Supabase. There is no self-serve intake chat, no Inngest event, no laptop worker flipping a run row through `queued`→`running`. So the machinery v2 planned to reuse (`diligence_runs` for run-tracking, `conversations`/`document_version` for intake) has **nothing to attach to** — reusing it means carrying permanently-null columns.

3. **`project` conflates "an initiative" with "a place."** `project.site_address` + `project.jurisdiction_slug` assume one project = one address + one jurisdiction. But an SIR's subject location is resolved *per run* (Phase 0 of the diligence skill), and a real initiative wants **N SIRs across N addresses**. Address welded to the container breaks that.

We want: `project` becomes a neutral, address-agnostic **initiative container**; an SIR becomes its own lightweight entity (`title`/`description` + optional location) carrying a **flat-versioned set of output files**, written by a local run at completion time.

---

## 2. Verified current state (2026-07-28)

### 2.1 Row counts (prod, project `mgxqsrjutswbciyrltwd`)

| metric | count | implication |
|---|---|---|
| `project` | 23 | small |
| `submission` where `type='feasibility'` | 77 | mostly intake/dev churn |
| `submission` where `type='site_plan'` | 23 | the real site-plan world |
| `conversations` where `type='intake'` | 79 | ≈ 1:1 with feasibility submissions |
| `diligence_runs` total / completed | 11 / 8 | **only 11 runs ever persisted** — real client SIRs were run in Claude Code and never hit the DB |
| `project` with non-null `site_address` | **6 / 23** | address is **already vestigial** at project level |
| `project` with non-null `jurisdiction_slug` | 16 / 23 | populated by backfill, not the app |

**Takeaway:** the historical feasibility rows + the 11 `diligence_runs` are early-stage churn from the app-intake/`field-agent` experiment, not precious deliverables → a **clean additive build** is viable (§4). The real client SIRs already run locally in Claude Code — which is exactly the model v3 formalizes.

### 2.2 Schema facts (from generated types + migrations)

- `project`: `id`, `name`, `owner_organization_id` (**NOT NULL** → `organizations`), `jurisdiction_slug` (nullable, FK → `jurisdictions(slug)`), `site_address` (nullable TEXT, **no FK/index/policy/function**), timestamps.
- `submission`: `id`, `project_id`, `submission_type`, … Children: `submission_version`, `submission_document`, `submission_plan_set`.
- `diligence_runs` (substation): FK `document_version_id`, `conversation_id`, `project_id`, `triggered_by_user_id`; status enum (`queued`→`running`→`completed`/`failed`); → `diligence_artifacts`.
- **No RLS policy or DB function references `site_address` or `jurisdiction_slug`.**

### 2.3 The `site_address` / `jurisdiction_slug` usage sweep (verdict: safe to leave alone)

- **`site_address`** — 0 authoritative uses, ~15 convenience (display, PDF filename, guarded markdown lines). Already effectively a hint.
- **`jurisdiction_slug`** — 0 hard-authoritative; ~3 "degrades-if-null" paths, **all in the site-plan/CRC world** (CRV + comment-resolution PDF labeling, CRC dept-name map). Plus the FK to `jurisdictions(slug)`.
- **The review engines (conductor + surveyor) do NOT read `project.jurisdiction_slug`** — they take jurisdiction as a workflow input.
- **RLS-safe confirmation:** no RLS policy, DB function, trigger, `NOT NULL`, or `CHECK` references either column. Both are safe to treat as optional site-plan-scoped hints.

**Consequence for scope:** we do **not** touch the `project` columns. They keep serving the site-plan/CRC world unchanged. We only *add* the two new SIR tables.

---

## 3. Target model

### 3.1 The levels

```
organization        e.g. "ExtraStorage Containers"   (tenant/customer)
  └─ project         e.g. "2026-Q4-expansion"         (initiative container — address-AGNOSTIC)
       ├─ site_intelligence_report   title:"1234 Main St feasibility"  (NEW — light container: title/description + optional location)
       │     └─ sir_artifact   v0 {report.pdf, appendix.pdf}      (NEW — flat-versioned output files)
       │        sir_artifact   v1 {report.pdf, appendix.pdf}      (a revised version; both preserved)
       ├─ site_intelligence_report   title:"77 River Rd retail"     (another SIR, same initiative)
       └─ submission (site_plan)                        (UNCHANGED — its own address + plan-set machinery)
```

- Site plans stay on `submission`.
- SIRs move to `site_intelligence_report` (name matches the published product).
- Each SIR carries a **flat-versioned** set of output files in `sir_artifact`. `site_intelligence_report.current_version` names the single version the customer sees.
- `project` stays neutral; `site_address`/`jurisdiction_slug` remain as **optional site-plan hints** (untouched).

### 3.2 New table: `site_intelligence_report`

The stable entity: one row per SIR — a **light container** of optional descriptive metadata (`title` + `description`) and optional subject location (`address`, `latitude`/`longitude`, `parcel_ids`) plus the `current_version` pointer. The deliverable itself lives in `sir_artifact`.

```sql
create table public.site_intelligence_report (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.project(id),

  -- descriptive metadata (both optional)
  title       text,          -- human label for the SIR
  description text,          -- free-text description

  -- subject location (all optional — light, for display / map-pin / parcel lookup)
  address    text,
  latitude   double precision,
  longitude  double precision,
  parcel_ids text[],         -- 0..n parcels (combined-parcel scenarios); native array, queryable via = ANY / @>

  -- deliverable pointer + provenance
  current_version int  not null default 0,   -- the version the customer sees (→ sir_artifact.version)
  created_by      uuid references auth.users(id),  -- the staffer who published it (set by the publish step)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.site_intelligence_report (project_id);
```

Notes:
- **Light optional subject location** (D3): `address`, `latitude`, `longitude`, `parcel_ids text[]` — all nullable, for display / map-pin / parcel lookup. Still omitted: `jurisdiction_slug` and `intended_use` (add if a use case needs them). `parcel_ids` is a native array (a property can span multiple parcels), preferred over a CSV string for queryability.
- **No `status`/`origin` enums.** Under completion-only publishing (D7) there is no app-side lifecycle to track and exactly one origin (a local publish). A coarse status (e.g. `archived`) is a one-line add the day the internal dashboard (catalog F1) needs it — deferred (D4).
- `current_version` is a plain integer, not an FK — the flat-versioning choice (D8) means there is no `sir_version` row to point at. It defaults to `0` (the first published version).
- Plus: `updated_at` auto-bump trigger; RLS (§3.5); add to `supabase_realtime` for live status in the app.

### 3.3 New table: `sir_artifact`

One row per output **file**, tagged with a `version` integer and a version-level `versioning_label`. A version is just a bucket of files sharing the same `version` number.

```sql
create table public.sir_artifact (
  id uuid primary key default gen_random_uuid(),
  site_intelligence_report_id uuid not null
    references public.site_intelligence_report(id) on delete cascade,

  version          int  not null,                 -- 0, 1, 2…
  versioning_label text,                           -- version-level note, e.g. "fixed detention-pond table"
                                                   --   (see D11 — written identically to every row of a version)

  kind   text not null check (kind in ('report','research_appendix','supporting_document')),  -- content ROLE
  format text not null check (format in ('pdf','docx','html')),                                -- file TYPE

  storage_bucket text not null default 'sir-artifacts',
  storage_path   text not null,                    -- e.g. sir/<sir_id>/v1/site-intelligence-report.pdf
  file_name      text,                             -- friendly download name
  mime_type      text,
  byte_size      bigint,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (site_intelligence_report_id, version, kind, format)
);
create index on public.sir_artifact (site_intelligence_report_id);
create index on public.sir_artifact (site_intelligence_report_id, version);
```

Notes:
- **`kind` × `format` split** (D8): `kind` is the content role, `format` is the file type. The `unique (sir_id, version, kind, format)` lets one report exist as `pdf` + later `docx` + `html` without collision, and makes the publish step an idempotent upsert per `(version, kind, format)`. Near term we write at least `('report','pdf')`, plus `('research_appendix','pdf')` if the appendix ships as a separate file.
- **`on delete cascade`** — an artifact is worthless without its SIR.
- **Fresh table, not a re-anchored `diligence_artifacts`** — the old table's parent FK (`diligence_run_id`) and storage conventions belong to the abandoned `field-agent` path; a clean table avoids inheriting that baggage (D2).

### 3.4 How versioning works (flat model)

- **Customer read** (the only door a client gets): `SELECT * FROM sir_artifact WHERE site_intelligence_report_id = :id AND version = (SELECT current_version FROM site_intelligence_report WHERE id = :id)`. The customer sees exactly one version and is unaware others exist.
- **Internal read** (staff): all versions — `SELECT DISTINCT version, versioning_label FROM sir_artifact WHERE site_intelligence_report_id = :id ORDER BY version`, then the files per version. This is the compare surface.
- **Publish a first version:** insert the SIR (`current_version = 0`), upload files, insert `sir_artifact` rows at `version = 0`.
- **Publish a revised version** (e.g. after human review — "chat with Claude, tweak the PDF"): compute `next = max(version) + 1`, upload the new files at `version = next` with a `versioning_label`, **leave the prior version's rows intact** (v0 and v1 both preserved), then `UPDATE site_intelligence_report SET current_version = :next` **only when** that version becomes the customer-facing final.
- **Restart from a previous version:** just publish a new `version` number; lineage isn't persisted in the flat model (the operator knows what they branched from). If displayed lineage / per-version provenance becomes a need, that's the promote-to-`sir_version` trigger (D11).

### 3.5 RLS / access control

The DB uses a three-legged project-access model (`substation/supabase/migrations/00000000000000_baseline.sql`). Every project-child table gates SELECT on `user_can_see_project(project_id, uid)` and writes on `get_user_project_access_level(project_id, uid) IN ('write','admin')`.

**`site_intelligence_report`** is a direct child of `project` (has `project_id`) — same topology as `submission`. RLS is a verbatim clone of that shape:

```sql
ALTER TABLE public.site_intelligence_report ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SIRs for accessible projects"
  ON public.site_intelligence_report FOR SELECT TO authenticated
  USING (public.user_can_see_project(project_id, auth.uid()));

CREATE POLICY "Users with write access can insert SIRs"
  ON public.site_intelligence_report FOR INSERT TO authenticated
  WITH CHECK (public.get_user_project_access_level(project_id, auth.uid()) IN ('write','admin'));

CREATE POLICY "Users with write access can update SIRs"
  ON public.site_intelligence_report FOR UPDATE TO authenticated
  USING (public.get_user_project_access_level(project_id, auth.uid()) IN ('write','admin'))
  WITH CHECK (public.get_user_project_access_level(project_id, auth.uid()) IN ('write','admin'));

CREATE POLICY "Users with admin access can delete SIRs"
  ON public.site_intelligence_report FOR DELETE TO authenticated
  USING (public.get_user_project_access_level(project_id, auth.uid()) = 'admin');
```

**`sir_artifact`** has no `project_id` of its own — it reaches the project through its parent SIR. Gate SELECT via a subquery to the parent (writes are service-role, which bypasses RLS):

```sql
ALTER TABLE public.sir_artifact ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SIR artifacts for accessible projects"
  ON public.sir_artifact FOR SELECT TO authenticated
  USING (public.user_can_see_project(
    (SELECT project_id FROM public.site_intelligence_report
      WHERE id = sir_artifact.site_intelligence_report_id),
    auth.uid()));
```

- **The publish step writes via the service role** (bypasses RLS) — so a local run doesn't need a user with `project_access`. It supplies `created_by` explicitly.
- **RLS gates whether you can see the SIR at all. It does NOT enforce the customer-vs-internal "which versions" distinction** — that's an application/entitlement concern (catalog G2), deferred. Near-term all readers are Noetic staff and see every version.

---

## 4. Data migration

The entire change is **additive** — two new tables, zero alterations to existing tables. Given §2.1 (11 runs / 77 feasibility rows, all churn from the abandoned app-intake/`field-agent` experiment), the recommended path is a **clean build, no back-migration**:

1. **Create the two tables** (§3.2, §3.3) + RLS + realtime + `updated_at` triggers. Additive, zero risk.
2. **The publish step** (from the north-star P0 bridge) writes new SIRs going forward: a local `diligence-report` run, on completion, creates the `site_intelligence_report` (if new) + uploads files + inserts `sir_artifact` rows.
3. **Legacy left in place.** The 77 feasibility `submission` rows, 11 `diligence_runs`, and their `diligence_artifacts` are dev/test churn — leave them untouched (the new UI simply ignores them). Optional: a one-time backfill of the ≤8 completed runs into SIRs + `version=0` artifacts, but they're churn — **recommend skipping**.
4. **Retire the vestigial feasibility submission + the old diligence_runs/artifacts tables later**, in their own migration, once nothing reads them and the app cutover is verified. That's the only destructive step and it happens last.

### Reversibility

Everything here is additive (two new tables). Retirement of the legacy tables is a separate, later, opt-in migration — so the whole thing is reversible up to that point.

---

## 5. Downstream code changes (high level — DB spec, so summarized)

- **substation**
  - The migration files (`substation/supabase/migrations/`) for the two tables + RLS + realtime.
  - A **publish endpoint** (service-role backed) the local run calls on completion: upsert the SIR, compute the next `version`, mint storage upload targets in the `sir-artifacts` bucket, insert `sir_artifact` rows, set/advance `current_version`. (The run→endpoint auth/credential mechanics belong to the P0 publish-step spec — this spec only fixes the schema it writes.)
- **cityhall**
  - **SIR list** under a project (the near-term home for catalog F1's "view all SIRs").
  - **SIR detail page**: shows the `current_version` artifacts with 72h signed URLs (View / Download); for internal staff, a version switcher over all `sir_artifact` versions with their `versioning_label`s.
  - DB type regen.
- **No changes** to conductor / surveyor / bureau, the site-plan `submission` / CRV / CRC paths, **or the intake-chat code** — the intake path is simply not on the near-term SIR flow (neither extended nor required; left dormant).
- **No `field-agent`, no Inngest event, no `requestDiligenceRun` tool** in the near-term SIR flow.

---

## 6. Decisions

- **D1 — Entity name is `site_intelligence_report`** (matches the published product).
- **D2 — Drop the `diligence_runs` reuse; the run collapses into the SIR.** `diligence_runs` is an async run-tracking table for app-triggered, worker-executed cloud runs; in the local-run world its `conversation_id` / `document_version_id` FKs and `queued`→`running` status go permanently null. Reusing it fails a 1:1 test. A local run's only DB footprint is a completion-time publish, which the SIR row + `sir_artifact` rows fully capture. (See also D9.)
- **D3 — Light, optional subject-location columns; no jurisdiction / intended-use.** The SIR carries nullable `address`, `latitude`, `longitude`, and `parcel_ids text[]` for display / map-pinning / parcel lookup — but NOT `jurisdiction_slug` or `intended_use` (add those when a use case needs them; a jurisdiction column would stay free-text since SIRs run in un-onboarded jurisdictions). `parcel_ids` is a native Postgres array (a property can span multiple parcels), preferred over a CSV string for queryability.
- **D4 — No `status`/`origin` fields near-term.** Completion-only publishing means no app-side lifecycle to model and a single origin. A coarse status (`active`/`archived`) is a trivial add when the internal dashboard (catalog F1) needs it.
- **D5 — `project` columns untouched.** `site_address`/`jurisdiction_slug` stay as-is, reclassified as optional site-plan-scoped hints (sweep verdict §2.3).
- **D6 — SIR→site-plan conversion linkage deferred.** Add a nullable link column or join table when it first happens.
- **D7 — Publishing is completion-only.** A `site_intelligence_report` row is born when a local run finishes and publishes; there is no pre-registered `in_progress` row (the run is off-app). If the app later needs to show in-flight local runs, the run process can pre-insert a row — a small additive change, not modeled now.
- **D8 — Second table is a fresh `sir_artifact` with flat versioning** (`version` int + `versioning_label`; `kind`×`format` split; `current_version` on the SIR), **not** a re-anchored `diligence_artifacts` and **not** a `sir_version` table. Covers preserve-both-versions / compare / restart / customer-sees-final in two tables.
- **D9 — RLS:** `site_intelligence_report` = verbatim clone of the `submission` project-child policy; `sir_artifact` = SELECT gated via a subquery to its parent SIR's project; writes are service-role at publish. Enable RLS on both; add both to `supabase_realtime`.
- **D10 — No intake-chat dependency.** The near-term SIR flow does not use `conversations` / `chat_message` / `document`*/ `document_section` / Gemini extraction. Those stay for whatever else uses them; SIRs don't touch them.
- **D11 — `versioning_label` lives on `sir_artifact`, accepting one controlled cost:** a label is a version-level fact but is stored once per file row of a version (report + appendix + future formats), so the publish step (the sole writer) must write it identically to every row of a version; reads take any row (`DISTINCT`). **Promote to a `sir_version` table** the day a *second* per-version attribute appears (`created_by`-per-version, `production_method`, `parent_version_id`/lineage) or a label must be editable without rewriting files. Clean upgrade: create `sir_version` with one row per distinct `(sir, version)`, swap the int for an FK.
- **D12 — Holding-org / prospect re-home is out of near-term scope** (was v2 §3.6 / D8). It exists to isolate self-serve prospect intake, which the human-kickoff model removes. Near-term SIRs are published by staff into a chosen project/org. Re-home mechanics move to the Future catalog (G1) / north-star §5.

## 7. Open questions

- **Q1 — Where does the publish step's `created_by` come from?** The local run publishes via service role; it must be told *which* staff user to stamp. (Proposed: the operator's user id passed into the publish call. Belongs to the P0 publish-step spec.)
- **Q2 — What populates `title` / `description`?** Both are optional free-text. Open: does the publish step auto-derive a `title` (e.g. from the resolved address inside the report) or does the operator supply it? Belongs to the P0 publish-step spec.
- **Q3 — When does `versioning_label` outgrow the flat column?** Track whether staff want a second per-version attribute; if so, execute the D11 promotion to `sir_version`.
- **Q4 — Retire the legacy feasibility/`diligence_runs`/`diligence_artifacts` tables when?** After the app cutover is verified; sequence the destructive migration then.

## 8. Scope boundaries (explicitly deferred)

- The intake-chat / self-serve-prospect kickoff path (not the near-term model; would be re-introduced by an `intake-productization` spec if the product wants it back).
- The `field-agent` / Inngest cloud-run execution path.
- The internal versioning UI beyond storing versions (compare view, lineage display) → promote to `sir_version` (D11) when it lands.
- Holding-org / prospect→customer conversion mechanics (→ Future G1 / north-star §5).
- SIR→site-plan conversion linkage (→ when first needed).
- Any change to the site-plan `submission` model or the CRV/CRC `jurisdiction_slug` labeling paths.
- The client-facing viewer/delivery (→ `sir-delivery-and-web-viewer`, needs the P0 publish first).
</content>
</invoke>
