# Brittle plan_set vs document Classification on Upload

**Status:** Draft v1
**Date:** 2026-07-14
**Repos touched:** `substation` (classifier + commit-upload guard), possibly `cityhall` (dropzone UX)
**Repos NOT touched:** `bureau`, `conductor`, `cityhall` beyond optional UX affordance

## Problem

When files are dropped on the submission-page dropzone, substation auto-classifies each PDF as `plan_set` or `document` using a single mechanical rule, and the `plan_set` branch has a catastrophic failure mode. The classification (`substation/src/lib/classify.ts:1–29`):

```ts
const PLAN_SET_THRESHOLD_PTS = 11 * 72; // 792 pts
// ...
const dims = await getPdfPageDimensions(fileBuffer);   // FIRST PAGE ONLY
if (dims && Math.min(dims.width, dims.height) > PLAN_SET_THRESHOLD_PTS) {
  return { classification: 'plan_set', ... };
}
return { classification: 'document', ... };
```

That is: **a PDF is a plan set iff page 1 is strictly larger than 11" on both sides.** No page-count signal, no filename signal, no content signal, no uniformity check across pages.

### Measured on real data (Lamar + Collier v5 game day, 2026-07-14)

Checked the actual v5 submission package (project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`):

| File | Page 1 size | min side | Classified |
|---|---|---|---|
| `1700 S Lamar.pdf` (real plan set, 66 pages) | 24.0 × 36.0 in (1728 × 2592 pts) | 24.0 in | plan_set ✓ |
| `DE1- Impervious Cover Plans.pdf` (10 pages) | 11.0 × 17.0 in (792 × 1224 pts) | **11.0 in = exactly 792 pts** | document — **by a margin of 0 points**, saved only by the strict `>` |
| `260609 Response Letter_Noetic.pdf` (61 pages) | 8.5 × 11 in | 8.5 in | document ✓ |
| `SP15 / WQ4 / WQ5` | 8.5 × 11 in | 8.5 in | document ✓ |

Real Austin plan sheets are Arch D (24 × 36) — more than double the threshold. The 11" line sits in a no-man's-land where ordinary supporting documents (ledger/tabloid exhibits, oversized plats, survey scans) live.

### Failure modes

1. **False positive → duplicate plan_set (the catastrophic one).** Any supporting document larger than 11 × 11 on page 1 — a 12 × 18 exhibit, an 11.5 × 17 scan, a rotated plat — routes to `handlePlanSetUpload` (`substation/src/routes/submissions.ts:674–675` via auto-classify at `:655`, or `:482–483` when the client declares the classification). That handler (`submissions.ts:742–793`) **always INSERTs a brand-new `plan_set` row and a new `submission_plan_set` junction, without unlinking the existing one**. A submission version with an existing plan set ends up with two junctions, which:
   - breaks every `.maybeSingle()` reader (e.g. `substation/src/routes/plan-sets.ts:155–160`, the cityhall submission-page loader) — the page 500s;
   - severs prior↔current sheet lineage, killing the version diff and any CRC/CC run that depends on `change_type`/reading-guide inheritance.

   This is Gotcha G1 from the v5 game-day spec (`workspaces/comment-resolution-check/lamar-collier-v5-game-day/DESIGN-SPEC.md`) — today it is avoided purely by operator discipline ("never drop the plan set on the dropzone") plus luck on document page sizes.

2. **False negative → half-size plan sets silently degrade.** 11 × 17 half-size plan sets are a common submission format. min side = exactly 792 pts fails the strict `>`, so the whole set classifies as `document`: no sheet split, no per-sheet analysis, no reading guides — the submission looks processed but is unreviewable.

3. **First-page-only sampling.** A plan set with a letter-size cover/transmittal page bound in front classifies as `document`; a letter document with one foldout page 1 classifies as `plan_set`.

4. **Zero-margin behavior at the boundary.** `DE1` demonstrates the knife edge: 792.0 pts vs a `> 792` comparison. A scanner producing 792.5 pts (11.007") flips the outcome.

## Decisions (proposed)

**D1 — Guard `handlePlanSetUpload` against an existing plan set (highest value, smallest change).** Before inserting, check whether the active submission version already has a `submission_plan_set` junction. If yes, reject with a 409 (`plan_set_exists`, message pointing at the Plan Set replace flow) instead of silently creating a duplicate. This caps the blast radius of *any* misclassification — the G1 disaster becomes an actionable error instead of silent corruption. Independent of classifier quality; ship first.

**D2 — Move the threshold out of document territory and add an ambiguity band.**
- min side ≥ 18" (Arch C and up) → `plan_set` confidently.
- min side ≤ 11" → `document` confidently.
- 11"–18" band (ledger exhibits vs half-size plan sets) → do not guess from size alone; use cheap corroborating signals: page count (plan sets are many-page), page-size uniformity across all pages (plan sets are uniform), filename hints ("plan", "sheet", "set"), and if still ambiguous fall back to `document` + a `processing_event` warning, or an LLM call on page 1 (we already rasterize downstream).

**D3 — Sample more than page 1.** Classify from the modal page size over the first N (e.g. 5) pages, not page 1 — kills the cover-sheet failure mode for ~zero cost.

**D4 (optional, cityhall) — Dropzone confirmation for plan_set classification.** If commit-upload classifies a file as `plan_set` on a version that already has one, surface "this looks like a plan set — replace the existing plan set?" and route through the Plan Set replace flow rather than erroring. UX sugar on top of D1's hard guard.

## Scope boundaries

- Not touching the Plan Set page replace flow (`plan-sets.ts:104–228`) — it is the correct path and works.
- Not proposing schema changes (unique constraint on `submission_plan_set.submission_version_id` is tempting but needs a data audit for existing duplicates first — see Q3).
- Zip-upload plan-set handling (`handleZipUpload` → triage) is out of scope for v1.

## Open questions

- **Q1 — Band boundaries.** Is 18" the right confident-plan_set floor? Arch C (18 × 24) sets exist; ANSI C (17 × 22) would fall in the band. Alternative: confident floor at 17".
- **Q2 — Reject vs auto-redirect in commit-upload.** D1 proposes a 409. Should substation instead auto-invoke the replace path when the classified plan_set arrives on a version that already has one? (Recommendation: no — replace is destructive-ish and should stay an explicit UI action; 409 + D4 dialog is safer.)
- **Q3 — Is one-plan-set-per-version an invariant?** Readers assume it (`.maybeSingle()`), but the schema doesn't enforce it. Should we add a unique index on `submission_plan_set(submission_version_id)` after auditing prod for existing violations?
- **Q4 — Half-size (11 × 17) plan sets: support or reject?** If a jurisdiction/customer submits half-size sets, size-based classification can't separate them from ledger exhibits — this is what forces the ambiguity band + content signals. If we declare full-size-only, the band can simply resolve to `document`.
- **Q5 — How many pages to sample (D3)?** First 5? All pages capped at N? Modal size vs max size?
