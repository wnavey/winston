# Pre-Processing V2 runbook never publishes the AI sheet label to `sheet.label` — app sheet headings stay stuck on the "Sheet N" seed

> **Status:** Diagnosed 2026-08-19, fix NOT yet implemented. **Root cause is in the bureau pre-processing runbook's publisher** (`bureau/runbooks/preprocessing/scripts/publish.ts`) — it updates `sheet_version.label` but never `sheet.label`. Presents as a **cityhall UI bug** (the sheet-detail `<h1>` shows "Sheet 6" instead of the real title) — it is **not** a cityhall bug; cityhall renders the field it always has.
>
> **Discovered on:** project `ed9e7ec4-bdb4-4dcc-85fa-bb06ab70eaa9` ("Wills Pre-Processing V2 Test Project"), plan set `3560309c-1fe4-4628-b867-d00d65662472`, sheet 6 — the sanctioned Pre-Processing V2 test project. This project was processed by the new bureau pre-processing runbook (AI reading stripped from the sandbox per Phase 1).
>
> **Related:** `winston/workspaces/pre-processing-v2/PHASE-2-RUNBOOK-DESIGN-SPEC.md` (the runbook + publisher design — its publisher contract also omits `sheet.label`); `winston/workspaces/pre-processing-v2/current-architecture-diagram.html` tab 04 §C (the annotated field map where the discrepancy was first noticed).
>
> **Scope of the fix (per the task):** bureau pre-processing runbook only. The cityhall render site is documented below as the affected consumer, but is **not** where the fix goes.

---

## 1. Summary

The `sheet` table holds the **stable identity** of a physical sheet across submission versions (one row per sheet); the `sheet_version` table holds the **per-version** content. Both carry a `label`. In the old cloud pipeline, the per-sheet AI "page summary" step wrote the AI-generated label to **both** rows deliberately (see Prior Art). The app's sheet-detail heading, sheet lists, and version history all key on `sheet.label` — "what is this sheet *now*."

Pre-Processing V2 moved all AI reading out of the sandbox and into an operator-run bureau runbook (`bureau/runbooks/preprocessing/`). The runbook's deterministic publisher (`publish.ts`) faithfully writes the AI label to `sheet_version.label` — but has **no** corresponding write to `sheet.label`. So `sheet.label` is never upgraded past the mechanical seed value `"Sheet N"` that the sandbox stamps at upload time.

**Everything else works exactly as designed.** The runbook reads the drawings, the artifact carries the label, `sheet_version.label` is correct on every sheet, content blocks / summaries / reading guides / embeddings all publish correctly, and cityhall correctly renders `data.sheet.label`. The single defect is one missing DB write in the publisher.

**Root cause (one sentence):** `publish.ts` updates `sheet_version.label` but never mirrors it to `sheet.label`, and neither the artifact schema nor the Phase-2 spec's publisher contract accounts for that identity-row write, so the AI sheet name never reaches the column the app displays.

---

## 2. The bug in one diagram

```
                        PRE-PROCESSING V2 (this project)
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  UPLOAD  →  Vercel Sandbox (mechanical only, AI stripped in Phase 1)      │
  │     seeds   sheet.label          = "Sheet 6"      ← mechanical placeholder │
  │             sheet_version.label  = (null / seed)                          │
  └─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  OPERATOR RUNBOOK  (bureau/runbooks/preprocessing/)                        │
  │     reads the vector PDF, names the sheet                                  │
  │     → artifact.sheets[i] = { sheet_version_id, label: "06 - AUSTIN WATER   │
  │                              GENERAL INFORMATION - CONSTRUCTION NOTES …" } │
  │       (ArtifactSheet has sheet_version_id + label — NO sheet identity id)  │
  └─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  PUBLISHER  publish.ts  (dumb deterministic data-mover)                    │
  │                                                                           │
  │     sheet_version.update({ label: sheet.label, ... })   ✓  correct        │
  │            .eq('id', sheet.sheet_version_id)             ✓  AI title lands │
  │                                                                           │
  │     sheet.update({ label: ... })                        ✗  NEVER CALLED   │
  │            → sheet.label stays "Sheet 6"                 ✗  the gap        │
  └─────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
  ┌─────────────────────────────────────────────────────────────────────────┐
  │  CITYHALL  sheet-detail page  +page.svelte:294                             │
  │     <h1>{data.sheet.label}</h1>   →  renders "Sheet 6"   ✗  wrong title    │
  │     (loader selects sheet:sheet_id(label) AND sheet_version.label;         │
  │      the heading uses the identity row, unconditionally — no version logic)│
  └─────────────────────────────────────────────────────────────────────────┘

  Net: sheet_version.label is right everywhere; sheet.label — the column the UI
  shows — is never written by the runbook, so the heading shows the seed forever.
```

---

## 3. Symptom (as observed)

On `https://app.noeticbuild.com/project/ed9e7ec4-bdb4-4dcc-85fa-bb06ab70eaa9/plan-set/sheet/6?ps=3560309c-1fe4-4628-b867-d00d65662472`, the sheet-detail heading reads **"Sheet 6"**, even though the sheet's actual AI-transcribed title is **"06 - AUSTIN WATER GENERAL INFORMATION - CONSTRUCTION NOTES FOR COMMERCIAL SITES AND SUBDIVISION PLANS"** (visible in, e.g., the sheet's own title block and stored in `sheet_version.label`).

**Tempting-but-wrong first guesses, and why they fail:**

- *"The heading conditionally uses `sheet.label` on v1 and `sheet_version.label` on v2+."* — No such branch exists. `+page.svelte:294` renders `{data.sheet.label}` unconditionally (Evidence #1). There is no version-dependent label logic anywhere on the page.
- *"The AI naming failed for this sheet."* — It didn't. `sheet_version.label` holds the full correct title (Evidence #2). The read succeeded; only the identity-row write is missing.
- *"cityhall should just render `sheet_version.label`."* — That's one possible product change, but it's not the root cause: the invariant the old pipeline maintained is that `sheet.label` = the current AI name. The runbook is supposed to preserve that invariant and doesn't. The fix belongs in the publisher (per task scope).

---

## 4. Evidence chain

**1. The heading renders the identity row, unconditionally.**
`cityhall/src/routes/(app)/project/[projectId]/plan-set/sheet/[sheetNum]/+page.svelte:294`:
```svelte
<h1 class="text-2xl font-medium text-gray-900">{data.sheet.label}</h1>
```
The loader (`+page.ts:139-144`) selects **both** labels — `sheet:sheet_id(id, label, discipline)` and `sheet_version` (…`summary, reading_guide`… — note `sheet_version.label` is *not even selected* here) — and the summary paragraph below the heading uses `data.sheetVersion.summary`. **The heading is `sheet.label`, full stop; there is no conditional and no fallback to `sheet_version.label`.**

**2. `sheet_version.label` is correct; `sheet.label` is the seed — and it's systemic.** Live query against the Noetic App DB (`mgxqsrjutswbciyrltwd`), plan set `3560309c…`, v1:

| sheet_number | sheet_id | `sheet.label` | `sheet_version.label` | seed? |
|---|---|---|---|---|
| 1 | `95dbaa4b-…` | `Sheet 1` | `01 - COVER SHEET` | ✅ |
| 5 | `927ec1d0-…` | `Sheet 5` | `05 GENERAL NOTES SHEET` | ✅ |
| 6 | `3a66438d-a099-49a3-81b2-3e310ca2ac56` | `Sheet 6` | `06 - AUSTIN WATER GENERAL INFORMATION - CONSTRUCTION NOTES FOR COMMERCIAL SITES AND SUBDIVISION PLANS` | ✅ |
| 8 | `14bc9e8b-…` | `Sheet 8` | `08 — EXISTING CONDITIONS & DEMOLITION PLAN (1 OF 2)` | ✅ |

**Every sheet checked (12 of 12) has `sheet.label` matching the regex `^Sheet [0-9]+$` (the seed) while `sheet_version.label` carries the real title.** This is not a one-sheet fluke — the identity row was never written for any sheet in the run.

**3. The publisher writes `sheet_version.label` and nothing to `sheet`.**
`bureau/runbooks/preprocessing/scripts/publish.ts:86-102` updates `sheet_version` (including `label: sheet.label`) keyed by `sheet.sheet_version_id`. **There is no `sb.from('sheet').update(...)` call anywhere in `publish.ts`.** `grep -n "from('sheet')" publish.ts` returns nothing (only `sheet_version`). The publisher's own contract comment (`publish.ts:14`) lists the `sheet_version` fields and omits `sheet.label`.

**4. The sandbox seeds `sheet.label = "Sheet N"`.**
`substation/src/inngest/functions/process-file/plan-set.logic.ts:67-70` (v1) and `:240-244` (resubmit new sheet) insert the `sheet` identity row with `label: \`Sheet ${i}\``. In Pre-Processing V2 the sandbox no longer runs the AI page-summary step that used to overwrite it — so the seed is the last writer.

**5. The artifact has no slot for the identity label.**
`bureau/runbooks/preprocessing/scripts/lib/artifact.ts:24-34` — `ArtifactSheet` carries `sheet_version_id` and `label` (which feeds `sheet_version.label`) but **no `sheet_id` and no separate identity-label field**. So even if the publisher wanted to write `sheet.label`, the artifact as currently shaped doesn't hand it the `sheet` PK directly (it must resolve it — see Fix).

---

## 5. Timeline

| When | Event | Touched `sheet.label`? |
|---|---|---|
| Old cloud pipeline (pre-V2) | Sandbox AI page-summary step dual-wrote label to `sheet_version` **and** `sheet` (`sheet.ts:119-123`) | ✅ yes — invariant held |
| Phase 1 (shipped) | AI reading stripped from the sandbox; sandbox now only seeds `sheet.label = "Sheet N"` | ✅ seed only |
| Phase 2 (this runbook) | Runbook + `publish.ts` introduced; publisher writes `sheet_version.label`, omits `sheet.label` | ❌ **gap introduced here** |
| 2026-08-19 | Gap observed on the V2 test project sheet-detail heading | — surfaced |

**Corollaries:** (a) This is **deterministic**, not a flaky/nondeterministic miss — no run of the current publisher will ever write `sheet.label`. (b) It could not have surfaced before Phase 2, because before Phase 2 the sandbox still dual-wrote the label. (c) It is **silent**: nothing logs or fails; the row is simply left at its seed, and a seed label is indistinguishable from a legitimately un-renamed sheet.

---

## 6. Root cause

The publisher writes only the version row:

`bureau/runbooks/preprocessing/scripts/publish.ts:86-102`
```typescript
orThrow(
  await sb
    .from('sheet_version')
    .update({
      summary: sheet.summary,
      label: sheet.label,                     // ← AI label reaches sheet_version ✓
      reading_guide: sheet.reading_guide,
      block_numbering_scheme: sheet.block_numbering_scheme,
      change_type: sheet.change_type,
      change_description: sheet.change_description,
      previous_sheet_version_id: sheet.previous_sheet_version_id,
      preprocessing_run_id: run.id,
    })
    .eq('id', sheet.sheet_version_id)
    .select('id'),
  `update sheet_version ${sheet.sheet_version_id}`,
);
// ✗ MISSING: a corresponding sb.from('sheet').update({ label: sheet.label }) keyed by sheet_id
```

The missing invariant, stated precisely: **the runbook publisher must uphold the same dual-write invariant the sandbox held — `sheet.label` (identity) tracks the current AI name — but that invariant lives nowhere in the V2 artifact contract or the publisher.** The `ArtifactSheet` type (`artifact.ts:24-34`) doesn't carry the `sheet` PK, and the Phase-2 spec's publisher contract (`PHASE-2-RUNBOOK-DESIGN-SPEC.md:233-234`, and the row list at `:58-60`) lists `sheet_version.label` but never `sheet.label`. The gap is in the design, faithfully implemented.

**Near-miss / irony:** the publisher *already does exactly the required move* for documents — it resolves an identity row from its version row and updates it (`publish.ts:118-132`: read `document_version.document_id`, then `sb.from('document').update({ name, label })`). Sheets simply never got the same treatment.

### Data shapes (why the write is missing, not wrong)

```
ArtifactSheet (artifact.ts:24-34)          DB rows the publisher touches
────────────────────────────────          ──────────────────────────────────
{ sheet_version_id: "…"                →   sheet_version.id       (updated ✓)
  label:            "06 - AUSTIN…"     →   sheet_version.label    (updated ✓)
  summary, reading_guide, … }          →   sheet_version.*        (updated ✓)
  (no sheet_id, no identity label)     ✗   sheet.label            (NEVER updated)
```

---

## 7. Impact

Every consumer that reads `sheet.label` (the identity row) sees the `"Sheet N"` seed instead of the AI title, for **all** sheets processed by the V2 runbook:

| Surface | Affected? | Mechanism |
|---|---|---|
| **cityhall sheet-detail `<h1>`** | ✅ **Affected** | `+page.svelte:294` renders `data.sheet.label` |
| **cityhall sheet lists / pickers / version history** | ✅ Affected (likely) | These are documented (`sheet.ts:110-112` comment) as the reason `sheet.label` exists — "the app's sheet lists and version history want 'what is this sheet now'". Any list keyed on `sheet.label` shows "Sheet N". *(Confirm each list site during fix verification.)* |
| **cityhall image `alt` text** | ✅ Affected | `+page.svelte:475` uses `Sheet {sheetNum}: {data.sheet.label}` |
| **Conductor review (old cloud workflow)** | ⚠️ Mostly unaffected | `project-downloader.ts` renders `guide.md` / README primarily from `sheet_version.summary` / `.reading_guide`; `sheet.label` is only a fallback sheet label. Review keys on `sheet_version`, so findings are not corrupted — but any place the downloader falls back to `sheet.label` will emit "Sheet N". |
| **bureau review runbook (new)** | ⚠️ Minimal | Navigates the workspace README + drawings; not dependent on `sheet.label`. |
| **`sheet_version.label` consumers** | ✅ Unaffected | That column is written correctly. |

**⚠️ Worst case:** the defect is **deterministic and silent**. There is no log line, no failed row, no processing_state change — a seed `"Sheet N"` label is byte-for-byte indistinguishable from a sheet a reviewer legitimately left unnamed. At scale this quietly degrades every sheet heading/list in the app for V2-processed projects with zero signal.

**Cheap detector:** `select count(*) from sheet s join sheet_version sv on sv.sheet_id = s.id where s.label ~ '^Sheet [0-9]+$' and sv.label !~ '^Sheet [0-9]+$'` on any active-run plan set returns the number of un-upgraded identity rows (should be 0 after the fix).

---

## 8. Fix directions (bureau pre-processing runbook only — not yet implemented)

These are directions for the implementing agent, most principled first. **Scope: `bureau/runbooks/preprocessing/` only.** Do not modify cityhall or the substation sandbox.

### Option A — mirror the existing document identity-row pattern in `publish.ts` (recommended, lowest-touch)

The publisher already resolves + updates an identity row for documents (`publish.ts:118-132`). Do the same for sheets: in the per-sheet loop, capture the `sheet_id` from the `sheet_version` update's `RETURNING`, then update `sheet.label` with the same value. No artifact/schema change.

```typescript
// publish.ts — in the per-sheet loop, replace the sheet_version update's
// `.select('id')` with `.select('id, sheet_id').single()`, then dual-write:
const svRow = orThrow(
  await sb
    .from('sheet_version')
    .update({ /* …unchanged… */ label: sheet.label, /* … */ })
    .eq('id', sheet.sheet_version_id)
    .select('id, sheet_id')
    .single(),
  `update sheet_version ${sheet.sheet_version_id}`,
) as { id: string; sheet_id: string };

// Identity row tracks the current AI name — same invariant the sandbox held
// (substation process-file/sheet.ts:106-123). The active run defines "now",
// so writing it here keeps sheet.label consistent with publish()'s
// clear-then-apply swap semantics.
orThrow(
  await sb.from('sheet').update({ label: sheet.label }).eq('id', svRow.sheet_id).select('id'),
  `update sheet ${svRow.sheet_id} label`,
);
```

Also update the contract comment at `publish.ts:14` to add `sheet.label (identity row) := sheet_version.label`.

### Option B — thread `sheet_id` through the artifact (more "pure", higher-touch)

Keeps the publisher a pure function of the artifact (no extra DB read):
1. Add `sheet_id: string` to `ArtifactSheet` (`lib/artifact.ts:24-34`) and to `artifact-schema.json`, and add it to `validateArtifact` (require non-empty).
2. Populate it in `register.ts` (which already resolves the `sheet_version` rows and therefore has the `sheet_id` FK) — thread it into each `ArtifactSheet`.
3. In `publish.ts`, add `sb.from('sheet').update({ label: sheet.label }).eq('id', sheet.sheet_id)` after the `sheet_version` update.

Trade-off: Option A matches the publisher's existing document code and is a ~6-line change; Option B is architecturally cleaner (publisher reads only the artifact) but touches four files + the shared JSON Schema + IG's validation suite. **Recommend Option A** unless the team wants to hold the "publisher never queries" line strictly (note it already queries for `document_version.document_id`).

### Guard / validation (either option)

Add a post-publish parity assertion (in `publish.ts` after the loop, or `lib/parity.ts`): for every published sheet, `sheet.label === sheet_version.label`. Fail loud if not — this is the "fail visibly, not silently" principle the V2 design is built on.

### Repair pass for already-corrupted data

Existing V2-processed projects (like the test project) have seed `sheet.label` on every sheet. Two repair options:
1. **Re-publish** the active run(s): `bun run publish.ts <site_plan_preprocessing_run_id>` — once the fix lands, this rewrites `sheet.label` from the artifact. Preferred (single code path, deterministic).
2. **One-off SQL backfill** (if re-publish isn't practical): copy `sheet_version.label → sheet.label` for the *active* plan_set_version of each affected plan set. Must scope to the active version so an older version's label doesn't win.

### Doc-sync follow-up (not the code fix)

`PHASE-2-RUNBOOK-DESIGN-SPEC.md` publisher contract (`:233-234`) and row list (`:58-60`) omit `sheet.label`. Update them to state the dual-write so the spec and the runbook don't drift. (Flagged for whoever maintains that spec; outside the code fix.)

---

## 9. Prior art (working reference implementations in-house)

1. **The publisher's own document path — same shape, done right.** `bureau/runbooks/preprocessing/scripts/publish.ts:118-132`: resolves the identity row from the version row (`select document_id from document_version`), then `sb.from('document').update({ name, label }).eq('id', document_id)`. Sheets need the identical move.

2. **The old sandbox dual-write — the invariant, with rationale.** `substation/src/inngest/functions/process-file/sheet.ts:106-123`:
   ```typescript
   // The label is written to BOTH rows, deliberately, because they mean
   // different things:
   //   sheet_version.label — this VERSION's sheet … Never overwritten by a later run.
   //   sheet.label — the sheet IDENTITY's current name. One row per sheet,
   //     overwritten by every processing run, which is what the app's sheet
   //     lists and version history want ("what is this sheet now").
   // Writing only the second is the bug this pair fixes: a workspace built
   // from an older version got the newest version's sheet names. …
   await supabase.from('sheet_version').update({ summary, label: result.sheetLabel }).eq('id', sheetVersionId);
   await supabase.from('sheet').update({ label: result.sheetLabel }).eq('id', sheetId);
   ```
   This is the exact behavior the runbook publisher must reproduce. Note the sandbox comment even names the failure mode of writing only one row.

---

## 10. Reproduction / verification recipe

**Reproduce (SQL, read-only) — Noetic App DB (`mgxqsrjutswbciyrltwd`):**
```sql
-- Every active-version sheet whose identity label is still the seed while the
-- version label is real. Non-empty result == bug present.
select sv.sheet_number, sv.sheet_id, s.label as sheet_label, sv.label as sheet_version_label
from sheet_version sv
join sheet s              on s.id  = sv.sheet_id
join plan_set_version psv on psv.id = sv.plan_set_version_id
where psv.plan_set_id = '3560309c-1fe4-4628-b867-d00d65662472'
  and s.label  ~ '^Sheet [0-9]+$'      -- identity row still the seed
  and sv.label !~ '^Sheet [0-9]+$'      -- but the version row has a real title
order by sv.sheet_number;
```
Unambiguous row to eyeball: **sheet 6** (`sheet_id = 3a66438d-a099-49a3-81b2-3e310ca2ac56`) — `sheet.label = "Sheet 6"`, `sheet_version.label = "06 - AUSTIN WATER GENERAL INFORMATION - CONSTRUCTION NOTES FOR COMMERCIAL SITES AND SUBDIVISION PLANS"`. Or visually: load the sheet-detail URL in the Status blockquote and read the `<h1>`.

**Acceptance test (after the fix):**
1. Implement the publisher fix (Option A or B) in `bureau/runbooks/preprocessing/`.
2. Re-publish the test project's active run: `cd bureau/runbooks/preprocessing/scripts && bun run publish.ts <site_plan_preprocessing_run_id>` (find the id via `select id from site_plan_preprocessing_run where submission_version_id = <the test project's submission version> and status = 'active'`).
3. Re-run the reproduce query above → **expect zero rows.**
4. Reload the sheet-6 URL → `<h1>` reads the full Austin Water title, not "Sheet 6".
5. Confirm no regression on `sheet_version.label`, content blocks, summaries (the publisher's other writes are unchanged).
6. (If the parity guard was added) confirm the publisher logs the parity assertion passing.
