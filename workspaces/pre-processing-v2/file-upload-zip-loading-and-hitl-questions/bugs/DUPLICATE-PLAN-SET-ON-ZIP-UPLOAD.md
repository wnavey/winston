# Duplicate `plan_set` minted on zip / generic upload — versioning silently breaks the one-plan-set-per-project invariant

> **Status:** Diagnosed 2026-09-16, fix NOT implemented. Root cause is in **substation** (`process-file` zip pipeline + `handlePlanSetUpload`). Discovered on project **Lamar + Collier** (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`) after a real zip upload on 2026-09-16 created a second `plan_set` for submission version 8 instead of appending an 8th version to the existing one. Related spec: `../DESIGN-SPEC.md` (winston#240) — which already flagged "both fresh-upload paths mint a new `plan_set`" and "the one-plan-set invariant is convention-only (no DB constraint)". This bug is the current-state manifestation of exactly that gap, now that the `replaceExistingPlanSet` collision policy (§D5) has been implemented but does *not* actually collapse to one plan set.

## Summary

When a plan set is uploaded through the **zip pipeline** (or the direct generic-dropzone `handlePlanSetUpload` path) into a draft submission version, the system mints a **brand-new `plan_set` row** rather than adding a new `plan_set_version` under the project's existing `plan_set`. The result is two `plan_set` rows for one project — a duplicate that violates the one-plan-set-per-project invariant the code claims to protect.

What is **corrupted**: the new draft version's plan-set *identity*. The upload created `plan_set fada2510` ("1700 S Lamar Site Plan") for submission v8, sitting alongside the canonical `plan_set 908ffab5` ("Plan Set") that has carried v1–v7. The draft version's inherited link to the canonical plan set was **unlinked** (not preserved), severing v8 from its lineage.

What is **working correctly** (don't rip these up):
- **Prior submission versions (v1–v7) are untouched.** `908ffab5` still owns all seven versions, each correctly linked. No historical corruption.
- **Classification and winner election worked.** The plan-set PDF inside the zip was correctly detected (`>11″` gate) and elected the winner; the ~11 supplemental PDFs correctly became documents, and at least one (Pond Maintenance covenant) correctly versioned onto its existing `document`. The document path's cross-version matching is fine.
- **The downstream processing pipeline ran exactly as designed** — it just ran against the wrong (brand-new) `plan_set_id`, so it faithfully processed v8 as a *first* version with no prior to diff against.

**Root cause, one sentence:** both fresh-upload plan-set paths call `replaceExistingPlanSet(submissionVersionId)` — which only unlinks the *inherited* plan-set link scoped to that submission version — and then **unconditionally `INSERT` a new `plan_set` row**, never looking up the project's existing `plan_set` to reuse its `id` (the exact thing the `POST /plan-sets/:id/replace` route already does correctly).

## The bug in one diagram

```
ZIP UPLOAD  S_Lamar_u2_draft.zip → submission v8 (draft, 7fe4352b)
│
├─ classify.ts            → 'zip'                                                ✓
├─ processZip triage      → elect plan-set winner: 260916_1700 S Lamar.pdf       ✓
│
└─ registerWinnerAsPlanSet(sv=v8)                          zip.ts:327
     │
     ├─ replaceExistingPlanSet(sb, v8)                     zip.ts:348
     │     │  v8 INHERITED a junction link → v7's psv c88e89b3 (plan_set 908ffab5)
     │     └─ psv.submission_version_id (v7) !== v8  →  UNLINK ONLY   ✗ lineage cut
     │        (908ffab5 left intact but now detached from v8)         plan-set-collision.ts:44-50
     │
     ├─ INSERT INTO plan_set (project_id, name)            zip.ts:353  ✗✗ NEW plan_set fada2510
     │        └──────────── never queries "does this PROJECT already have a plan_set?" ────┐
     ├─ INSERT INTO plan_set_version (plan_set_id = fada2510, sv = v8)  zip.ts:360         │
     └─ INSERT INTO submission_plan_set (v8 → new psv d87a4d4f)         zip.ts:372         │
                                                                                           │
DOWNSTREAM (correct-by-design, propagates the wrong id) ────────────────────────────────  │
   plan-set.ts processing → fetchPriorVersion(plan_set_id = fada2510)   plan-set.logic.ts:32
        .eq('plan_set_id', fada2510).neq(sv, v8)  →  NULL  (908ffab5's versions are a
        DIFFERENT plan_set_id)  →  v8 processed as a NEW v1 plan set, NO diff vs v7  ✗

RESULT
   project 23301a8a
   ├─ plan_set 908ffab5 "Plan Set"           v1..v7   ✓ intact, but no longer linked to v8
   └─ plan_set fada2510 "1700 S Lamar Site Plan"  v8   ✗ duplicate; should have been 908ffab5 v8

CONTRAST — the CORRECT pattern already in the codebase:
   POST /plan-sets/:id/replace   plan-sets.ts:241-258
     INSERT plan_set_version (plan_set_id = <existing planSetId>, sv = active)   ✓ reuses id
```

## Symptom (as observed)

On 2026-09-16 a zip (`S_Lamar_u2_draft.zip`, "Lamar + Collier Noetic U2 Submittal") was uploaded as the documents for project **Lamar + Collier** (`23301a8a-4cdb-4751-ac0c-93b97f0f5c12`), landing on **draft submission version 8** (`7fe4352b-e745-4d3b-90fe-d16c1eab9439`). The operator expected the plan-set PDF inside to bump the existing plan set to a version 8. Instead the project now shows **two** plan sets.

Tempting-but-wrong first guesses, and why they die on contact with the data:
- *"It corrupted the older versions too."* — No. `submission_plan_set` for v1–v7 all still point at `908ffab5`'s versions (Evidence #2). Only v8 is affected.
- *"v8 has two plan sets linked."* — No. v8's `submission_plan_set` has exactly **one** row, to the new dupe `d87a4d4f`. The "two" the operator sees is at the **project** level (two `plan_set` rows), not two links on v8. The inherited link to `908ffab5` was removed, not duplicated.
- *"Classification put the plan set in as a document."* — No. The winner was correctly classified `plan_set` (job `1887594d`, `classification='plan_set'`, `produced_plan_set_id=fada2510`). It became a real plan set — just a *new* one.

## Evidence chain

1. **Two `plan_set` rows exist for one project; the second was created the moment of upload.**
   `908ffab5` "Plan Set" created `2026-04-20`; `fada2510` "1700 S Lamar Site Plan" created `2026-09-16 15:10:34` (the upload). **A project is never legitimately multi-plan-set — this is the invariant violation, materialized.**

2. **Versions v1–v7 are intact under the canonical plan set; only v8 diverged.** `submission_plan_set` ⋈ `plan_set_version` ⋈ `plan_set` by submission version:

   | submission v | plan_set_version | plan_set | name |
   |---|---|---|---|
   | 1 | 56c2b95c | 908ffab5 | Plan Set |
   | 2 | bd5a2082 | 908ffab5 | Plan Set |
   | 3 | c2f5898b | 908ffab5 | Plan Set |
   | 4 | e9111f12 | 908ffab5 | Plan Set |
   | 5 | 0ed28405 | 908ffab5 | Plan Set |
   | 6 | 0811518d | 908ffab5 | Plan Set |
   | 7 | c88e89b3 | 908ffab5 | Plan Set |
   | **8** | **d87a4d4f** | **fada2510** | **1700 S Lamar Site Plan** |

   **Every version before v8 shares `908ffab5`; v8 alone points at the dupe.** The historical flow (direct upload / `POST /versions` carry-forward) reused the plan set correctly for v2–v7; the new zip pipeline did not.

3. **The zip winner job recorded the new plan set as its own product — no HITL decision was raised.** `file_upload_job 1887594d` (`source_file_name='260916_1700 S Lamar.pdf'`, `classification='plan_set'`, `status='done'`, `produced_plan_set_id='fada2510'`, `storage_path='23301a8a…/plan-set/v8/source.pdf'`). There is **no `file_upload_decision`** for this project — the zip winner path never runs the `findExistingPlanSetOnVersion` collision check that `handlePlanSetUpload` runs, so nothing was held for the operator; it went straight to replace-and-mint. **Silent.**

4. **The dupe's version was processed as a fresh plan set, not a diff of v7.** Sheet/block counts:

   | plan_set_version | plan_set | sheet_versions | content_blocks |
   |---|---|---|---|
   | c88e89b3 (v7) | 908ffab5 | 67 | 496 |
   | d87a4d4f (v8) | fada2510 | 72 | 0 |

   v8 has its own 72 sheet_versions with **zero prior-version continuity** — because `fetchPriorVersion` keys on shared `plan_set_id` (Root cause), and `fada2510 ≠ 908ffab5`, so the prior lookup returned null. **The lineage break is not cosmetic: v8's sheets have no `previous_sheet_version_id` relationship to v7's sheets.**

5. **The inherited link was removed, not preserved.** v8's `submission_plan_set` contains only the row to `d87a4d4f`. The row that (on draft-version creation) linked v8 → `c88e89b3`/`908ffab5` is gone — deleted by `replaceExistingPlanSet`'s "unlink inherited" branch. This is why the operator sees the *old* plan set as an orphan at the project level rather than attached to v8.

## Root cause

Two call sites mint instead of reuse. Both first call `replaceExistingPlanSet`, which for a fresh draft version only *unlinks the inherited link* and then leaves the caller to create a plan set:

**`substation/src/inngest/functions/process-file/zip.ts:344-358`** — the path this incident took:
```ts
// Auto-replace any plan set this submission version already owns (§D5) …
await replaceExistingPlanSet(sb, submissionVersionId);           // :348  unlinks inherited v7 link

const fileStoragePath = planSetSourceKey(projectId, versionNumber);
await uploadFromSandbox(sandboxId, sandboxPath, fileStoragePath, 'application/pdf');

const { data: ps } = await sb
  .from('plan_set')
  .insert({ project_id: projectId, name: group.name })          // :353  ✗ ALWAYS a new plan_set
  .select('id')
  .single();
```

**`substation/src/routes/submissions.ts:1441-1481`** — `handlePlanSetUpload`, same shape (`replaceExistingPlanSet(sb, svId)` then `sb.from('plan_set').insert(...)`).

**`substation/src/lib/plan-set-collision.ts:28-78`** — `replaceExistingPlanSet` is **scoped to the submission version** via the `submission_plan_set` junction, and explicitly *skips* (only unlinks) any psv that belongs to a prior version:
```ts
// Only replace versions this submission version OWNS — never an inherited
// link from a prior version (that would delete another version's data).
if (!psv || psv.submission_version_id !== svId) {
  await sb.from('submission_plan_set').delete()… ;   // :45-49  unlink inherited, then continue
  continue;
}
```

**The missing invariant:** neither caller ever asks *"does this **project** already have a `plan_set`?"* — the reuse key is `project_id`, but every lookup here (`replaceExistingPlanSet`, `findExistingPlanSetOnVersion` at `submissions.ts:1283-1308`) is keyed on `submission_version_id`. A fresh draft version owns nothing yet, so the guard is a no-op and the `INSERT` always wins. **The one-plan-set-per-project rule exists only as a comment (`plan-set-collision.ts:9` "A project is never legitimately multi-plan-set"); there is no DB unique constraint and no project-scoped reuse query.**

Irony / near-miss: the correct code already exists one file over.

## Impact

Every consumer of a project's plan set, enumerated:

- ⚠️ **Sheet-version lineage / plan-set diffing — silently wrong.** `fetchPriorVersion` (`plan-set.logic.ts:24-39`) keys on shared `plan_set_id`. A duplicated plan set means the new version can never find its predecessor, so it is processed as a first-ever version: no "modified/added/unchanged" change summary, no `previous_sheet_version_id` chain. No error is logged — it just looks like a brand-new plan set. This is the worst case: **a decision-affecting data loss with no trace.**
- **Project plan-set list (cityhall UI) — visibly wrong.** Two plan sets render where one should; the operator's reported symptom.
- **Review / CC / CRC runs over v8 — affected downstream.** Any run that resolves "the plan set for this submission version" now resolves the dupe; sheet references are internally consistent within v8 but disconnected from the v1–v7 history.
- **Historical versions v1–v7 — unaffected.** They remain under `908ffab5` with intact links (Evidence #2). This bug does not rewrite prior versions.
- **The zip's supplemental documents — unaffected.** They classified and versioned independently and correctly.

**Determinism:** deterministic for the zip winner path and the direct `handlePlanSetUpload` path whenever the target is a **draft version that owns no plan set yet** (i.e. the normal "new submission cycle" case). It does **not** fire on the `POST /plan-sets/:id/replace` route, which reuses the id correctly.

**Cheap detector:** more than one `plan_set` row per `project_id`:
```sql
SELECT project_id, count(*) FROM plan_set GROUP BY project_id HAVING count(*) > 1;
```

## Fix directions (not yet implemented — directions, not a mandate)

1. **Fix the invariant: reuse the project's existing `plan_set_id`.** Before minting, both `registerWinnerAsPlanSet` (zip.ts) and `handlePlanSetUpload` (submissions.ts) should look up an existing `plan_set` **by `project_id`**; if found, INSERT the new `plan_set_version` under that `plan_set_id` (and only create a `plan_set` when the project has none). This is precisely what `POST /plan-sets/:id/replace` (`plan-sets.ts:241-258`) already does — factor that into a shared helper (e.g. `appendPlanSetVersion(projectId, svId, sourceKey)`) and call it from all three sites. This also *restores* lineage because `fetchPriorVersion` will then resolve v7.
2. **Cheap guard: a partial unique index** `unique (project_id)` on `plan_set` (or a check in a shared insert helper) so a second mint fails loudly instead of silently duplicating. Confirm no legitimate multi-plan-set project exists first (query above returns only this incident).
3. **Detection + repair pass for already-corrupted data.** See the companion repair (re-parent v8's `plan_set_version` onto `908ffab5`, then delete the childless dupe). Repair hazard: `plan_set` and `plan_set_version` cascade-delete their `sheet`/`sheet_version` children, so a dupe cannot simply be `DELETE`d without first re-parenting the version and its sheets, or v8 loses its plan set entirely.

## Prior art (correct pattern, in-repo)

`substation/src/routes/plan-sets.ts:241-258` — `POST /plan-sets/:id/replace` inserts a new `plan_set_version` under the **existing** `plan_set_id` and links the junction. `plan-set.logic.ts:24-39` (`fetchPriorVersion`) then resolves the prior version off the shared `plan_set_id`, and `plan-set.ts` branches to the v1-vs-v2 diff. The whole correct lifecycle is already wired — the fresh-upload paths just don't use it.

## Reproduction / verification recipe

Pull the current corrupted state (Noetic App project `mgxqsrjutswbciyrltwd`):
```sql
-- Expect TWO rows for this project (the bug); a fixed project has one.
SELECT id, name, created_at FROM plan_set
WHERE project_id = '23301a8a-4cdb-4751-ac0c-93b97f0f5c12' ORDER BY created_at;

-- v8 points at the dupe fada2510; v1–v7 point at 908ffab5.
SELECT sv.version_number, ps.id AS plan_set_id, ps.name
FROM submission_version sv
JOIN submission sub ON sv.submission_id = sub.id
LEFT JOIN submission_plan_set sps ON sps.submission_version_id = sv.id
LEFT JOIN plan_set_version psv ON psv.id = sps.plan_set_version_id
LEFT JOIN plan_set ps ON ps.id = psv.plan_set_id
WHERE sub.project_id = '23301a8a-4cdb-4751-ac0c-93b97f0f5c12'
ORDER BY sv.version_number;

-- The winner job that minted the dupe, no HITL decision raised.
SELECT id, source_file_name, classification, status, produced_plan_set_id
FROM file_upload_job WHERE produced_plan_set_id = 'fada2510-4090-4310-8c89-21d502a9520f';
```
Acceptance test for the fix: upload a plan-set-bearing zip to a fresh draft version of a project that already has a plan set, and assert `SELECT count(*) FROM plan_set WHERE project_id = :p` stays `1`, the new `plan_set_version` shares the existing `plan_set_id`, and `fetchPriorVersion` resolves the immediately prior version (non-null change summary).

### Key identifiers (this incident)
- Project: `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` (Lamar + Collier) · Submission: `cf1201c2-2e8b-4034-9a5e-a70b6317e39a`
- Draft SV8: `7fe4352b-e745-4d3b-90fe-d16c1eab9439` · SV7: `0e308099-7304-42e2-93a3-e5007af2e73c`
- Canonical plan_set: `908ffab5-9bf8-4155-b9f7-b3c3be0663ff` ("Plan Set", v1–v7); v7 psv `c88e89b3-5d4b-48eb-8e3c-e5897fea2b28`
- Dupe plan_set: `fada2510-4090-4310-8c89-21d502a9520f` ("1700 S Lamar Site Plan"); v8 psv `d87a4d4f-d8c7-4d4d-9684-632e59f53ac5`
- Zip job: `dd459760-a985-42f8-987a-515a92aa604c` · winner child job: `1887594d-062d-4e5e-af43-ec69d2a18401`
