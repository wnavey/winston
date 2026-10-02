# Completeness Check → Runbook v2 (feature-parity port)

**Status:** Draft v1
**Date:** 2026-10-02
**Repos touched:** `bureau` (new `runbooks/completeness-check/`, two agent-tool CLIs, `publish_review_cli.py` lane B flags, a compare script), `conductor2` (opt-in per-step persistence to Storage), `cityhall-new` (new `POST /api/runs/:runId/step-files` signing route)
**Repos NOT touched:** `conductor` (legacy TS lane stays frozen), `substation` (retired as the API home; `cityhall-new` owns `/api/runs/*`), `cityhall`, `claude-plugins` (the `/conductor` captain skill drives any runbook already)

Grilled with Will on 2026-10-02. Every decision below is numbered `D<n>`; open questions are `Q<n>`.

## 1. Problem

The completeness check (CC) runs on the legacy conductor-1 lane: `bureau/workflows/completeness-check/workflow.yaml` (v1.4.0, 10 steps), executed by the TypeScript `conduct` CLI in `~/noetic/conductor`. That lane:

- writes a `workflow_runs` row and nothing else to the run control plane. There are no `runbook_runs`, no `runbook_checkpoints` and no `runbook_hitl_questions`, so the cityhall console can't watch a CC run and there is no structured way to ask a human anything.
- keeps all progress in one workspace until the end. Artifacts go to the `workflow-runs` bucket only in the final upload (`conductor/src/orchestrator/engine.ts:442-524`). An expensive review fan-out followed by a crash in a cheap late step loses everything on a cloud box.
- can't run a subset of guides. `initializeChecklist` globs `<checklistsDir>/*.md` with no filter (`conductor/src/orchestrator/checklist-manager.ts:196-200`), so every iteration on one guide pays for all 14 (v2.7-trimmed). At `runs=3`, that is 42 Sonnet sessions.

The review workflow already moved to runbook v2 (`bureau/runbooks/review/`, run by the Rust `conductor2`). That move was a **redesign**, not a port (IG report `2026-10-01-reviews-workflow-vs-runbook-v2`). This spec is deliberately the opposite: a **mostly feature-parity port**. The same steps produce the same files, the same `review-comments.json` envelope and the same DB rows. The only gains are the runbook-v2 benefits (DB run row, per-step checkpoints, HITL plumbing for later) plus two new capabilities: running a subset of guides with `reviewFiles`, and persisting each step's output to Storage.

### 1.1 Verified facts this spec rests on

| Fact | Where |
|---|---|
| Legacy steps: `review` (agent, fan-out guides × runs) → `cross-run-consolidate-cc` → `apply-forced-outcomes` (script that **calls an LLM** via the gateway) → `prepare-uncertain-explanation-inputs` → `explain-uncertain` (agent fan-out, `continueOnFailure`) → `collect-uncertain-explanations` → `enrich-findings` → `format-reports` (agent) → `build-review-comments` → `validate-review-output` | `workflow.yaml:178-357` |
| All 9 scripts are TS, run as `npx tsx scripts/<name>.ts --k=v` | `conductor/src/tools/script.ts:219-232` |
| Downstream scripts **iterate findings files** and use the guide dir only as a lookup, so a guide subset flows through unchanged | `enrich-findings.ts:141-175`, `apply-forced-outcomes.ts:334-360` |
| `apply-forced-outcomes` errors when a forced ref has no organic finding | `apply-forced-outcomes.ts:356-360` |
| Review agents get `vision` (Gemini 3.1 Pro via gateway) and `semantic-search-blocks` as in-process MCP tools; conductor2 has no in-process tools | `conductor/src/tools/index.ts:323`, `tools/vision/index.ts:90-210` |
| The structured-output emit schema omits `grouping`; conductor-1 injects it from the cell filename | `conductor/src/agent/structured-output-repair.ts:266-336` |
| conductor2 fan-out is `foreach:` with `briefs` / `sh:` / `scan:` rosters. Rosters are one-dimensional: there is no `runs: N` | `conductor2/src/model.rs:438-455` |
| conductor2 has no `if:`. Optional steps are a roster that prints nothing, a `SKIPPED.md` marker, or a vacuously-passing contract | `runbooks/smoke/steps/2.5-animal`, `lib/contract-helpers.ts:397-401` |
| Run inputs are a zod `Request` in `1.1-inputs/contract.test.ts` (arrays allowed). There is no scalar-only typed input block | `runbooks/review/steps/1.1-inputs/contract.test.ts:14-44` |
| The scheduler posts a `status` checkpoint at every step's enter/exit, plus one rollup per fan-out family | `conductor2/src/sched.rs:1223-1300`, `substation_client.rs:1-18` |
| `runbook_checkpoints` has **no** payload column (only `client_token` was added later) | `substation/supabase/migrations/20260909000000…sql:96-115`, `20260911000000…sql:13` |
| Nothing in conductor2 uploads step output anywhere | `conductor2/src/callback.rs:61-69` (TODO) |
| `cityhall-new` owns `/api/runs/*` (ported from substation `6fde815`) and has a signed-URL `gate-files` route whose bytes never cross the function | `cityhall-new/AGENTS.md:346-364`, `src/app/api/runs/[runId]/gate-files/route.ts`, `bureau/runbooks/lib/app_client.py:645-682` |
| `publish_review_cli.py` lane B (v2 envelope, CC/CRC) exists but no runbook calls it. It has no `prior_review_id` and always takes over `is_current` | `publish_review_cli.py:11-16, 254-370, 301, 333-341` |
| Legacy `setCurrent` (default true): when false, insert `is_current=false` and skip retiring the prior reviews. Legacy retire scope = project + department (+ submission_version when known), which matches lane B's | `conductor/src/shared/review-saver.ts:139, 473-505` |
| `stage_submission.py` stages the same `sheet-NN/{guide,blocks}.md`, `block-manifest.json` and `README.md` (with `documentId`s), plus binaries, but **no `facts.md`**, on purpose | `runbooks/lib/stage_submission.py:1000-1012`, `workspace.py:759` |
| Guides: `bureau/jurisdictions/austin/completeness-check/CURRENT_VERSION` = `v2.7-trimmed`, 14 guides (cc-1, 2, 3, 5, 6, 10, 13, 15, 19, 20, 21, 22, 23, 24) + 4 TSVs | on disk, bureau `05bc24ab4d` |

## 2. Goals and non-goals

**Goals**
1. A `completeness-check` runbook that a local captain (`/conductor completeness-check`) drives with conductor2, writing `runbook_runs`, `runbook_checkpoints` and (when a gate parks) `runbook_hitl_questions`.
2. One runbook step per legacy step, each separately checkpointed (D2).
3. Same intermediate file schemas, same `review-comments.json` envelope (`reviewType: completeness_check`), same `reviews` / `review_comments` rows (`output_schema = 2026-03-completeness-check`) (D1).
4. `reviewFiles: ["cc-1","cc-21"]` runs only those guides end to end (D7).
5. Opt-in, filterable per-step persistence of run-produced files to Supabase Storage, so an interrupted run loses nothing (D13–D19).
6. Easily testable: deterministic replays of the downstream steps for zero tokens, plus a compare script for legacy-vs-v2 and v2-vs-v2 loops (§8).

**Non-goals (deferred, with reason)**
- **Cloud lane.** v1 is local captain only (D4). The persistence feature is built lane-agnostic so cloud can come next.
- **Resume on another box from Storage.** v1 only *writes* a complete, manifest-indexed copy. The resume reader is a follow-up (§10).
- **A HITL publish gate.** Will: a gate before publish only earns its place behind a run-health audit that surfaces a concern. That audit is a new feature (§10). v1 auto-publishes like legacy (D9).
- **Retiring legacy CC** and switching cityhall's trigger. This happens after the acceptance bar (§8.4) is met.
- **Experiment overlays** (`vision-check` router, `inspect-drawing`, `enabledVisionSpecialists`). No prod caller was found, so they're dropped (D12).
- **Behaviour changes the new review made** (Opus, native image reading, prose guides, no `facts.md`). Each is a separate, measured experiment once parity is shown.

## 3. Decisions

### Parity and shape
- **D1 Parity bar = same envelope + same DB rows.** Every intermediate keeps its legacy schema (`runs/*/findings/*.json`, `consolidated-findings.json`, `findings/`, `forced-outcomes-receipt.json`, `uncertain-explanations.json`, `enriched-findings.json`, `rephrased-items.json`, `review-comments.json`), so the legacy scripts run **unchanged**.
- **D2 One checkpointed step per legacy step**, plus explicit steps for what conductor-1 did implicitly: inputs, staging, facts, resolve and publish (§4).
- **D3 Reference legacy code in place.** Script steps call `$BUREAU/workflows/completeness-check/scripts/*.ts`. Prompts are copied once into the runbook, because the substitutions are mechanical (§5.2). Both lanes run the same scripts while we compare. Moving the scripts is part of retiring legacy.
- **D4 Local captain first.** Cloud is a later phase.

### Inputs and models
- **D5 Request, not typed inputs.** `1.1-inputs/request.json` is validated by a zod `Request` (§6). `runner: none`: the captain writes the request before the first `advance`, so the contract passes and no question is asked.
- **D6 Models live in `runners:` presets**, not in the request: `review`, `explain` and `format`, all `claude` / `sonnet-5.5` (legacy defaults). A/B tests use `--runner`. Dropped request fields: `model`, `effort`, `uncertainExplanationModel`, `maxWorkers`, `uncertainExplanationMaxWorkers`, `departmentCode` (always `cc`), `enabledVisionSpecialists`.
- **D7 `reviewFiles`** is an optional non-empty array of guide basenames (`cc-1` or `cc-1.md`, normalized to no extension). `1.1-inputs` rejects unknown names, listing what exists. `1.4-resolve` filters the roster. Everything downstream sees only those guides' findings.
- **D8 `forceOutcomes` with a subset:** the `2.3` wrapper drops forced rows whose grouping isn't in the roster, logs them in `dropped-forced-outcomes.json`, then calls the legacy script.

### Publish
- **D9 Auto-publish, no gate.** `3.1-publish` writes its own `decision.json` (`status: approved`, `publish.project.id` from the staged manifest, `versioning: iterate`, `label` = `cc <checklistVersion> <reviewFiles or "all">`) and calls lane B. `request.publish: false` writes `SKIPPED.md` instead (test loops).
- **D10 Subsets publish too.** Exposure is gated by `setCurrent`, not by refusing to publish. `request.setCurrent` (default true, like legacy) maps to a new lane B flag `--no-set-current`: insert `is_current=false`, skip the retire. A test review is reachable only by its id.
- **D11 Lane B gains `--prior-review-id`** (writes `reviews.prior_review_id`). Legacy's other `priorReviewId` behaviour, pinning guides to the prior review's bureau commit, is dropped. Retire scope stays lane B's (project + department + submission_version), which matches legacy when the submission version is known.

### Agent behaviour
- **D12 Drop the experiment overlays.** Baseline `review.md` only.
- **D20 Port both agent tools as CLIs** the agent calls through Bash:
  - `runbooks/completeness-check/bin/vision.ts` is a port of `conductor/src/tools/vision/index.ts`: same Gemini model, same `prompt.md` (copied), same params (`--document-id`, `--sheet`, `--prompt`, `--item-ids`), sheet image fetched from `submission-data` via `plan_set_version`/`sheet_version`. It appends `{ts, itemIds, documentId, sheet, prompt, response}` to `$OUT/vision-log.jsonl`. Logging the prompt and item ids closes the long-standing baseline prompt-traceability gap at no extra cost.
  - `semantic-search-blocks` already is a CLI (`workflows/completeness-check/scripts/semantic-search-blocks.ts`). The step passes `--projectId` explicitly, because the script's `projects/<one dir>` inference doesn't hold in a runbook run dir, and logs to `$OUT/search-log.jsonl`.
- **D21 Tool allowlist for parity.** The `review` preset's `permission:` allows Read/Glob/Grep over `$RUN/1.2-stage-submission`, `$RUN/1.3-facts` and `$RUN/1.4-resolve/checklist`; Bash only for the two CLIs; Write only in its own item folder. Legacy agents could read files, so Read and Grep are parity, but arbitrary Bash isn't.
- **D22 Every item resolves exactly once.** The review worker's contract parses its guide's item ids and `[BLOCKING]`-requires a 1:1 match with `findings[].checklistItemId`. A miss resumes the session with the missing ids. Legacy never enforced this; it only catches drops.
- **D23 explain-uncertain keeps legacy tolerance.** A worker may finish with `FAILED.md` instead of `result.json` (the contract accepts either). `2.6` treats `FAILED.md` as a null explanation, so the >50%-null tripwire in `collect-uncertain-explanations.ts` still fails the run on systemic failure.
- **D24 Staging = `stage_submission.py`, plus a facts step for parity.** `1.3-facts` renders `facts.md` from `project_facts` exactly as conductor-1 did (`conductor/src/shared/project-downloader.ts:874-890`), so the parity comparison measures only the runner change. Dropping `facts.md` (the runbook stance, `stage_submission.py:1000-1012`) is the first post-parity experiment. **See Q1: this conflicts with AGENTS-core rule 19.**

### Trails
- **D25 Drop `workflow_runs` and the `workflow-runs` bucket upload.** `runbook_runs` is the run row; persisted step files are the artifacts. The readers that need a v2 path later are listed in Q8.

### Step persistence (conductor2 + cityhall-new)
- **D13 Lives in conductor2, off by default, generic to every runbook.** Only `completeness-check/runbook.yaml` turns it on in v1.
- **D14 Config** is a `persist:` block in `runbook.yaml` (§7.1). Absent means off. `CONDUCTOR_PERSIST=off|on` overrides it for one run.
- **D15 What gets persisted defaults to the step's declared `outputs:`** minus `scratch/`, narrowed by per-step `include`/`exclude` globs.
- **D16 Only run-produced files.** CC persists everything **except** `1.2-stage-submission` and `1.3-facts`, which are DB data pulled into the run (Will).
- **D17 Fan-out items upload as each item's contract passes**, not once per family. A crash 10 cells into 14 loses nothing.
- **D18 Recording: a deterministic path plus a manifest, no DB change.** Paths are `runbook-runs/<runbook_run_id>/steps/<step>[/<item>]/<relpath>` in the `submission-data` bucket, beside the gate files. `persisted.json` sits at the run prefix and at `<run>/.conductor/persisted.json`.
- **D19 Never a failure path.** An upload error is printed once and recorded in the manifest, and the run continues, on the same rule as checkpoints (`substation_client.rs:10-13`).
- **D26 Transport = signed-URL batches from cityhall-new.** `POST /api/runs/:runId/step-files` signs ≤200 paths per call; conductor2 streams each file from disk with a PUT (4–8 at once). The Vercel function never holds file bytes, so the 2–4 GB sandbox memory limit doesn't apply. Files over the bucket's per-object limit are recorded as `too_large`.

## 4. The runbook graph

`bureau/runbooks/completeness-check/`. Each row is one step folder under `steps/`. "Legacy" names the `workflow.yaml` step it reproduces.

| Step | Runner | Legacy | Reads | Writes (step folder) | Persisted |
|---|---|---|---|---|---|
| `1.1-inputs` | `none` | (kickoff inputs) | — | `request.json` | yes |
| `1.2-stage-submission` | script | `resources.submissionVersion` | 1.1 | same as review's 1.2 (`README.md`, `block-manifest.json`, `download-manifest.json`, `primary-site-plan/`, `supplementary-docs/?`, `_health.json`) | **no** |
| `1.3-facts` | script | `project-downloader` facts.md | 1.2 | `facts.md` | **no** |
| `1.4-resolve` | script | `resolve-jurisdiction.ts`, `engine.ts:107-174`, `resources.bureau` | 1.1, 1.2 | `resolved.json` (jurisdiction, checklistVersion, guides[], bureauCommitHash, projectId, submissionVersionId), `roster.txt`, `checklist/` (copy of the guide dir: provenance + pinning) | yes |
| `2.1-review/` → `review` | `review` (foreach `sh: cat roster.txt`) | `review` | 1.2, 1.3, 1.4 | `<guide>--r<k>/findings.json` (emit shape), `vision-log.jsonl?`, `search-log.jsonl?` | yes, per item |
| `2.2-consolidate` | script | `cross-run-consolidate-cc` | 1.4, 2.1 | `findings/<guide>.md.json`, `consolidated-findings.json?`, `consolidation-summary.json` | yes |
| `2.3-forced-outcomes` | script | `apply-forced-outcomes` | 1.1, 1.4, 2.2 | `findings/` (copy, patched), `forced-outcomes-receipt.json?`, `dropped-forced-outcomes.json?` | yes |
| `2.4-uncertain-inputs` | script | `prepare-uncertain-explanation-inputs` | 1.1, 1.4, 2.2, 2.3 | `<ref-slug>.json*` (possibly none) | yes |
| `2.5-explain/` → `explain` | `explain` (foreach `sh: ls 2.4/*.json \|\| true`) | `explain-uncertain` | 2.4 | `<input>/result.json` or `<input>/FAILED.md` | yes, per item |
| `2.6-uncertain-collect` | script | `collect-uncertain-explanations` | 2.4, 2.5 | `uncertain-explanations.json` (`{}` when none) | yes |
| `2.7-enrich` | script | `enrich-findings` | 1.4, 2.2, 2.3 | `enriched-findings.json` (+ summary sidecar) | yes |
| `2.8-format` | `format` | `format-reports` | 1.4, 2.7 | `rephrased-items.json`, `completeness-check-consolidated-report.md`, `reports/<grouping>.md` | yes |
| `2.9-comments` | script | `build-review-comments` | 1.1, 1.2, 1.4, 2.2, 2.6, 2.7, 2.8 | `review-comments.json` | yes |
| `2.10-validate` | script | `validate-review-output` | 2.7, 2.9 | `validation.json` | yes |
| `3.1-publish` | script | `review:` + `review-saver.ts` | 1.1, 1.2, 1.4, 2.7, 2.9, 2.10 | `decision.json` + `publish.log`, or `SKIPPED.md`; `$RUN/review-publishing-record.json` | yes |

Notes:
- **`runs`** is folded into the roster: `1.4-resolve` prints one line per `<guide>--r<k>` for k = 1..runs. `2.2` lays the items out as the legacy `runs/run-<k>/findings/<guide>.md.json` tree under `scratch/`, **injecting `grouping`** from the item name (the canonicalization conductor-1 did, `structured-output-repair.ts:266-336`), then calls the legacy script unchanged. `runs=1` follows the script's own passthrough branch (`cross-run-consolidate-cc.ts:163-186`).
- **Copy-forward.** A script step never mutates an upstream folder. `2.3` copies `2.2/findings/` into its own folder before patching. That is a behaviour change from legacy, which patched in place, and it is what keeps each persisted step meaningful on its own.
- **Optional steps** (`forceOutcomes` absent, `explainUncertain: false`, `publish: false`) write `SKIPPED.md` with every output marked `?`, and contracts use `expectFilesOrMarker`. `2.5` with zero inputs is a valid empty fan-out (the common case, matching `allowEmptyChecklist`).
- **Adapters for path assumptions** live in each step's `cmd`:
  - `build-review-comments --projectsDir` expects `projects/<id>/block-manifest.json`. `2.9` symlinks `scratch/projects/<projectId>` → `1.2-stage-submission`.
  - `--bureauCommitHash` comes from `resolved.json`.
  - `commentNumberingMapFile` is passed only when the request names one, which replaces the dotted-section templating.
- **Concurrency.** `CONDUCTOR_CONCURRENCY` (default 16) replaces `maxWorkers`. The 40 cap was a 4-vCPU sandbox limit (winston#188), which doesn't apply on the local lane.
- **Retries.** An agent step resumes its own session up to `MAX_RETRIES=2` on a red contract (`conductor2/src/harness.rs:26`), which replaces legacy `retries: 1` (fresh session) and `3`. A script step has no retry, so a red script parks the run for the captain.
- **Lane B paths are flags.** Its docstring's `2.4-enrich / 2.6-comments / 2.7-deliver` were a sketch with no runbook behind them. `3.1` passes `--review-comments $RUN/2.9-comments/review-comments.json --valid-refs $RUN/2.7-enrich/enriched-findings.json`, and the docstring is updated to match.

## 5. Agent steps

### 5.1 Contracts

| Step | Contract |
|---|---|
| `2.1-review/review` | `findings.json` parses against a zod port of `completeness.emit.schema.json`. `[BLOCKING]` item coverage 1:1 against the guide (D22). `evidenceLocations[].blockNumber`, if present, is an integer. The family contract is `expectSameSet(roster, childDirs)` + `expectNoStrays`. |
| `2.5-explain/explain` | `result.json` parses against a zod port of `uncertain-explanation.emit.schema.json`, its `ref` equals the input's ref, **or** `FAILED.md` exists (D23). |
| `2.8-format` | `rephrased-items.json` has a key for every `{grouping}:{checklistItemId}` in `enriched-findings.json` and no extra keys (the provenance check that `2.10` re-runs as the step of record); one `reports/<grouping>.md` per grouping. |

Script steps' contracts check their declared files exist and parse (zod over the same legacy JSON schemas). `2.10` passes only on `validation.json.ok === true`.

### 5.2 Prompt port (mechanical)

Copy `prompts/{review,explain-uncertain,format-reports}.md` into the step folders and substitute:
- `{{ WORKSPACE_PATH }}/projects/{{ input.projectId }}/` → `$RUN/1.2-stage-submission/`, with `facts.md` at `$RUN/1.3-facts/facts.md`. Also fix the stale `site-plans` line (`review.md:14`).
- `{{ checklistItem }}` → the guide derived from `{{ITEM}}` (`cc-21--r2` → `$RUN/1.4-resolve/checklist/cc-21.md`).
- The `vision` / `semantic-search-blocks` tool descriptions → the two CLI invocations (D20). Arguments, logging and the "pass `checklistItemIds`" rule are unchanged.
- `{{ untrustedInputContract }}` → inlined verbatim from `workflows/shared/untrusted-content.md`. A test in the runbook's `npm test` asserts the inlined block still equals the shared file, so the two can't drift silently.
- The standard-notes URL → read from `request.json`.
- The output instruction "emit structured output" → "write `findings.json` to your item folder", with the emit schema quoted.

## 6. Request (`1.1-inputs/contract.test.ts`)

```ts
export const Request = z.object({
  submission: z.object({ submission_version_id: z.string().uuid() }),
  jurisdiction: z.string().optional(),            // must match project.jurisdiction_slug (1.4 hard-fails otherwise)
  checklistVersion: z.string().optional(),        // default: jurisdictions/<j>/completeness-check/CURRENT_VERSION
  checklistsDir: z.string().optional(),           // bureau-relative override, e.g. an experimental guide dir
  reviewFiles: z.array(z.string().regex(/^cc-\d+(\.md)?$/)).nonempty().optional(),
  runs: z.number().int().min(1).max(5).default(1),
  uncertainThreshold: z.number().min(0).max(1).default(0.35),
  explainUncertain: z.boolean().default(true),
  forceOutcomes: z.string().optional(),           // TSV filename in the checklist dir
  commentNumberingMap: z.string().optional(),     // TSV filename in the checklist dir
  standardNotesReferenceUrl: z.string().url().default(
    'https://austin.widen.net/s/vxznrtmfwf/sp_consolidatedsiteplanapplication_notestemplates'),
  priorReviewId: z.string().uuid().optional(),
  publish: z.boolean().default(true),
  setCurrent: z.boolean().default(true),
})
```

Example for the iteration loop:

```json
{ "submission": { "submission_version_id": "6b9b85ed-e992-4906-a222-b24ee836910c" },
  "reviewFiles": ["cc-1", "cc-21"], "runs": 1, "setCurrent": false }
```

## 7. Step persistence

### 7.1 Config (conductor2, `runbook.yaml`)

```yaml
persist:
  steps: all                      # all | [step ids]; absent block = off
  skip: [1.2-stage-submission, 1.3-facts]
  rules:                          # optional, step-id globs → path filters (relative to the step folder)
    "2.1-review/*": { exclude: ["**/*.tmp"] }
```

- Effective set per step = declared `outputs:` globs ∩ `include` (default `**`) − `exclude` − `scratch/**`.
- `CONDUCTOR_PERSIST=off` disables it for a run, and `=on` enables it with the runbook's config, or with `steps: all` if the runbook has none.
- Sub-runbooks inherit nothing: the parent's `runner: runbook` step persists its own folder, matching how checkpoints stay silent inside a sub-runbook.

### 7.2 Mechanics (conductor2)

1. **When:** on a node's successful exit (contract green), from the same place `emit_step_event` fires (`sched.rs:1223`). Fan-out members are persisted individually (D17). A `runner: none` gate persists when its contract passes.
2. **Not on the critical path:** uploads go to a bounded background worker pool (4–8 PUTs). The scheduler moves on, and the outer `advance` drains the pool, with a timeout, before its callback.
3. **Dedupe:** the local manifest is keyed by `(step, item, relpath)` → sha256. If the bytes are unchanged, nothing is sent. A retried step with new bytes upserts the same path.
4. **Batch:** one `step-files` call per ≤200 files, then a streaming PUT per file from disk (no full read into memory).
5. **Manifest:** `<run>/.conductor/persisted.json` is rewritten after each batch and uploaded to `runbook-runs/<id>/persisted.json`. Entries are `{step, item?, relpath, storage_path, sha256, bytes, attempt, status: uploaded|unchanged|too_large|failed, error?, at}`.
6. **Auth:** the run bearer that `init` already leaves for the checkpoint lane (`substation_client.rs:341-377`), on both lanes. With no bearer or id it's a no-op with one warning, like checkpoints.
7. **Endpoint base:** the same `SUBSTATION_URL` env var `init` uses (`init.rs:25-29`), which now points at cityhall-new.

### 7.3 Route (cityhall-new)

`POST /api/runs/:runId/step-files`. Admission is `requireBearerOrService` (as in `gate-files`).

```jsonc
// request
{ "files": [ { "step": "2.1-review", "item": "cc-21--r1", "path": "findings.json",
               "sha256": "…", "bytes": 48213, "content_type": "application/json" } ] }   // ≤ 200
// response
{ "files": [ { "path": "findings.json", "item": "cc-21--r1",
               "storage_path": "runbook-runs/<runId>/steps/2.1-review/cc-21--r1/findings.json",
               "status": "upload", "upload_url": "https://…signed…" } ] }                 // or status: "too_large"
```

- Validates `step`, `item` and `path` segments (`[A-Za-z0-9._-]`, no `..`, no leading `/`). Rejects batches over 200 entries.
- `createSignedUploadUrl(path, { upsert: true })`. `bytes` greater than the bucket's limit gives `too_large` and no URL.
- The `_run` pseudo-step is reserved for `persisted.json`.
- Contract and ported tests go into `tests/api/runs-contract.test.ts` style. The route is **additive**, so no existing machine-lane contract changes (`AGENTS.md:346-355`).

## 8. Testing

### 8.1 Tier 0: contracts (no run)
`npm test` in `runbooks/lib` runs every contract over `completeness-check/examples/<scenario>/`. The first scenario, `lamar-v4-cc1-cc21`, is curated from the first accepted subset run (binaries offloaded per the examples rules).

### 8.2 Tier 1: deterministic downstream replay (no LLM except 2.3 / 2.8)
`conductor stage 2.2-consolidate --scenario examples/lamar-v4-cc1-cc21`, then `advance` through `2.10` with `publish: false`. Two checks:
- **Self-replay:** the curated `2.1` output reproduces the curated `2.9-comments/review-comments.json`, modulo timestamps and the two LLM-written fields (forced narratives, rephrased titles).
- **Cross-lane replay:** a helper converts a **legacy** run's `output/runs/` into `2.1-review/<guide>--r<k>/findings.json`. That legacy run is pulled from the `workflow-runs` bucket, or produced with the subset-checklist-dir trick (§8.3). Replaying `2.2→2.9` must reproduce the legacy `review-comments.json` on the same terms. This proves the wiring is at parity with the LLM variance taken out.

### 8.3 Tier 2: live loops
- **Legacy subset run:** `scripts/legacy-subset-dir.sh cc-1 cc-21` builds a temporary checklist dir (the chosen guides + TSVs) on a scratch bureau branch and passes `checklistsDir`. There is no conductor-1 change.
- **v2 subset run:** `/conductor completeness-check` with the §6 request.
- **Compare:** `runbooks/completeness-check/scripts/compare.ts <a> <b>…`. It accepts any mix of legacy output dirs, v2 run dirs and persisted v2 prefixes, and writes per-item status agreement, the confusion matrix, count deltas and per-item evidence diffs as JSON plus a markdown table. This one tool serves both loops Will named: legacy vs v2 on the same submission, and v2 vs v2.

### 8.4 Acceptance bar (port done)
On both fixtures, with `reviewFiles: ["cc-1","cc-21"]`:
1. N=3 legacy runs and N=3 v2 runs at `runs=1`. v2-vs-legacy per-item agreement must be ≥ legacy-vs-legacy agreement − 5 points.
2. One v2 run at `runs=3` that yields ≥1 uncertain item, exercising `2.4–2.6` end to end. If neither fixture produces one naturally, raise `uncertainThreshold`.
3. Tier 1 cross-lane replay is green.
4. A publish with `setCurrent: false`: a `reviews` row with `output_schema = 2026-03-completeness-check`, `is_current = false`, the prior current row untouched, and the comments rendering in cityhall by review id.
5. `persisted.json` lists every run-produced file, the prefix is complete, and `1.2` / `1.3` are absent.

**Fixtures:** primary is 1700 S Lamar (Lamar + Collier) v4, project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, sv `6b9b85ed-e992-4906-a222-b24ee836910c`, PPv4 run `b918e8c1`, which has `1700-s-lamar-forced-outcomes.tsv`. Secondary is 2008 San Antonio v1, project `7746ac2f`, sv `624309c1`, PPv4 runs `b876caad` / `57e0b2f6`.

### 8.5 Unit tests
- **conductor2:** persist config parsing, glob filtering, dedupe, and the never-fail path, against the existing mock server (`substation_client.rs:409-454`).
- **cityhall-new:** route validation, the 200 cap, `too_large`, admission.
- **bureau:** lane B `--no-set-current` / `--prior-review-id` in `test_publish_review_cli.py`; `1.4-resolve` (CURRENT_VERSION, mismatch hard-fail, reviewFiles filter, runs roster); the `2.3` TSV filter; the `2.2` grouping injection.

## 9. Delivery order

1. **cityhall-new:** `step-files` route + tests.
2. **conductor2:** `persist:` + uploader. Inert until a runbook opts in, and harmless before step 1 deploys (404 → one warning).
3. **bureau:** the runbook, the vision CLI, lane B flags, `compare.ts`, the legacy-subset helper, and the Tier 0 / 1 tests.
4. **Acceptance runs (§8.4)**, then curate `examples/lamar-v4-cc1-cc21`.

## 10. Follow-ups (out of scope)

- **Run-health audit → conditional publish gate.** A deterministic `2.11-health` step scores the run: failed or `FAILED.md` cells, null-explanation share, vision/search error rates, item-coverage resumes, `too_large` uploads. Only when it flags something does a `runner: none` `2.12-deliver` gate ask in the console whether to publish. Otherwise its contract passes vacuously and no question is created.
- **Resume from Storage:** `conductor hydrate <runbook_run_id> $RUN` rebuilds a run dir from `persisted.json` and re-stages `1.2` / `1.3` from the DB, then `advance` continues. This is the cloud payoff of D13–D26.
- **Cloud lane** (`trigger-cloud-runbook`), then retiring legacy CC and moving its scripts into the runbook.
- **Post-parity experiments:** drop `facts.md`, native image reading instead of the Gemini `vision` CLI, Opus for `review`.

## 11. Open questions

- **Q1 AGENTS-core rule 19 vs `facts.md` (D24).** conductor2 prepends `runbooks/lib/AGENTS-core.md` to every step. Rule 19 bars "any prior Noetic output about this project", and `project_facts` carries prior-review-derived directives (the very reason `stage_submission.py:1000-1012` dropped it). A Sonnet worker may refuse `facts.md`, or read it inconsistently, which is exactly the variance parity can't tolerate. Options: (a) accept and measure; (b) depend on the per-runbook-conventions spec (winston scratch-pad #2) and give CC `answers: open`; (c) reverse D24 and drop `facts.md` now. **The whole 21-rule preamble is itself a parity delta**, because legacy agents saw none of it, so (b) may be needed regardless.
- **Q2 Bucket and size limit.** Should persisted files share `submission-data` (beside the gate files, D18), or go to a dedicated private `runbook-runs` bucket with its own lifecycle and size limit? The `submission-data` per-object limit is unverified.
- **Q3 Vision CLI credentials on the local lane.** The sheet fetch needs `submission-data` read, and the gateway call needs `AI_GATEWAY_API_KEY`. Which key does the review worker's env carry (run JWT vs service role)? And is gateway attribution keyed by `runbook_run_id` (legacy used `WORKFLOW_RUN_ID` / `RUN_LABEL`)?
- **Q4 Effort level for the presets.** Legacy left `effort` unset (the SDK default); the Claude Code harness has its own default. Pin it to whatever legacy actually got.
- **Q5 Harness system prompt.** The Claude Code CLI (conductor2 `claude` harness) and the Agent SDK (conductor-1) give the model different system prompts and tool descriptions. That difference is inherent to the port and is part of what §8.4 measures. Is that acceptable, or should the harness run with a minimal system prompt?
- **Q6 `1.1-inputs` with no question.** Confirm that a `runner: none` step whose `request.json` exists before the first `advance` passes without opening a `runbook_hitl_questions` row, which is the behaviour review's kickoff relies on.
- **Q7 Inch-mark JSON.** Legacy hit content-determined emit failures (unescaped `"`) under SDK structured output. With a file-writing agent plus a zod contract, a malformed file resumes the session with the parse error. Is that expected to suffice, or should we add a tolerant-parse repair (`tryRepairStructuredOutput`) in `2.2`?
- **Q8 Legacy-trail readers.** The `audit-cc-run` skill and IG read `workflow_runs` / the `workflow-runs` bucket. They need a v2 path (the `runbook_runs` id + persisted prefix) before legacy retires.
