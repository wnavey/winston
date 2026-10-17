# File-Upload Loading + HITL — Implementation Status & Handoff

**Updated:** 2026-08-27 (Track-1 complete: plan-set collision, visual route, cross-type + promote, all cards merged)
**Spec:** `DESIGN-SPEC.md` (this directory). **Spike results:** `detection-config.ts` header comment (substation) + Appendix B of the spec (PR wnavey/winston#241).
**Purpose:** a self-contained handoff so a fresh session can pick up the work. Read this first, then the spec.

---

## TL;DR

**All buildable Phase B work is merged to `main`** in substation + cityhall. Phase A (loading spine); exact-duplicate; the doc↔doc fuzzy detector (BOTH text and visual routes); the plan-set collision interception (`plan_set_version_or_discard`); the doc→plan-set cross-type (`doc_is_plan_set_version`) + `promote`; all four resolver outcomes; and all four cityhall cards are done. **The only remaining work is not code — it's staging validation + cutoff calibration** (§ "Validation" below). Everything merged was verified typecheck + schema-check only; the DB/sandbox integration paths have **never actually run** (substation's private `@noetic-inc` registry 401s locally, so `pnpm install`/`typecheck`/`test` couldn't run in-session — CI + staging are the real gates), and `VISUAL_PROPOSE_CUTOFF` / `CROSS_TYPE_CUTOFF` (both ~0.70, page-1-only) are unvalidated seeds.

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
| cityhall | **#640** | `doc_version_or_separate` card (side-by-side thumbnails, version/replace/separate/discard) |
| cityhall | **#641** | Copy polish + skip discard-confirm for exact-dup |
| substation | **#228** | Plan-set collision: intercept the silent auto-replace → `plan_set_version_or_discard` (hold off-slot) + resolver (version/replace/discard, owned-vs-inherited vacate) + same-batch-sibling exclusion |
| substation | **#229** | Fuzzy detector — VISUAL route (scanned/image-only → page-1 raster similarity via `computeSheetSimilarity`) |
| cityhall | **#642** | `plan_set_version_or_discard` card |
| cityhall | **#643** | Fail-safe discard-confirm denylist (`DISCARD_SKIPS_CONFIRM = { exact_duplicate }`) |
| substation | **#230** | doc→plan-set cross-type detection (`scoreCrossTypeCandidate`) + `promote` resolver (`promoteDocToPlanSet`, restore-on-failure + stale-state guard) |
| cityhall | **#644** | `doc_is_plan_set_version` card — registry now complete for all four question types |

**Migrations applied in prod:** `20260825000000_file_upload_job.sql` (#222), `20260825000100_file_upload_decision.sql` (#223, adds `content_sha256`). **All later PRs (#224/#227/#228/#229/#230) added NO migrations** — they use the existing `file_upload_job` / `file_upload_decision` / `plan_set*` / `document*` tables.

---

## Where the code lives

**substation**
- `src/lib/detection-config.ts` — all calibratable cutoffs (seeds; spike findings in the header).
- `src/lib/text-similarity.ts` — pinned tokenizer + k-gram shingle set-Jaccard (pure, tested).
- `src/lib/content-hash.ts` — `computeSha256` + `findExactMatchInVersion` (index-scoped byte-equality lookup).
- `src/lib/file-upload-decision.ts` — question_type/choice model, `outcomeFor` mapping, `createDecision` (flips job → `awaiting_decision`).
- `src/lib/detect-select.ts` — D25 argmax/threshold selector (pure, tested).
- `src/lib/file-upload-job.ts` — best-effort job create/update/mirror helpers.
- `src/routes/submissions.ts` — prepare/commit-upload; exact-dup pre-check + hold (document branch) AND plan-set collision interception (`findExistingPlanSetOnVersion` + off-slot held plan set, `handlePlanSetUpload`, with same-batch-sibling exclusion via `batchPlanSetVersionIds`).
- `src/routes/file-upload-decisions.ts` — the resolve endpoint. `applyOutcome` handles document outcomes (separate/keep/discard/version/replace) + `promote` (`promoteDocToPlanSet`); `applyPlanSetOutcome` handles held-plan-set outcomes; `vacatePriorPlanSetVersion` is the shared owned-vs-inherited helper.
- `src/inngest/functions/process-file/detect.ts` — `runFuzzyDetection`: doc↔doc TEXT (`scoreTextCandidates`) + VISUAL (`scoreVisualCandidates`) routes AND the cross-type check (`scoreCrossTypeCandidate`), all feeding one argmax (`selectDecision`).
- `src/inngest/functions/process-file/document.ts` — `processDocument` returns `{ heldForDecision }`; calls detection after rasterization.
- `src/inngest/functions/process-file/main.ts` — threads `jobId`; skips the job mirror when held.

**cityhall**
- `src/lib/ui/pending/decision.ts` — `PendingDecision` type + `question_type → component` registry (**complete**: exact_duplicate, doc_version_or_separate, plan_set_version_or_discard, doc_is_plan_set_version).
- `src/lib/ui/pending/{ExactDuplicateDecision,DocVersionOrSeparate,PlanSetVersionOrDiscard,DocIsPlanSetVersion}.svelte` — the four cards.
- `src/lib/ui/pending/PendingSection.svelte` — the "Pending" section (D20). Generic fallback row only for an unknown/future type; discard-confirm is a fail-safe denylist (`DISCARD_SKIPS_CONFIRM = { exact_duplicate }`).
- `src/routes/(app)/project/[projectId]/submission/[submissionId]/+page.ts` — loads `pendingDecisions` + `uploadJobs`.
- `src/routes/(app)/.../+page.svelte` — renders `<PendingSection>` + `<UploadJobsTree>`; realtime for `file_upload_job` + `file_upload_decision`.
- `src/routes/api/file-upload-decisions/[decisionId]/answer/+server.ts` — resolve proxy (validates UUID + choice).

---

## Remaining work

### ✅ Done (merged) — the whole detector + resolver + card surface
- **Detection:** doc↔doc TEXT + VISUAL routes (#227/#229); doc→plan-set cross-type (#230). All feed one argmax; fail-soft.
- **Plan sets:** collision interception → `plan_set_version_or_discard` with off-slot hold + owned-vs-inherited resolver + same-batch-sibling exclusion (#228). NOTE: the held plan set is parked at its **staging key** (not a dedicated `pending/…` key) and is **not** rasterized-to-score before resolve — the spec's "off-slot parking + score the held set" (Q-heldplanset-score) was simplified to a structural interception. Fine for v1; revisit only if a similarity score on the held set is wanted in the card.
- **`promote` resolver:** `promoteDocToPlanSet` (#230) — mints a new `plan_set_version` under the existing `plan_set_id`, with restore-on-failure + a stale-state guard (409 if the plan set changed/reprocessing mid-review).
- **cityhall cards:** all four question types (#640/#642/#644), fail-safe discard-confirm (#643).

### D. Validation / calibration — **the only remaining work**
1. **Staging validation** — see the detailed plan below (Flows 1–5). **Highest-leverage remaining item.** Nothing on the DB/sandbox path has run end-to-end.
2. **Visual + cross-type cutoff calibration** — `VISUAL_PROPOSE_CUTOFF` and `CROSS_TYPE_CUTOFF` (~0.70, both **page-1-only**) are seeds that have NEVER been validated. Calibrate from real scanned/plan-set pairs in staging (procedure below). This is the one number the spike couldn't pin (needs the sandbox comparator).
3. **Threshold tuning** — `TEXT_PROPOSE_CUTOFF=0.60`, k=3, `TEXT_DENSITY_MIN_CHARS_PER_PAGE=100`, `TEXT_IDENTICAL_CUTOFF=0.98` are seeds; tune from production signal. All cutoffs live in `detection-config.ts` — calibration is a one-line change, no logic edits.
4. **Re-run `pnpm gen-types` (substation) / `bun run db:types` (cityhall)** to confirm the hand-added `file_upload_job` / `file_upload_decision` / `content_sha256` type blocks match generated output.

### Deferred / not built (by scope, not blockers)
- **Multi-page visual comparison** — both the doc↔doc visual route and the cross-type check compare **page 1 only**. A doc matching a non-cover plan sheet, or a revision whose cover is unchanged but interior differs, won't be caught. Additive when wanted.
- **Off-slot parking + held-plan-set scoring** (see the plan-set NOTE above).
- **both-signals booster** — only if validation shows text-route false negatives.

### E. Open decisions (spec §11)
15. **Q-RLS** — who may answer a decision? Current: project write-access (`requireProjectAccess(..., 'write')`). Confirm.
16. **Hold semantics** — shipped **insert-then-remove** (junction inserted as today, removed only when a decision is created) vs. the spec's strict "attach-only-on-resolve" (D15). Keep or tighten to full deferral?
17. **Q-idempotency** — the detection decision-writes run inside a `step.run`; confirm they're Inngest-replay-safe (a replayed completed step returns cached without re-running, so the junction-remove + createDecision won't double-fire — but verify against a real replay).
18. **Q-merge** — fold the old clarifying-questions spec in, or keep it as the sync-409 record.

### F. Explicit v1 NON-GOALS (out of scope by decision — do NOT build without a new decision)
Reverse cross-type (plan-set→doc, Q-crosstype-reverse); resumable/chunked uploads (Q9); stuck-processing watchdog (D7); byte-% upload bar (D23); replacing `processing_state`; any conductor/review changes; threshold *perfection*.

---

## Staging validation & calibration runbook

**Why:** every DB/sandbox integration path (the off-slot holds, both resolvers, the in-sandbox `runFuzzyDetection` text/visual/cross-type routes, `promoteDocToPlanSet`) was verified **typecheck/schema-check only** — the in-session build env has no Vercel Sandbox, no DB, and can't even `pnpm install` (private-registry 401). So none of it has **ever executed end-to-end**. This pass exercises it against a real environment, and calibrates the two unvalidated visual cutoffs. It is the gate before this feature is trusted in prod.

**Environment needed:**
- A substation deploy (or `pnpm dev` + Inngest dev server + local Supabase via `pnpm db:reset`) on `main` (includes #222–#230).
- A cityhall deploy (or `bun dev`) on `main` pointed at the same Supabase (`SUBSTATION_URL`, `PUBLIC_SUPABASE_URL`).
- A test project + a **draft** submission version (uploads require `status='draft'`).
- Realtime enabled (the migrations publish `file_upload_job` + `file_upload_decision`).
- **Test fixtures:** a text-native report + an edited revision of it; a **scanned** PDF (e.g. a real Austin application form) + a near-duplicate scan; a plan-set PDF + a revised version of it; and a plan-set PDF *also* saved as a standalone doc (to trigger cross-type). The 1700 S Lamar submission (winston #241) has real examples of the first two.

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
4. cityhall shows the `doc_version_or_separate` card. **Version it** → incoming re-parented under the candidate's `document_id`, prior unlinked from the svn (kept in history), junction → incoming, net-new shell deleted, job → `done`. Test **Separate** (attaches + processes), **Replace** (job → `superseded`), **Discard**.
5. Negatives: two **unrelated** docs → NO decision (~0 Jaccard), both attach.

**Flow 4 — visual-route fuzzy detection (#229):**
1. Upload a **scanned / image-only** PDF (density < 100 chars/page — e.g. an Austin application form), let it process.
2. Upload a near-duplicate scan of the same doc (NOT byte-identical, so exact-dup doesn't fire) as a new upload.
3. Expect: `runFuzzyDetection` routes VISUAL, rasterizes page-1 of incoming + candidate, `computeSheetSimilarity` scores ≥ `VISUAL_PROPOSE_CUTOFF` → `doc_version_or_separate` (method `visual`), held off-slot. Card resolves as in Flow 3.
4. Negatives: two unrelated scanned docs → score below cutoff → NO decision, both attach. **← read the printed scores here to calibrate (see below).**

**Flow 5 — plan-set collision (#228):**
1. On a draft that already has a processed plan set, upload another plan-set PDF through the **generic dropzone** (NOT the "Replace plan set" button).
2. Expect: the incoming set is held **off-slot** (born with no `submission_plan_set` junction, bytes left at the staging key — the existing set is untouched and stays live), a `plan_set_version_or_discard` decision (`pending`), job → `awaiting_decision`.
3. cityhall shows the `plan_set_version_or_discard` card. **Save as new version** → held set promoted into the existing `plan_set_id` (prior owned version deleted per the single-slot constraint; inherited prior only unlinked), attached, plan-set processing dispatched, job rides `processing → done`. Test **Replace** and **Discard** (held set + staged bytes deleted, existing untouched).
4. Batch check: commit-upload TWO plan sets at once with **no** pre-existing set → collapses to one (last wins), NO decision. With a pre-existing set → the pre-batch set still raises the decision (same-batch siblings excluded).
5. Untouched paths: first-ever plan set attaches directly; the explicit "Replace plan set" button still replaces directly.

**Flow 6 — doc→plan-set cross-type (#230):**
1. On a draft with a **processed** plan set, upload a PDF that is really a plan set but classifies/lands as a **document**.
2. Expect: after doc↔doc scoring, `scoreCrossTypeCandidate` compares incoming page-1 vs the plan set's cover sheet (`sheets/1.jpg`); ≥ `CROSS_TYPE_CUTOFF` → `doc_is_plan_set_version` (held off-slot). (Runs even with zero doc↔doc candidates.)
3. cityhall shows the `doc_is_plan_set_version` card. **Add as plan-set version** (`promote`) → doc's PDF moved into the plan-set slot, new `plan_set_version` minted under the existing `plan_set_id`, held document rows deleted, plan-set processing dispatched. Test **Keep as separate document** (`separate` → doc re-attaches) and **Discard**.
4. Race guard: if the plan set is mid-reprocess when you answer `promote`, expect a `409` (`plan_set_reprocessing` / `plan_set_changed`) and the decision stays `pending` for retry — nothing mutated.

### Calibration procedure (the load-bearing output of this pass)

`VISUAL_PROPOSE_CUTOFF` and `CROSS_TYPE_CUTOFF` (both `0.70` seed, `detection-config.ts`) have never seen real data. To calibrate:
1. In Flows 4 and 6, the detector logs each candidate's score (`scoreVisualCandidates` / `scoreCrossTypeCandidate` push a `reason` like `page-1 visual similarity 0.NN`; also visible via `logProcessingEvent`). Collect scores for **true pairs** (a real revision / a doc that IS the plan set) and **false pairs** (unrelated scanned docs, a doc that is NOT the plan set).
2. Pick each cutoff to sit cleanly between the two clusters (as the spike did for text: 0.60 between 0.77 true and ~0 false). If they overlap, page-1-only is too coarse → consider the deferred multi-page comparison.
3. Change the two constants in `detection-config.ts` (one-line each) and redeploy. No logic edits.

**Likely failure points (all untested):**
- **insert-then-remove hold** (docs) / **born-off-slot hold** (plan sets) — junction correctly absent during the hold, re-attached/deleted on resolve.
- **Job status coordination** — held job stays `awaiting_decision`, not clobbered to `done` (mirror guard excludes it).
- **`pdftotext` / `pdftoppm -singlefile` in the Vercel Sandbox image** — verify at runtime; the visual/cross-type routes depend on `pdftoppm` + the `detect/` dir being created (fixed in #229).
- **`promote` restore-on-failure** — force a `plan_set_version` insert failure and confirm the storage move is restored so a retry is consistent.
- **Inngest replay** (Q-idempotency) — force a retry, confirm no duplicate decision / double junction-removal / duplicate plan_set_version.
- **gen-types drift** — apply migrations to a fresh DB and diff generated types vs. the hand-added blocks.

**Exit criteria:** all six flows behave as above; both visual cutoffs calibrated from real pairs; no orphaned/duplicated docs or plan sets in the live set; jobs reach correct terminal states; `finished_at` at completion (not answer-time).

---

## Picking up the work (conventions)

- Every change lands as a PR from a fresh branch off latest `main` (Will's `cut-pr` flow); merging is Will's call.
- Work in a git worktree under `.claude/worktrees/` for isolation.
- **Verify:** substation — `pnpm typecheck` + `pnpm lint` (biome) + `pnpm test`; cityhall — `bun run check` + `biome` + `bun run vitest run --project=server`. NOTE: the substation build env couldn't install the private `@noetic-inc` RDS packages (needs a `read:packages` token), so full `tsc` was run with those two deps removed and the `src/pdf/*` errors filtered — CI covers the full graph.
- Detection thresholds are all in `detection-config.ts` — calibration is a one-line change, no logic edits.
