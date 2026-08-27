# File-Upload Loading + HITL — Implementation Status & Handoff

**Updated:** 2026-08-27
**Spec:** `DESIGN-SPEC.md` (this directory). **Spike results:** `detection-config.ts` header comment (substation) + Appendix B of the spec (PR wnavey/winston#241).
**Purpose:** a self-contained handoff so a fresh session can pick up the work. Read this first, then the spec.

---

## TL;DR

Phase A (loading spine) and most of Phase B (HITL decisions) are **merged to `main`** in substation + cityhall. The **exact-duplicate** vertical and the **text-route fuzzy detector** are complete end-to-end. What remains: the **visual detection route**, the **plan-set cases**, the remaining **cityhall decision cards**, and — most importantly — **staging validation** (everything merged was verified typecheck + unit-test only; the DB/sandbox integration paths have never actually run).

---

## Merged PRs (all on `main`)

| Repo | PR | What |
|---|---|---|
| substation | **#222** | Phase A: `file_upload_job` table + Realtime publication + pipeline job-writes |
| cityhall | **#637** | Phase A: zip→children loading surface + `subscribeToRows` migration |
| substation | **#223** | Phase B foundation: `file_upload_decision` + `content_sha256` migration; pure modules — `detection-config.ts`, `text-similarity.ts`, `content-hash.ts`, `file-upload-decision.ts` |
| substation | **#224** | Exact-dup pre-check + off-slot hold + resolve endpoint (`POST /api/file-upload-decisions/:id/answer`) + `detect-select.ts` |
| cityhall | **#638** | "Pending" section (D20) + `exact_duplicate` card + resolve proxy (`/api/file-upload-decisions/[decisionId]/answer`) |
| substation | **#227** | Fuzzy detector — TEXT route (in-sandbox `pdftotext` → 3-gram shingle Jaccard, doc↔doc, `doc_version_or_separate` decision + hold) |

**Migrations applied in prod:** `20260825000000_file_upload_job.sql` (#222), `20260825000100_file_upload_decision.sql` (#223, adds `content_sha256`). #224 and #227 added no migrations.

---

## Where the code lives

**substation**
- `src/lib/detection-config.ts` — all calibratable cutoffs (seeds; spike findings in the header).
- `src/lib/text-similarity.ts` — pinned tokenizer + k-gram shingle set-Jaccard (pure, tested).
- `src/lib/content-hash.ts` — `computeSha256` + `findExactMatchInVersion` (index-scoped byte-equality lookup).
- `src/lib/file-upload-decision.ts` — question_type/choice model, `outcomeFor` mapping, `createDecision` (flips job → `awaiting_decision`).
- `src/lib/detect-select.ts` — D25 argmax/threshold selector (pure, tested).
- `src/lib/file-upload-job.ts` — best-effort job create/update/mirror helpers.
- `src/routes/submissions.ts` — prepare/commit-upload; exact-dup pre-check + hold wired in the document branch.
- `src/routes/file-upload-decisions.ts` — the resolve endpoint (`applyOutcome`: separate/keep/discard/version/replace; `promote` returns 422 = deferred).
- `src/inngest/functions/process-file/detect.ts` — `runFuzzyDetection` (TEXT route; visual + cross-type are TODOs here).
- `src/inngest/functions/process-file/document.ts` — `processDocument` returns `{ heldForDecision }`; calls detection after rasterization.
- `src/inngest/functions/process-file/main.ts` — threads `jobId`; skips the job mirror when held.

**cityhall**
- `src/lib/ui/pending/decision.ts` — `PendingDecision` type + `question_type → component` registry.
- `src/lib/ui/pending/ExactDuplicateDecision.svelte` — the only card built so far.
- `src/lib/ui/pending/PendingSection.svelte` — the "Pending" section (D20); generic fallback row for unbuilt card types.
- `src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.ts` — loads `pendingDecisions` + `uploadJobs`.
- `src/routes/(app)/.../+page.svelte` — renders `<PendingSection>` + `<UploadJobsTree>`; realtime for `file_upload_job` + `file_upload_decision`.
- `src/routes/api/file-upload-decisions/[decisionId]/answer/+server.ts` — resolve proxy (validates UUID + choice).

---

## Remaining work

### A. Detection (substation)
1. **Visual route** — scanned/image-only docs + plan sheets via `computeSheetSimilarity`/`matchSheets` (`src/inngest/lib/sandbox/similarity.ts`, `match-sheets.ts`). This is the common Austin doc case (application forms are scanned — see spike). Wire into `detect.ts` (the density router already falls through to "no text decision" for scanned docs). **Cutoff `~0.70` is UNVALIDATED — calibrate in staging first (items #11/#12).**
2. **doc→plan-set cross-type** (`doc_is_plan_set_version`, P4) — compare incoming doc pages vs. the live plan set's sheets (visual); offer `promote`. Excludes same-zip plan-set siblings (no race).
3. *(optional)* both-signals booster — only if validation shows text-route false negatives.

### B. Plan sets (substation, P1–P6)
4. **`plan_set_version_or_discard` (P1)** — a generic-dropzone plan-set upload with an existing set currently **silently auto-replaces** via `replaceExistingPlanSet` (`src/lib/plan-set-collision.ts`, called in `handlePlanSetUpload` + zip `registerWinnerAsPlanSet`). Intercept it → hold + ask (version/replace/discard). The explicit "Replace plan set" button stays a direct action; first-ever plan set stays direct.
5. **Plan-set off-slot parking** — park the held set at a `pending/…` key (NOT the canonical `planSetSourceKey`), rasterize-without-promote to score the prompt (Q-heldplanset-score). `storage-keys.ts` currently only has `planSetBasePath` / `planSetSourceKey`.
6. **`promote` resolver** — currently `applyOutcome` throws 422 for `promote`. Wire doc→plan-set versioning under the existing `plan_set_id` via the `POST /plan-sets/:id/replace` shape (`src/routes/plan-sets.ts:107`; `fetchPriorVersion` in `plan-set.logic.ts` keys on shared `plan_set_id`).
7. **Plan-set `separate`/`keep` re-attach** in `applyOutcome` (today only documents are handled).

### C. cityhall cards (the "Pending" section renders a generic fallback for these)
8. **`doc_version_or_separate` card** — version/replace/separate/discard + side-by-side thumbnails; candidate side links to `/project/:projectId/document/:documentId`. *(Being built now — see the cityhall PR that accompanies this doc.)*
9. **`plan_set_version_or_discard` card** — version/replace/discard.
10. **`doc_is_plan_set_version` card** — promote/separate/discard; incoming page vs. plan-set sheet; candidate links to `/project/:projectId/plan-set?ps=:planSetId` (query-param route, via `planSetHref`/`planSetSearch` in `src/lib/plan-set/links.ts` — NOT a `/plan-set/:id` path).

> **Payload note for cards 8–10:** the detector's decision `payload` currently carries `incoming.{document_id, document_version_id, storage_path, file_name}` and `candidate.{document_id, version_id, file_name, score, reason}`. It does **not** yet carry page-1 raster paths — the cityhall load derives thumbnails from `storage_path` (`{basePath}/pages/1.jpg`, signed) for the incoming side and by looking up the candidate `document_version.storage_path`. If you add raster paths to the payload in the detector, simplify the load accordingly.

### D. Validation / calibration
11. **Staging validation** — see the detailed plan below. **Highest-leverage remaining item.**
12. **Visual `~0.70` cutoff calibration** on real plan-set sheet pairs (the one number the spike couldn't pin — needs the sandbox).
13. **Threshold tuning** — `TEXT_PROPOSE_CUTOFF=0.60`, k=3, `TEXT_DENSITY_MIN_CHARS_PER_PAGE=100`, `TEXT_IDENTICAL_CUTOFF=0.98` are seeds; tune from production signal.
14. **Re-run `pnpm gen-types` (substation) / `bun run db:types` (cityhall)** against the applied migrations to confirm the hand-added `file_upload_job` / `file_upload_decision` / `content_sha256` type blocks match generated output (they were hand-added because the build env had no local Supabase).

### E. Open decisions (spec §11)
15. **Q-RLS** — who may answer a decision? Current: project write-access (`requireProjectAccess(..., 'write')`). Confirm.
16. **Hold semantics** — shipped **insert-then-remove** (junction inserted as today, removed only when a decision is created) vs. the spec's strict "attach-only-on-resolve" (D15). Keep or tighten to full deferral?
17. **Q-idempotency** — the detection decision-writes run inside a `step.run`; confirm they're Inngest-replay-safe (a replayed completed step returns cached without re-running, so the junction-remove + createDecision won't double-fire — but verify against a real replay).
18. **Q-merge** — fold the old clarifying-questions spec in, or keep it as the sync-409 record.

### F. Explicit v1 NON-GOALS (out of scope by decision — do NOT build without a new decision)
Reverse cross-type (plan-set→doc, Q-crosstype-reverse); resumable/chunked uploads (Q9); stuck-processing watchdog (D7); byte-% upload bar (D23); replacing `processing_state`; any conductor/review changes; threshold *perfection*.

---

## #11 — Staging validation plan (detailed)

**Why:** every DB/sandbox integration path merged since #222 was verified **typecheck + unit-test only** — the build environment has no Vercel Sandbox and no DB. So the off-slot hold, the resolver's `applyOutcome`, and the in-sandbox `runFuzzyDetection` have **never executed**. This pass exercises them against a real environment before more is built on top.

**Environment needed:**
- A substation deploy (or `pnpm dev` + Inngest dev server + local Supabase via `pnpm db:reset`) on a branch/main including #222/#223/#224/#227.
- A cityhall deploy (or `bun dev`) pointed at the same Supabase (`SUBSTATION_URL`, `PUBLIC_SUPABASE_URL`).
- A test project + a **draft** submission version (uploads require `status='draft'`).
- Realtime enabled (the migrations publish `file_upload_job` + `file_upload_decision`).

**Flow 1 — loading spine (Phase A):**
1. Drop a zip on a submission. Expect a `file_upload_job` at prepare-upload (`awaiting_upload`), then parent `uploaded → classifying → triaging → extracting → done`, and a child job per extracted file. The submission page's "Uploading & processing" tree renders live (Realtime) and clears when all settle.
2. Verify child jobs have `parent_job_id` + `produced_document_id`/`produced_plan_set_id`.

**Flow 2 — exact-duplicate (#224 + #638):**
1. Upload a document, let it process. Re-upload the **byte-identical** file to the same draft version.
2. Expect: the dup's `document_version.content_sha256` set, rasterization **skipped**, an `exact_duplicate` decision (`pending`), job → `awaiting_decision`, and the dup's `submission_document` junction **removed** (off-slot hold) so it's NOT in the live list.
3. cityhall "Pending" shows the exact-dup card. **Keep both** → dup re-attaches AND `process-file` is dispatched (should end `processed`, not stuck `pending`), job → `done`. **Discard** (card or row ✕ → confirm modal) → held doc + storage object hard-deleted, job → `discarded`, row leaves.
4. Race: answer from two tabs → second gets 409, no double-apply.

**Flow 3 — text-route fuzzy detection (#227):**
1. Take a **text-native** doc (engineering/drainage report with a real text layer). Upload, let it process.
2. Upload an **edited revision** as a **new** upload (generic dropzone, not Replace).
3. Expect: `runFuzzyDetection` routes TEXT (≥100 chars/page), scores the prior version (a real revision should be well above 0.60 — spike pair was 0.772), raises `doc_version_or_separate`, holds the new doc off-slot, job → `awaiting_decision` (NOT flipped to `done`).
4. cityhall shows the `doc_version_or_separate` card (once #8 merges). **Version it** → incoming re-parented under the candidate's `document_id`, prior unlinked from the svn (kept in history), junction → incoming, net-new shell deleted, job → `done`. Test **Separate** (attaches + processes), **Replace** (job → `superseded`), **Discard**.
5. Negatives: two **unrelated** docs → NO decision (~0 Jaccard), both attach.
6. Scanned doc uploaded twice (not byte-identical) → NO fuzzy decision (visual route deferred); only exact-dup fires if byte-identical.

**Likely failure points (all untested):**
- **insert-then-remove hold** — junction actually removed on decision creation, correctly re-inserted/deleted on resolve.
- **Job status coordination** — held job stays `awaiting_decision`, not clobbered to `done` (mirror guard excludes it).
- **`pdftotext` in the Vercel Sandbox image** — inferred from `pdfinfo`/`pdftoppm`; verify at runtime.
- **Candidate PDF download** in `detect.ts` — cost/correctness on a version with many docs.
- **Inngest replay** (Q-idempotency #17) — force a retry, confirm no duplicate decision / double junction-removal.
- **gen-types drift** (#14) — apply migrations to a fresh DB and diff generated types vs. the hand-added blocks.

**Exit criteria:** all three flows behave as above; no orphaned/duplicated docs in the live set; jobs reach correct terminal states; `finished_at` at completion (not answer-time).

---

## Picking up the work (conventions)

- Every change lands as a PR from a fresh branch off latest `main` (Will's `cut-pr` flow); merging is Will's call.
- Work in a git worktree under `.claude/worktrees/` for isolation.
- **Verify:** substation — `pnpm typecheck` + `pnpm lint` (biome) + `pnpm test`; cityhall — `bun run check` + `biome` + `bun run vitest run --project=server`. NOTE: the substation build env couldn't install the private `@noetic-inc` RDS packages (needs a `read:packages` token), so full `tsc` was run with those two deps removed and the `src/pdf/*` errors filtered — CI covers the full graph.
- Detection thresholds are all in `detection-config.ts` — calibration is a one-line change, no logic edits.
