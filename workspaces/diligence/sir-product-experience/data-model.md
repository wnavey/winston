# SIR Data Model — `site_intelligence_report` entity + migration off `submission`

**Status:** Draft v2
**Date:** 2026-07-28
**Type:** Implementable spec — table creation + data migration. This is the **first build step** of the SIR product effort (companion to the north-star `DESIGN-SPEC.md`, winston#192). Concrete enough to execute.
**Repos touched:** `substation` (the migration + the `project`/intake/`diligence_runs` API + shared-DB schema), `cityhall` (intake bootstrap, intake route, reads, type regen)
**Repos NOT touched (by design):** `conductor`, `surveyor`, `bureau`, `quarry`, `navalbase`, `radar` — verified they don't depend on the columns we're reclassifying (see §2.3).

> **Revision note (v2, 2026-07-28):** Folded in the RLS / access-control research. New **§3.5** (verified RLS model + a verbatim policy template for the new table, cloned from `submission`/`diligence_runs`) and **§3.6** (the holding-org re-home mechanics + two hard constraints). New decisions **D7** (RLS template) and **D8** (holding org must be a *separate, non-`noetic`-slug* org; prospect projects created via service account; conversion must clean up stray `project_access`). §2.3 + Q2 updated with the "RLS-safe" confirmation for the `project` columns. No structural change to the table or migration plan — this is the access-control layer that was previously an open check.

> **One-line goal:** Give the Site Intelligence Report its own first-class entity — `site_intelligence_report` — instead of shoehorning it onto `submission` (which drags in plan-set / resubmittal machinery SIRs never use), and move the authoritative subject-location (address, parcel, jurisdiction) down onto that entity so one `project` can hold many SIRs at many addresses.

---

## 1. Problem

SIRs are currently modeled as `submission` rows with `submission_type = 'feasibility'` under a `project`. This is a shoehorn on two axes:

1. **`submission` is the wrong shape.** Its entire value is its children — `submission_version` (U0/U1 city resubmittal cycles), `submission_document`, `submission_plan_set` → `plan_set_version`. That's the site-plan review machinery. An SIR has none of it: no city resubmittals, no plan sets. **The SIR path already routes *around* `submission`** — the intake `conversation` FKs `project` (not submission), and `diligence_runs` FK `project + conversation + document_version` (not submission). The `submission type='feasibility'` row is a **routing placeholder** that exists only to anchor the intake URL. (Verified §2.2.)

2. **`project` conflates "an initiative" with "a place."** `project.site_address` + `project.jurisdiction_slug` assume one project = one address + one jurisdiction. But an SIR's subject location is resolved *per run* (Phase 0 of the diligence skill), and a real customer initiative (e.g. `ExtraStorage — 2026-Q4-expansion`) legitimately wants **N SIRs across N addresses/jurisdictions** under one project. Address welded to the container breaks that.

We want: `project` becomes a neutral, address-agnostic **initiative container**; SIRs become their own entity carrying their own subject location and reusing the already-built intake chat via `conversation_id`.

---

## 2. Verified current state (2026-07-28)

### 2.1 Row counts (prod, project `mgxqsrjutswbciyrltwd`)

| metric | count | implication |
|---|---|---|
| `project` | 23 | small |
| `submission` where `type='feasibility'` | 77 | mostly intake/dev churn (see runs ↓) |
| `submission` where `type='site_plan'` | 23 | the real site-plan world |
| `conversations` where `type='intake'` | 79 | ≈ 1:1 with feasibility submissions |
| `diligence_runs` total / completed | 11 / 8 | **only 11 runs ever persisted** — real client SIRs were run in Claude Code and never hit the DB |
| `project` with non-null `site_address` | **6 / 23** | address is **already vestigial** at project level |
| `project` with non-null `jurisdiction_slug` | 16 / 23 | populated by backfill, not the app |

**Takeaway:** the historical feasibility rows are overwhelmingly early-stage churn, not precious deliverables → a **clean cutover** is viable (§4), no heroic back-migration required.

### 2.2 Schema facts (from generated types + migrations)

- `project`: `id`, `name`, `owner_organization_id` (**NOT NULL** → `organizations`), `jurisdiction_slug` (nullable, FK → `jurisdictions(slug)` via `20260724000000_jurisdiction_conventions.sql`), `site_address` (nullable TEXT, **no FK/index/policy/function**), timestamps.
- `conversations`: FK **`project_id` only** (`conversations_project_id_fkey`). Columns `type`, `user_id`, `title`. **No FK to `submission`.**
- `submission`: `id`, `project_id`, `submission_type`, `name?`, `description?`. Children: `submission_version`, `submission_document`, `submission_plan_set`.
- `diligence_runs` (substation): FK `document_version_id` (the `feasibility_intake` doc), `conversation_id`, `project_id`, `triggered_by_user_id`; status enum; **no `submission` FK**. → `diligence_artifacts` (kinds `site_intelligence_report` / `research_appendix` / `supporting_document_copy`).
- `document` kinds for intake: `feasibility_intake` (sentinel `storage_path='inline://feasibility-intake'`, holds the `document_section` rows) + `intake_attachment`.
- **No RLS policy or DB function references `site_address` or `jurisdiction_slug`.**

### 2.3 The `site_address` / `jurisdiction_slug` usage sweep (verdict: CHEAP→MODERATE)

Full audit in the research sweep. Summary:

- **`site_address`** — 0 authoritative uses, 15 convenience (display, PDF filename, `?? null`/`|| 'N/A'`-guarded markdown lines) across cityhall + substation + conductor + surveyor. **Trivially a hint already.**
- **`jurisdiction_slug`** — 0 hard-authoritative; ~3 "degrades-if-null" paths, **all in the site-plan/CRC world**: CRV + comment-resolution PDF labeling (`substation/src/pdf/crv-report-data.ts`, `comment-resolution-data.ts` → `citySubmissionLabel`/`perVersionLabelMap`) and the CRC dept-name map (`cityhall/src/lib/server/jurisdictions.ts` `fetchCrcDeptMapForReview`). Plus the FK to `jurisdictions(slug)`.
- **The review engines (conductor + surveyor) do NOT read `project.jurisdiction_slug`** — they take jurisdiction as a workflow input. So no review/SIR/grounding path breaks.
- **Latent bug (out of scope, noted):** `substation/src/routes/projects.ts` `POST /projects` **silently drops `jurisdiction_slug`** that cityhall sends — today it's populated only by the backfill migration.

**Consequence for scope:** we do **not** touch the `project` columns in a breaking way. They keep serving the site-plan/CRC world unchanged. We only *add* the authoritative location to the new SIR entity. "Demotion" is a conceptual reclassification, not a migration.

**RLS-safe confirmation (v2):** a follow-up audit confirmed **no RLS policy, DB function, trigger, `NOT NULL`, or `CHECK` constraint** references `project.site_address` or `project.jurisdiction_slug`. `site_address` is a bare nullable `TEXT` (`baseline.sql:384`); `jurisdiction_slug` is nullable with column comment *"NULL until known"* (`20260720203333_*.sql:20,27`) plus an FK to `jurisdictions(slug)` (`20260724000000_*.sql:127-131`) but no null constraint. Both are safe to treat as optional hints, confirmed.

---

## 3. Target model

### 3.1 The three levels

```
organization        e.g. "ExtraStorage Containers"   (tenant/customer; + a Noetic-owned holding org for walk-in prospects)
  └─ project         e.g. "2026-Q4-expansion"         (initiative container — address-AGNOSTIC, owned by org)
       ├─ site_intelligence_report   1234 Main St     (NEW — subject location lives HERE; 1:1 → intake conversation)
       │     ├─ conversation (intake chat)            (reused as-is)
       │     └─ diligence_runs → diligence_artifacts  (v1, v2 iterations on that subject)
       ├─ site_intelligence_report   77 River Rd      (different address, same initiative)
       └─ submission (site_plan)                       (UNCHANGED — its own address + plan-set machinery)
```

- Site plans stay on `submission`.
- SIRs move to `site_intelligence_report` (name chosen to match the published product).
- `project` stays neutral; `site_address`/`jurisdiction_slug` remain as **optional display hints** (untouched — still serve site plans).
- SIR→site-plan conversion linkage: **deliberately deferred** — a nullable link column or tiny join table added the day it first happens (YAGNI).

### 3.2 New table: `site_intelligence_report`

Reference DDL (final column set to be finalized in review — this is the shape):

```sql
create table public.site_intelligence_report (
  id uuid primary key default gen_random_uuid(),

  -- container + reuse hooks
  project_id      uuid not null references public.project(id),
  conversation_id uuid references public.conversations(id),   -- the intake chat (1:1). NULL for manual/CC-published runs.

  -- subject property — AUTHORITATIVE location lives here, not on project
  requested_address text,          -- what the client typed at intake (rough / pre-resolution)
  intended_use      text,          -- "seven brew coffee shop", "61-ac raw-land retail", …
  resolved_address  text,          -- canonical, from run Phase 0 (location-resolution)
  parcel_id         text,
  latitude          double precision,
  longitude         double precision,
  jurisdiction_slug text,          -- resolved jurisdiction. NO FK — see D3.

  -- provenance + lifecycle (coarse for now — see D4)
  origin  text not null default 'app_intake'
    check (origin in ('app_intake','manual_publish')),
  status  text not null default 'draft'
    check (status in ('draft','requested','in_progress','delivered','archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on public.site_intelligence_report (project_id);
create index on public.site_intelligence_report (conversation_id);
create index on public.site_intelligence_report (status);
```

Plus: `updated_at` auto-bump trigger; RLS mirroring `project`/`submission` (project-access based); add to `supabase_realtime` for live status in the app.

### 3.3 Re-anchor `diligence_runs` onto the SIR

Add a nullable FK (backfill, then consider tightening later):

```sql
alter table public.diligence_runs
  add column site_intelligence_report_id uuid references public.site_intelligence_report(id);
create index on public.diligence_runs (site_intelligence_report_id);
```

- A `site_intelligence_report` has **many** `diligence_runs` (iterations v1/v2; the "current deliverable" = latest completed run's `diligence_artifacts`).
- Keep the existing `conversation_id` / `document_version_id` / `project_id` columns on `diligence_runs` for continuity; the new column is the primary SIR anchor.
- The publish step from the north-star P0 (interactive on-disk run → Supabase) writes a `site_intelligence_report` (origin `manual_publish`) + its `diligence_runs`/`diligence_artifacts`.

### 3.4 Intake conversation reuse

`site_intelligence_report.conversation_id` → the existing intake `conversation`. This is the load-bearing reuse hook: **everything already built for the intake chat** (composer, `document_section` tier capture, Gemini extraction, RCM cards, realtime) works unchanged — we just re-parent the *entity* the conversation belongs to from a synthetic feasibility `submission` to the SIR. `conversation_id` is **nullable** because a `manual_publish` SIR (run in Claude Code, published via the bridge) has no intake chat.

### 3.5 RLS / access control (verified)

The whole DB uses a **three-legged** project-access model defined in `substation/supabase/migrations/00000000000000_baseline.sql`. Every project-child table gates SELECT on `user_can_see_project(project_id, uid)` and writes on `get_user_project_access_level(project_id, uid) IN ('write','admin')`. `user_can_see_project` (`baseline.sql:171-194`) returns true if **any** of:

1. `is_noetic_admin(uid)` — owner/admin of the org whose slug is literally `'noetic'` (global superuser);
2. **leg 1** — the user is a member of the project's **owner org** (`project.owner_organization_id` live-joined to `organization_members`) — this also grants implicit `write` (`baseline.sql:271-273`);
3. **leg 2** — a direct per-user grant in `project_access`;
4. **leg 3** — a per-org grant in `project_access` + the user is a member of that org.

`site_intelligence_report` is a **direct child of `project`** (has a `project_id` column, no join hops) — same topology as `submission` and `diligence_runs`. So its RLS is a verbatim clone of that shape (template: `submission` `baseline.sql:1607-1622` / `diligence_runs` `20260529180000_diligence_runs.sql:82-105`):

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

field-agent / the publish step write rows via the **service role**, which bypasses RLS entirely (same as `diligence_runs` today) — so prospect-project writes don't need a user with `project_access`.

### 3.6 The holding-org re-home — validated, with two hard constraints

The prospect model (see north-star §5): un-converted / free SIRs live under a **Noetic-owned holding org**; on conversion we repoint `project.owner_organization_id` to the customer's org. The audit confirms this works and is clean — **but** two constraints must hold or it silently fails to isolate:

- **✅ Re-home is a single write.** Visibility leg 1 is a *live* join to `project.owner_organization_id`; no child row denormalizes the org. So `UPDATE project SET owner_organization_id = <customer org>` **immediately** re-scopes the project + all children (SIRs, runs, docs) in one statement — no child backfill. (Do it via service role / noetic-admin, since `UPDATE project` itself needs write access.)
- **⚠️ Constraint A — the holding org MUST be a separate, non-`noetic`-slug org.** `is_noetic_admin` keys on `organizations.slug = 'noetic'`. If the holding org *is* the `noetic` org, its owners/admins are global superusers on **every** project forever — so a re-home to a customer would **not** revoke their access. Make the holding org a distinct org with its own slug (and add staff to it as `member` role if needed), so holding-org visibility comes only from leg-1 owner-org membership and thus actually drops when `owner_organization_id` is repointed.
- **⚠️ Constraint B — conversion must clean up stray `project_access` grants.** A `grant_project_creator_access` trigger (`baseline.sql:306-325`) auto-inserts an **`admin`** `project_access` row for `auth.uid()` on every project INSERT — and that grant **survives a re-home**. So whoever created the prospect project keeps admin unless conversion deletes it. Mitigation: **create prospect projects via a service account** (the trigger's `IF auth.uid() IS NOT NULL` guard then skips it), and have the conversion routine sweep leftover `project_access` rows. Confirm which path the publish step / field-agent uses.
- Note: `owner_organization_id` FK is `ON DELETE RESTRICT` (`baseline.sql:387`) — the holding org can't be deleted while any project still points at it. Operationally fine.

---

## 4. Data migration

Given §2.1 (11 runs ever, 6/23 projects with address → the historical feasibility rows are churn), the recommended path is a **clean cutover**, not a full 1:1 back-migration.

### Recommended: clean cutover (D2 = option A)

1. **Create the table** (§3.2) + the `diligence_runs.site_intelligence_report_id` column (§3.3). Additive, zero risk.
2. **Cut the app over going forward** (§5): intake bootstrap creates a `site_intelligence_report` (+ conversation) instead of a `submission type='feasibility'`; the publish step (P0) creates `manual_publish` SIRs.
3. **Targeted migration of only what's worth keeping** — the runs that actually persisted. For each of the **11 `diligence_runs`**: create a `site_intelligence_report` from its `project_id` + `conversation_id` + intake `document_version`, set `site_intelligence_report_id` on the run, carry any resolved location we have. (8 completed; 11 total — trivial volume, do it deterministically by run.)
4. **Archive the churn.** The remaining ~77 feasibility `submission` rows with no persisted run are dev/test intake churn. Options: soft-archive (leave in place, ignored by the new UI) or hard-delete after a verification window. Recommend **soft-archive first, delete after the app cutover is verified.**
5. **Retire the vestigial feasibility submission** once no code path creates or reads `submission type='feasibility'`.

### Alternative: full 1:1 migration (D2 = option B)

Create a `site_intelligence_report` for every one of the 77 feasibility submissions, best-effort pairing each to an intake conversation. **Wrinkle (Q1):** there is **no FK** between `submission` and `conversations` — both only FK `project`. When a project has multiple feasibility submissions + conversations, pairing must be heuristic (created-at proximity, or via the shared `feasibility_intake` document). Given the churn, this heroics isn't worth it → **recommend option A.**

### Reversibility

The migration is additive (new table + new nullable column). Cutover is a code change. Deletion of old feasibility submissions is the only destructive step and happens **last, after verification**, in its own migration — so the whole thing is reversible up to that point.

---

## 5. Downstream code changes (high level — DB spec, so summarized)

- **cityhall**
  - Intake bootstrap (`src/routes/(app)/project/[projectId]/+page.server.ts`) creates a `site_intelligence_report` + `conversation` instead of a feasibility `submission`.
  - Intake route `/project/[id]/submission/[submissionId]/intake/[conversationId]` → re-nest under the SIR (e.g. `/project/[id]/sir/[sirId]/intake/[conversationId]`).
  - `requestDiligenceRun` / diligence trigger: anchor on `site_intelligence_report_id`.
  - Reads that assume a feasibility `submission`; regen DB types.
- **substation**
  - Migration files (all live in `substation/supabase/migrations/`).
  - Diligence trigger route validates against the SIR entity; `diligence_runs` insert sets `site_intelligence_report_id`.
  - Publish-step endpoint (P0) creates `manual_publish` SIRs.
- **No changes** to conductor/surveyor/bureau or the site-plan `submission` / CRV / CRC jurisdiction-labeling paths.

---

## 6. Decisions

- **D1 — Entity name is `site_intelligence_report`** (matches the published product), not `feasibility_engagement`.
- **D2 — Migration = clean cutover** (option A §4): stand up the table, cut the app over, targeted-migrate only the 11 persisted runs, soft-archive then delete the ~77 churn rows. Rationale: the data is early-stage churn; a full back-migration fights a non-FK pairing problem for no real value.
- **D3 — No FK on `site_intelligence_report.jurisdiction_slug`.** SIRs run in arbitrary jurisdictions, many not yet in the `jurisdictions` registry (the skill generates feasibility-guides on first encounter). An FK to `jurisdictions(slug)` — as `project` has — would block SIRs in novel jurisdictions. Keep it free-text/nullable.
- **D4 — `status` stays coarse** (`draft/requested/in_progress/delivered/archived`) for now. The granular HITL lifecycle (hitl1_review, report_draft, hitl3_review, …) from the north-star spec lands with the `staff-review-collaboration` child spec, not here — don't bake an unfinished state machine into the table.
- **D5 — `project` columns untouched.** `site_address`/`jurisdiction_slug` stay as-is, reclassified conceptually as optional site-plan-scoped hints. No breaking migration on them (sweep verdict §2.3).
- **D6 — SIR→site-plan conversion linkage deferred.** Add when it first happens (nullable link column or join table).
- **D7 — RLS = verbatim clone of the `submission`/`diligence_runs` project-child policy** (§3.5). SELECT via `user_can_see_project`, writes via `get_user_project_access_level(...) IN ('write','admin')`, DELETE admin-only; enable RLS; add to `supabase_realtime`. No new access function needed — the three-legged model already covers it.
- **D8 — Holding org is a separate, non-`noetic`-slug org; prospect projects are created by a service account.** (§3.6) Required for the re-home to actually isolate: keeps holding-org staff off the `is_noetic_admin` superuser path, and avoids the `grant_project_creator_access` trigger minting a surviving admin grant. Conversion must also sweep stray `project_access` rows.

## 7. Open questions

- **Q1 — Historical conversation pairing.** If we ever do option B, how to pair the 77 feasibility submissions to their intake conversations with no FK? (Proposed: via the shared `feasibility_intake` document, or created-at proximity.) Moot under the recommended option A.
- **Q2 — Requestor / prospect identity.** Where does "this SIR was requested by contact X at prospective-org Y" live — on the SIR, the project, or a lightweight lead record under the holding org? Deferred to the `intake-productization` / delivery spec; not needed for this migration. The holding-org *mechanics* are now validated (§3.6) and the model is captured in north-star §5; what's still open is only where the requestor *contact* details live.
- **Q3 — Tighten `diligence_runs.site_intelligence_report_id` to NOT NULL later?** Starts nullable for the additive migration; once all runs originate from an SIR, consider requiring it.
- **Q4 — Do we also want an explicit `project.kind`?** Current answer: no (D-level in the north-star spec — type lives on the work product, project stays neutral). Revisit only if list/query pain appears.

## 8. Scope boundaries (explicitly deferred)

- The granular HITL lifecycle state machine (→ `staff-review-collaboration`).
- Requestor/prospect identity + the holding-org auto-creation mechanics (→ `intake-productization`).
- SIR→site-plan conversion linkage (→ when first needed).
- Any change to the site-plan `submission` model, or the CRV/CRC `jurisdiction_slug` labeling paths.
- The `substation POST /projects` `jurisdiction_slug` drop bug (noted §2.3; separate fix).
- The client-facing viewer/delivery (→ `sir-delivery-and-web-viewer`, needs P0 publish first).
