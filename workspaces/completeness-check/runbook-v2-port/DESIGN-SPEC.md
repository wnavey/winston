# Completeness Check → Runbook v2 (feature-parity port)

**Status:** Draft v2
**Date:** 2026-10-02
**Repos touched:** `bureau` (new `runbooks/completeness-check/`, two agent-tool CLIs, a tool-usage step, `publish_review_cli.py` lane B flags, the `cc-compare` evaluation runbook), `conductor2` (opt-in per-step persistence to Storage), `cityhall-new` (new `POST /api/runs/:runId/step-files` signing route)
**Repos NOT touched:** `conductor` (legacy TS lane stays frozen), `substation` (retired as the API home; `cityhall-new` owns `/api/runs/*`), `cityhall`, `claude-plugins` (the `/conductor` captain skill drives any runbook already)

Grilled with Will on 2026-10-02. Every decision below is numbered `D<n>`; open questions are `Q<n>`.

> **Revision note (v2, 2026-10-02, after an audit of v1 against the code):**
> - **D21 reversed (tool allowlist → post-run observability).** The allowlist can't be enforced on the `claude` harness: `permission:` reaches only the opencode lane (`conductor2/src/model.rs:55-58`), and the `claude` lane always passes `--dangerously-skip-permissions` (`claude.rs:65`), which bypasses `permissions.deny` (`surface.rs:288-296`). Instead, a new deterministic `2.11-tool-usage` step reads the session streams conductor2 already saves and reports every tool call, flagging anything outside the two CLIs and the allowed folders. **D27 new:** those streams are persisted too.
> - **§8 rewritten (testing).** No legacy re-runs. The baseline is the two existing legacy reviews on Lamar + Collier v4 (Opus 5 `41a49412`, Sonnet 5.5 `196de05b`). A new run may cover any guide subset and is compared only on those guides. If all three runs agree on an item, it is accepted. Disagreements go to blind agentic adjudication, and the verdicts build up an answer key so later loops don't pay for them again (**D28, D29 new**). Dropped: the N=3-per-lane variance bar, `legacy-subset-dir.sh`, and the cross-lane replay as a gate. The secondary San Antonio fixture is dropped too, because no legacy baseline is named for it.
> - **D22 tightened.** Item ids come only from the ID column of the guide's checklist table(s). Guides cite ids in prose that aren't rows: cc-1 cites `CC-1-07`, which is absent from its table, and cc-21 cites `CC-19-07`…`CC-19-21`. Id prefixes also vary (`ADR-` in cc-5, `AW-` in cc-13).
> - **D8 reversed; fact row corrected.** `apply-forced-outcomes.ts` does not error on a forced ref with no organic finding. It warns, keeps the matching rows, and records the rest as `unmatched` in its receipt (`:356-378`). Legacy therefore already tolerates a subset, so the wrapper and `dropped-forced-outcomes.json` are gone.
> - **D30 new (declared parity gap).** Legacy's `applyToolAttribution` writes `review_comments.agent_trace.tools_used` (`review-saver.ts:287-365`). Lane B doesn't, and v2 doesn't add it, because the app reads the trace from `output_json` (`cityhall-new/src/lib/reviews/adapters/agent-trace.ts`). Q8 now also asks who reads the column.
> - **Coverage note (§8.4).** The Lamar forced-outcomes TSV only has rows for cc-3, cc-5, cc-13 and cc-24, so a loop has to include one of those guides to exercise `2.3`.
> - **Q9 new:** four facts about the two baseline reviews that `compare.ts` depends on and that v2 could not verify. Q4 (effort) is folded into it.
> - **Open questions resolved with Will (2026-10-02):** Q1 + Q10 (new): the prompts override rule 19 (**D31**). Q2: a dedicated private `runbook-runs` bucket (D18 revised). Q5: accept the CLI's default system prompt. Q3 and Q6 were settled from the code, and Q7 takes the default (no repair). Still open: Q8 (before legacy retires). Q9 was resolved from DB reads on 2026-10-02 (§11.1). Its consequences are in D6, D28, D29 and §8.2–8.4.

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
| `apply-forced-outcomes` **warns** when a forced ref has no organic finding, applies the rows that match, and records the rest as `unmatched` in `forced-outcomes-receipt.json` (v1 said it errors) | `apply-forced-outcomes.ts:356-378` |
| The Lamar forced-outcomes TSV has rows only for cc-3, cc-5, cc-13 and cc-24 (2 rows) | `v2.7-trimmed/1700-s-lamar-forced-outcomes.tsv` |
| Review agents get `vision` (Gemini 3.1 Pro via gateway) and `semantic-search-blocks` as in-process MCP tools; conductor2 has no in-process tools | `conductor/src/tools/index.ts:323`, `tools/vision/index.ts:90-210` |
| The structured-output emit schema omits `grouping`; conductor-1 injects it from the cell filename | `conductor/src/agent/structured-output-repair.ts:266-336` |
| The `claude` harness always runs `--dangerously-skip-permissions`, which bypasses `permissions.deny`. A preset's `permission:` reaches only opencode, so no tool allowlist can be enforced on the host lane | `conductor2/src/claude.rs:65`, `model.rs:55-58`, `surface.rs:288-296` |
| conductor2 saves every agent session's raw `stream-json` (every tool call with its input) to `$RUN/.logs/<step>--<item>.<attempt>.jsonl`, outside every step folder | `conductor2/src/harness.rs:1258-1274` |
| Guides cite item ids in prose that aren't checklist rows (cc-1: `CC-1-07`, which has no table row; cc-21: `CC-19-07`…`21`), and id prefixes vary (`CC-n-`, `ADR-`, `AW-`) | `v2.7-trimmed/cc-1.md:49,63-`, `cc-21.md:31,123`, `cc-5.md:46-` |
| Legacy `applyToolAttribution` writes `review_comments.agent_trace.tools_used` from `vision-log.jsonl` / `semantic-search-blocks-log.jsonl`; lane B has no equivalent. The app reads the trace from `output_json.agentTrace`, not the column | `review-saver.ts:287-365`, `cityhall-new/src/lib/reviews/adapters/agent-trace.ts` |
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
2. One runbook step per legacy step, each separately checkpointed (D2). The `runner: none` step `1.1-inputs` is the exception: gates send no `status` checkpoints (`conductor2/src/sched.rs:1186-1194`).
3. Same intermediate file schemas, same `review-comments.json` envelope (`reviewType: completeness_check`), same `reviews` / `review_comments` rows (`output_schema = 2026-03-completeness-check`) (D1).
4. `reviewFiles: ["cc-1","cc-21"]` runs only those guides end to end (D7).
5. Opt-in, filterable per-step persistence of run-produced files to Supabase Storage, so an interrupted run loses nothing (D13–D19).
6. Easily testable: deterministic replays of the downstream steps for zero tokens, plus an iterate-and-compare loop against the two existing legacy reviews, with agentic adjudication only where the runs disagree (§8).
7. Every difference from legacy is explainable after the fact: a per-cell tool-usage report (D21) plus adjudication cause tags (D29).

**Non-goals (deferred, with reason)**
- **Cloud lane.** v1 is local captain only (D4). The persistence feature is built lane-agnostic so cloud can come next.
- **Resume on another box from Storage.** v1 only *writes* a complete, manifest-indexed copy. The resume reader is a follow-up (§10).
- **A HITL publish gate.** Will: a gate before publish only earns its place behind a run-health audit that surfaces a concern. That audit is a new feature (§10). v1 auto-publishes like legacy (D9).
- **Retiring legacy CC** and switching cityhall's trigger. This happens after the acceptance bar (§8.4) is met.
- **Experiment overlays** (`vision-check` router, `inspect-drawing`, `enabledVisionSpecialists`). No prod caller was found, so they're dropped (D12).
- **Behaviour changes the new review made** (Opus, native image reading, prose guides, no `facts.md`). Each is a separate, measured experiment once parity is shown.

## 3. Decisions

### Parity and shape
- **D1 Parity bar = same envelope + same DB rows** (one declared gap: D30). Every intermediate keeps its legacy schema (`runs/*/findings/*.json`, `consolidated-findings.json`, `findings/`, `forced-outcomes-receipt.json`, `uncertain-explanations.json`, `enriched-findings.json`, `rephrased-items.json`, `review-comments.json`), so the legacy scripts run **unchanged**.
- **D2 One checkpointed step per legacy step**, plus explicit steps for what conductor-1 did implicitly: inputs, staging, facts, resolve and publish (§4).
- **D3 Reference legacy code in place.** Script steps call `$BUREAU/workflows/completeness-check/scripts/*.ts`. Prompts are copied once into the runbook, because the substitutions are mechanical (§5.2). Both lanes run the same scripts while we compare. Moving the scripts is part of retiring legacy.
- **D4 Local captain first.** Cloud is a later phase.

### Inputs and models
- **D5 Request, not typed inputs.** `1.1-inputs/request.json` is validated by a zod `Request` (§6). `runner: none`: the captain writes the request before the first `advance`, so the contract passes and no question is asked.
- **D6 Models live in `runners:` presets**, not in the request: `review`, `explain` and `format`, all `claude` / `sonnet-5.5` (legacy defaults). A/B tests use `--runner`. The presets **leave effort unset** (the SDK default), because both baselines ran with `effort` null (Q9e). Dropped request fields: `model`, `effort`, `uncertainExplanationModel`, `maxWorkers`, `uncertainExplanationMaxWorkers`, `departmentCode` (always `cc`), `enabledVisionSpecialists`.
- **D7 `reviewFiles`** is an optional non-empty array of guide basenames (`cc-1` or `cc-1.md`, normalized to no extension). `1.1-inputs` rejects unknown names, listing what exists. `1.4-resolve` filters the roster. Everything downstream sees only those guides' findings.
- **D8 `forceOutcomes` with a subset: no wrapper (v2).** The legacy script already applies only the rows that match an organic finding and records the rest as `unmatched` in `forced-outcomes-receipt.json` (`apply-forced-outcomes.ts:356-378`). `2.3` calls it directly. (v1's filter wrapper and `dropped-forced-outcomes.json` rested on a wrong reading of the script.)

### Publish
- **D9 Auto-publish, no gate.** `3.1-publish` writes its own `decision.json` (`status: approved`, `publish.project.id` from the staged manifest, `versioning: iterate`, `label` = `cc <checklistVersion> <reviewFiles or "all">`) and calls lane B. `request.publish: false` writes `SKIPPED.md` instead (test loops).
- **D10 Subsets publish too.** Exposure is gated by `setCurrent`, not by refusing to publish. `request.setCurrent` (default true, like legacy) maps to a new lane B flag `--no-set-current`: insert `is_current=false`, skip the retire. A test review is reachable only by its id.
- **D11 Lane B gains `--prior-review-id`** (writes `reviews.prior_review_id`). Legacy's other `priorReviewId` behaviour, pinning guides to the prior review's bureau commit, is dropped. Retire scope stays lane B's (project + department + submission_version), which matches legacy when the submission version is known.

### Agent behaviour
- **D12 Drop the experiment overlays.** Baseline `review.md` only.
- **D20 Port both agent tools as CLIs** the agent calls through Bash:
  - `runbooks/completeness-check/bin/vision.ts` is a port of `conductor/src/tools/vision/index.ts`: same Gemini model, same `prompt.md` (copied), same params (`--document-id`, `--sheet`, `--prompt`, `--item-ids`), sheet image fetched from `submission-data` via `plan_set_version`/`sheet_version`. It appends `{ts, itemIds, documentId, sheet, prompt, response}` to `$OUT/vision-log.jsonl`. Logging the prompt and item ids closes the long-standing baseline prompt-traceability gap at no extra cost.
  - `semantic-search-blocks` already is a CLI (`workflows/completeness-check/scripts/semantic-search-blocks.ts`). The step passes `--projectId` explicitly, because the script's `projects/<one dir>` inference doesn't hold in a runbook run dir, and logs to `$OUT/search-log.jsonl`.
- **D21 Post-run tool observability instead of an allowlist (v2, reverses v1).** An allowlist can't be enforced on the `claude` harness: `--dangerously-skip-permissions` bypasses deny rules, and `permission:` only reaches opencode. The prompt still tells the agent to use only the two CLIs, and the run then *checks* what it did. A deterministic script step `2.11-tool-usage` reads the session streams conductor2 already saves (`$RUN/.logs/<node>.<attempt>.jsonl`) for `2.1`, `2.5` and `2.8`, and writes one `tool-usage.json` per cell:
  - calls per tool;
  - every Bash command, flagged `off_list` unless it is the vision or search CLI;
  - every file read or written, flagged `out_of_scope` outside `$RUN/1.2-stage-submission`, `$RUN/1.3-facts`, `$RUN/1.4-resolve/checklist` and the cell's own folder;
  - vision CLI calls reconciled against `vision-log.jsonl`;
  - D22 resumes, with the ids each one demanded.

  A `summary.json` rolls these up. The step never fails the run: it is evidence for the comparison loop (§8.3), not a gate. Legacy agents had only `vision` and `semantic-search-blocks`, so any other tool use is an attributable difference, which is the explanation Will wants if v2 scores differently.
- **D22 Every item resolves exactly once.** The review worker's contract reads its guide's item ids **from the ID column of the checklist table(s) only** (v2). Prose mentions such as `CC-1-07` or cc-21's `CC-19-07…21` are not items. The contract `[BLOCKING]`-requires a 1:1 match with `findings[].checklistItemId`. A miss resumes the session with the missing ids. Legacy never enforced this, so v2 answers items legacy dropped. In the comparison those items show up as "missing in a legacy run", and adjudication tags them `missed-item` (D29), so the difference is attributed instead of being read as a model change. The parser gets fixtures for every id prefix (`CC-n-`, `ADR-`, `AW-`) and for cc-1 and cc-21's prose mentions.
- **D23 explain-uncertain keeps legacy tolerance.** A worker may finish with `FAILED.md` instead of `result.json` (the contract accepts either). `2.6` treats `FAILED.md` as a null explanation, so the >50%-null tripwire in `collect-uncertain-explanations.ts` still fails the run on systemic failure.
- **D24 Staging = `stage_submission.py`, plus a facts step for parity.** `1.3-facts` renders `facts.md` from `project_facts` exactly as conductor-1 did (`conductor/src/shared/project-downloader.ts:874-890`), so the parity comparison measures only the runner change. Dropping `facts.md` (the runbook stance, `stage_submission.py:1000-1012`) is the first post-parity experiment. The conflict with AGENTS-core rule 19 is resolved by D31.

### Trails
- **D25 Drop `workflow_runs` and the `workflow-runs` bucket upload.** `runbook_runs` is the run row; persisted step files are the artifacts. The readers that need a v2 path later are listed in Q8.

### Step persistence (conductor2 + cityhall-new)
- **D13 Lives in conductor2, off by default, generic to every runbook.** Only `completeness-check/runbook.yaml` turns it on in v1.
- **D14 Config** is a `persist:` block in `runbook.yaml` (§7.1). Absent means off. `CONDUCTOR_PERSIST=off|on` overrides it for one run.
- **D15 What gets persisted defaults to the step's declared `outputs:`** minus `scratch/`, narrowed by per-step `include`/`exclude` globs.
- **D16 Only run-produced files.** CC persists everything **except** `1.2-stage-submission` and `1.3-facts`, which are DB data pulled into the run (Will).
- **D17 Fan-out items upload as each item's contract passes**, not once per family. A crash 10 cells into 14 loses nothing.
- **D18 Recording: a deterministic path plus a manifest, no DB change.** Paths are `<runbook_run_id>/steps/<step>[/<item>]/<relpath>` in a **new private `runbook-runs` bucket** (Q2, decided). It has its own per-object size limit and a lifecycle rule, so the D27 session logs can expire without touching `submission-data`. The bucket is created by a `cityhall-new/supabase/migrations/` migration that ships with the route (§9 step 1). Gate files stay where they are. `persisted.json` sits at the run prefix and at `<run>/.conductor/persisted.json`.
- **D19 Never a failure path.** An upload error is printed once and recorded in the manifest, and the run continues, on the same rule as checkpoints (`substation_client.rs:10-13`).
- **D26 Transport = signed-URL batches from cityhall-new.** `POST /api/runs/:runId/step-files` signs ≤200 paths per call; conductor2 streams each file from disk with a PUT (4–8 at once). The Vercel function never holds file bytes, so the 2–4 GB sandbox memory limit doesn't apply. Files over the bucket's per-object limit are recorded as `too_large`.

- **D27 Agent session streams are persisted (v2).** `persist:` gains `logs: [<step ids>]`. For each listed agent step, every `.logs/<node>.<attempt>.jsonl` is gzipped and uploaded to `<id>/logs/<node>.<attempt>.jsonl.gz` in the `runbook-runs` bucket when the node exits, through the same signed-URL batch and manifest (entries carry `step: "_logs"`). CC lists `2.1-review`, `2.5-explain` and `2.8-format`. Without this, the evidence behind D21 disappears with a cloud box.

### Evaluation (v2)
- **D28 The parity baseline is two existing legacy reviews; nothing legacy is re-run.** Both are on Lamar + Collier v4: **A** = Opus 5, review `41a49412-a422-485f-8f6c-16e28df94a4c`, and **B** = Sonnet 5.5, review `196de05b-3d19-4e83-8fd7-6e4a4dfc5c3c`. v2 runs on Sonnet 5.5 (D6), so B is the like-for-like reference and A is a second opinion. A v2 run may cover any `reviewFiles` subset. The comparison covers only the guides in that run's `resolved.json`, filtering A and B to those guides' items. The loop is: run v2 on a subset, compare, fix v2, run again. **Baseline facts (Q9, read 2026-10-02):** both ran `v2.7-trimmed` at `runs=1`, with effort unset, no `forceOutcomes`, `uncertainThreshold` at the 0.35 default, and `commentNumberingMap: "pape-dawson-comment-num-mapping.tsv"`. B ran at bureau `481bacac` and A at `8325169b`. The guide dir is byte-identical at both commits (tree `e8df1601`), so the loop pins `checklistsDir` to that tree. In practice that means bureau `8325169b`, or any later commit whose `v2.7-trimmed` tree hash is still `e8df1601`.
- **D29 Lazy comparison, blind adjudication, and an answer key that grows.** Each run reduces to one final status per `guide:itemId`. If A, B and v2 all agree, the item is accepted at no cost. Any disagreement, including an item missing from one run, is first looked up in the **answer key** (`bureau/runbooks/completeness-check/eval/lamar-v4/answer-key.json`). A verdict there scores v2 with no agent call. Only items with no verdict go to adjudication: one Opus agent per guide, seeing the three findings under shuffled labels X/Y/Z so it can't favour the new engine. It returns the correct status with evidence, which runs were right, and a cause tag (`missed-item`, `different-evidence`, `misread-document`, `judgement-call`, `guide-ambiguous`). Verdicts are keyed to the guide's content hash and merged into the key, and Will can override any entry by editing the file. A guide whose text differs from what A and B ran against is reported as `guide-drift`, not scored. A and B ran the same guide text (Q9c), so drift is measured only against tree `e8df1601`. **Forced items:** neither baseline forced any outcome (Q9). When a v2 loop sets `forceOutcomes`, every ref the receipt marks applied is bucketed `forced` and not scored, because v2's status there comes from the TSV rather than the model.
- **D30 Declared parity gap: `review_comments.agent_trace` (v2).** Lane B doesn't write the column legacy's `applyToolAttribution` fills, and v2 doesn't add it. The app reads the trace from `output_json` (fact table), and D21's `tool-usage.json` is the richer record. Q8 asks whether IG reads the column before legacy retires.
- **D31 Rule 19 is overridden in the prompts, not by conventions (Q1 + Q10, decided).** AGENTS-core rule 19 bars "any prior Noetic output about this project", and anything named like an answer key or under `eval/`. Per-runbook conventions (`answers:`, winston#285) are not built in conductor2, so v2 doesn't wait for them. It relies on today's rule that a runbook's own instructions win where they directly contradict the shared rules:
  - The CC `review` prompt names `$RUN/1.3-facts/facts.md` as an in-bounds input, which keeps parity with legacy.
  - `cc-compare`'s `2.1-adjudicate` prompt names the two legacy reviews' findings (A, B, under blind labels) and v2's findings as in-bounds, because judging them is its job.
  - Nothing overrides the bar on the answer key. A CC review agent must never read `eval/`, and `2.11-tool-usage` flags any read under `runbooks/completeness-check/eval/` as `out_of_scope`.

  Once winston#285 lands, these become `answers: prior-output` (CC) and `answers: open` (`cc-compare`).

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
| `2.3-forced-outcomes` | script | `apply-forced-outcomes` | 1.1, 1.4, 2.2 | `findings/` (copy, patched), `forced-outcomes-receipt.json?` | yes |
| `2.4-uncertain-inputs` | script | `prepare-uncertain-explanation-inputs` | 1.1, 1.4, 2.2, 2.3 | `<ref-slug>.json*` (possibly none) | yes |
| `2.5-explain/` → `explain` | `explain` (foreach `sh: ls 2.4/*.json \|\| true`) | `explain-uncertain` | 2.4 | `<input>/result.json` or `<input>/FAILED.md` | yes, per item |
| `2.6-uncertain-collect` | script | `collect-uncertain-explanations` | 2.4, 2.5 | `uncertain-explanations.json` (`{}` when none) | yes |
| `2.7-enrich` | script | `enrich-findings` | 1.4, 2.2, 2.3 | `enriched-findings.json` (+ summary sidecar) | yes |
| `2.8-format` | `format` | `format-reports` | 1.4, 2.7 | `rephrased-items.json`, `completeness-check-consolidated-report.md`, `reports/<grouping>.md` | yes |
| `2.9-comments` | script | `build-review-comments` | 1.1, 1.2, 1.4, 2.2, 2.6, 2.7, 2.8 | `review-comments.json` | yes |
| `2.10-validate` | script | `validate-review-output` | 2.7, 2.9 | `validation.json` | yes |
| `2.11-tool-usage` | script | (new, D21) | 1.4, 2.1, 2.5, 2.8, `$RUN/.logs/` | `<cell>/tool-usage.json`, `summary.json` | yes |
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
  logs: [2.1-review, 2.5-explain, 2.8-format]   # D27: gzip + upload these steps' session streams
```

- Effective set per step = declared `outputs:` globs ∩ `include` (default `**`) − `exclude` − `scratch/**`.
- `CONDUCTOR_PERSIST=off` disables it for a run, and `=on` enables it with the runbook's config, or with `steps: all` if the runbook has none.
- `logs:` (D27) is independent of `steps`/`skip`: it names agent steps whose `.logs/` streams are gzipped and uploaded at node exit, every attempt included, so a resumed or retried cell keeps its whole history.
- Sub-runbooks inherit nothing: the parent's `runner: runbook` step persists its own folder, matching how checkpoints stay silent inside a sub-runbook.

### 7.2 Mechanics (conductor2)

1. **When:** on a node's successful exit (contract green), from the same place `emit_step_event` fires (`sched.rs:1223`). Fan-out members are persisted individually (D17). A `runner: none` gate persists when its contract passes.
2. **Not on the critical path:** uploads go to a bounded background worker pool (4–8 PUTs). The scheduler moves on, and the outer `advance` drains the pool, with a timeout, before its callback.
3. **Dedupe:** the local manifest is keyed by `(step, item, relpath)` → sha256. If the bytes are unchanged, nothing is sent. A retried step with new bytes upserts the same path.
4. **Batch:** one `step-files` call per ≤200 files, then a streaming PUT per file from disk (no full read into memory).
5. **Manifest:** `<run>/.conductor/persisted.json` is rewritten after each batch and uploaded to `runbook-runs` bucket at `<id>/persisted.json`. Entries are `{step, item?, relpath, storage_path, sha256, bytes, attempt, status: uploaded|unchanged|too_large|failed, error?, at}`.
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
               "storage_path": "<runId>/steps/2.1-review/cc-21--r1/findings.json",   // bucket: runbook-runs
               "status": "upload", "upload_url": "https://…signed…" } ] }                 // or status: "too_large"
```

- Validates `step`, `item` and `path` segments (`[A-Za-z0-9._-]`, no `..`, no leading `/`). Rejects batches over 200 entries.
- `storage.from('runbook-runs').createSignedUploadUrl(path, { upsert: true })`. `bytes` greater than the bucket's limit gives `too_large` and no URL.
- The `_run` pseudo-step is reserved for `persisted.json`. The `_logs` pseudo-step (D27) maps to `<runId>/logs/<path>` instead of `steps/`, and accepts only `*.jsonl.gz`.
- Contract and ported tests go into `tests/api/runs-contract.test.ts` style. The route is **additive**, so no existing machine-lane contract changes (`AGENTS.md:346-355`).

## 8. Testing

### 8.1 Tier 0: contracts (no run)
`npm test` in `runbooks/lib` runs every contract over `completeness-check/examples/<scenario>/`. The first scenario, `lamar-v4-cc1-cc21`, is curated from the first accepted subset run (binaries offloaded per the examples rules).

### 8.2 Tier 1: deterministic downstream replay (no LLM except 2.3 / 2.8)
`conductor stage 2.2-consolidate --scenario examples/lamar-v4-cc1-cc21`, then `advance` through `2.10` with `publish: false`. **Self-replay:** the curated `2.1` output reproduces the curated `2.9-comments/review-comments.json`, modulo timestamps and the two LLM-written fields (forced narratives, rephrased titles). This catches wiring regressions while fixing bugs, for zero review tokens. (v1's cross-lane replay of a legacy `output/runs/` tree is no longer a gate. It is still possible, because both baselines' raw trees are in the `workflow-runs` bucket, including `output/runs/run-1/findings/cc-N.md.json` for all 14 guides and `enriched-findings.json` (Q9).)

### 8.3 Tier 2: the compare loop (D28, D29)
1. **Run v2** on a subset: `/conductor completeness-check` with, e.g., `{"reviewFiles": ["cc-1","cc-21"], "runs": 1, "commentNumberingMap": "pape-dawson-comment-num-mapping.tsv", "setCurrent": false}` on sv `6b9b85ed`, with the guides pinned to tree `e8df1601` (D28). Both baselines ran at `runs=1`, so `runs=1` is the like-for-like setting and neither side produces `uncertain` (Q9d). The `runs=3` run in §8.4 #3 exercises the uncertain path and is not compared.
2. **Compare** (deterministic, no tokens): the `cc-compare` runbook's `1.2-compare` step runs `compare.ts --v2 <run dir or persisted prefix> --legacy 41a49412,196de05b --key <answer-key.json>`. It reads the guide list from v2's `resolved.json` and filters A and B to those guides. It reads A's and B's statuses from `review_comments` (Q9b): one row per item, keyed by `output_json.sourceFindings[0].ref` (`"<guide>:<itemId>"`, e.g. `cc-5:ADR-05`), with the final status in `output_json.status`. It then puts each `guide:itemId` into exactly one bucket: `agree` (all three equal), `keyed` (disagreement with a verdict in the key, so v2 is scored against it), `unresolved` (disagreement with no verdict), `guide-drift` (the guide's text changed since A and B ran) or `forced` (v2 forced the item, so it is not scored, D29).
3. **Adjudicate** only `unresolved`: `cc-compare`'s `2.1-adjudicate` fans out one Opus cell per guide with unresolved items (foreach over `unresolved-guides.txt`; an empty roster is the common case once the key is warm). Each cell reads the guide rows, the three findings under shuffled labels, v2's `1.2-stage-submission`, and the vision and search CLIs. It writes `verdicts.json`: `{ref, status, evidence, right: [X|Y|Z], cause}`.
4. **Scorecard** (`3.1-scorecard`, script): it un-shuffles the labels and merges the new verdicts into `answer-key.next.json`. The captain commits that file over the key after Will has looked at it. It then writes `scorecard.json` + `scorecard.md`, per guide: agree / v2-right / v2-wrong / B-wrong / A-wrong, plus the cause tags on every item where v2 is wrong. Each v2-wrong item links to that cell's `tool-usage.json` (D21), so "why" is one click away.

`cc-compare` is a separate four-step runbook (`1.1-inputs` → `1.2-compare` → `2.1-adjudicate` → `3.1-scorecard`) so the eval never touches the CC graph and can be re-run against any persisted v2 prefix.

### 8.4 Acceptance bar (port done)
1. **Correctness against the key.** Across the loops, every one of the 14 guides has been scored at least once on its latest guide text. Over all scored items, v2's wrong count is **≤ B's wrong count**, and every item where only v2 is wrong carries a cause tag. v2 doing better is acceptable; the cause tags and tool-usage reports must say why.
2. **Forced outcomes exercised.** At least one loop includes cc-3, cc-5, cc-13 or cc-24 with `forceOutcomes: "1700-s-lamar-forced-outcomes.tsv"`, and `forced-outcomes-receipt.json` shows rows applied. The baselines forced nothing, so those items land in `forced` and are excluded from criterion 1. Run this loop separately from the scoring loop for the same guides.
3. **Uncertain path.** One v2 run at `runs=3` yields ≥1 uncertain item, exercising `2.4–2.6` end to end. If none appears naturally, raise `uncertainThreshold`.
4. **Publish** with `setCurrent: false`: a `reviews` row with `output_schema = 2026-03-completeness-check`, `is_current = false`, the prior current row untouched, and the comments rendering in the app by review id.
5. **Persistence:** `persisted.json` lists every run-produced file plus the D27 logs, the prefix is complete, and `1.2` / `1.3` are absent.
6. **Tier 1 self-replay** is green.

**Fixture:** 1700 S Lamar (Lamar + Collier) v4, project `23301a8a-4cdb-4751-ac0c-93b97f0f5c12`, sv `6b9b85ed-e992-4906-a222-b24ee836910c`, PPv4 run `b918e8c1`, with baselines A and B (D28). (v1's secondary fixture, 2008 San Antonio, is dropped because it has no named legacy baseline.)

### 8.5 Unit tests
- **conductor2:** persist config parsing (including `logs:`), glob filtering, dedupe, and the never-fail path, against the existing mock server (`substation_client.rs:409-454`).
- **cityhall-new:** route validation, the 200 cap, `too_large`, admission.
- **bureau:** lane B `--no-set-current` / `--prior-review-id` in `test_publish_review_cli.py`; `1.4-resolve` (CURRENT_VERSION, mismatch hard-fail, reviewFiles filter, runs roster); the `2.2` grouping injection; the D22 table-only id parser (every prefix, prose mentions ignored); `2.11-tool-usage` over a recorded stream with an off-list Bash call and an out-of-scope read; `compare.ts` (lazy agreement, subset filtering, answer-key lookup, guide drift, the `forced` bucket, `sourceFindings[0].ref` keying).

## 9. Delivery order

1. **cityhall-new:** `step-files` route + tests, plus the migration creating the private `runbook-runs` bucket (size limit + lifecycle rule).
2. **conductor2:** `persist:` (including `logs:`, D27) + uploader. Inert until a runbook opts in, and harmless before step 1 deploys (404 → one warning).
3. **bureau:** the runbook (with `2.11-tool-usage`), the vision CLI, lane B flags, the Tier 0 / 1 tests, and the `cc-compare` runbook (`compare.ts`, adjudicate prompt, scorecard, an empty `answer-key.json`).
4. **Compare loops (§8.3)** until the acceptance bar (§8.4) holds, curating `examples/lamar-v4-cc1-cc21` from the first green subset run.

## 10. Follow-ups (out of scope)

- **Run-health audit → conditional publish gate.** A deterministic `2.12-health` step scores the run from `2.11-tool-usage` and the run's own files: failed or `FAILED.md` cells, null-explanation share, vision/search error rates, `off_list` / `out_of_scope` tool use, item-coverage resumes, `too_large` uploads. Only when it flags something does a `runner: none` `2.13-deliver` gate ask in the console whether to publish. Otherwise its contract passes vacuously and no question is created.
- **Resume from Storage:** `conductor hydrate <runbook_run_id> $RUN` rebuilds a run dir from `persisted.json` and re-stages `1.2` / `1.3` from the DB, then `advance` continues. This is the cloud payoff of D13–D26.
- **Cloud lane** (`trigger-cloud-runbook`), then retiring legacy CC and moving its scripts into the runbook.
- **Post-parity experiments:** drop `facts.md`, native image reading instead of the Gemini `vision` CLI, Opus for `review`.

## 11. Open questions

- **Q1 AGENTS-core rule 19 vs `facts.md` (D24). RESOLVED → D31.** The CC prompt overrides rule 19 for `facts.md`. The 21-rule preamble stays as a known difference from legacy, and the compare loop's cause tags surface its effects.
- **Q2 Bucket and size limit. RESOLVED:** a dedicated private `runbook-runs` bucket with its own size limit and lifecycle rule (D18).
- **Q3 Vision CLI credentials on the local lane. RESOLVED from code.** The sheet fetch uses the `app_client` order: the run token first, then service-role as a local fallback (`runbooks/lib/app_client.py:137-152`). The gateway call needs `AI_GATEWAY_API_KEY`, which is not one of the variables conductor2's subscription guard refuses (`conductor2/src/harness.rs:218-230`). Legacy tags gateway calls with `WORKFLOW_RUN_ID` / `RUN_LABEL` (`conductor/src/shared/gateway-metadata.ts:21-22`). The CLI tags them with the `runbook_run_id` and the node name.
- **Q4 Effort level. FOLDED INTO Q9.** Legacy passes `effort` only when the run sets it (`conductor/src/agent/runner.ts:299`). The presets match whatever baselines A and B ran with.
- **Q5 Harness system prompt. RESOLVED:** accept the Claude Code CLI's default. It is part of the migration, and tool-usage reports (D21) plus cause tags (D29) explain any difference.
- **Q6 `1.1-inputs` with no question. RESOLVED from code.** Only open gates are reported (`conductor2/src/callback.rs:425`), so a `runner: none` step whose contract already passes opens no `runbook_hitl_questions` row.
- **Q7 Inch-mark JSON. RESOLVED (default):** no tolerant-parse repair. A malformed `findings.json` resumes the session with the parse error, and `2.11-tool-usage` counts resumes per cell. Revisit only if cells exhaust `MAX_RETRIES` on parse errors.
- **Q8 Legacy-trail readers.** IG reads `workflow_runs` / the `workflow-runs` bucket. It needs a v2 path (the `runbook_runs` id + persisted prefix, including the D27 logs and D21 `tool-usage.json`) before legacy retires. v2 also asks whether anything reads `review_comments.agent_trace` (the column, not `output_json`), which v2 no longer writes (D30). The `audit-cc-run` skill is out of scope (Will, 2026-10-02): it may go stale and is not updated for v2.
- **Q9 Baseline facts `compare.ts` depends on. RESOLVED from the DB (2026-10-02, §11.1).** (a) Both baselines are on sv `6b9b85ed` (Will, confirmed by the rows). (b) Yes: every item is a row, including passes and N/As, and the counts match the guides exactly (192 per review). `compare.ts` reads `review_comments`. (c) Both used `v2.7-trimmed`. They ran at different bureau commits (`481bacac` and `8325169b`), but the guide tree is identical at both, so there is no drift between A and B (D28, D29). (d) `runs=1` for both, so the loop runs at `runs=1` (§8.3). (e) `effort` is unset for both, so the presets leave it unset (D6). (also) `forceOutcomes` was unset and `uncertainThreshold` was the default, and the baselines also passed `commentNumberingMap` and `priorReviewId`. Forced items are therefore unscored (D29).
- **Q10 The judging agent vs rule 19. RESOLVED → D31.** `2.1-adjudicate` must read prior Noetic output (the legacy reviews), so its prompt overrides rule 19 the same way as Q1.

### 11.1 Q9 answers (DB reads, 2026-10-02)

Project: Noetic App (`mgxqsrjutswbciyrltwd`). Read only. **A** = `41a49412-a422-485f-8f6c-16e28df94a4c` (Opus 5), **B** = `196de05b-3d19-4e83-8fd7-6e4a4dfc5c3c` (Sonnet 5.5). Each item below was answered for A and B separately. The queries are kept so the answers can be re-checked.

```sql
-- 0. The rows, their run, and the metadata the answers come from
select r.id, r.submission_version_id, r.output_schema, r.workflow_run_id, r.created_at,
       r.metadata->>'checklistVersion' as checklist_version,
       r.metadata->>'bureauCommitHash'  as bureau_commit,
       r.metadata->>'runLabel'          as run_label,
       wr.workflow_version,
       wr.inputs->>'runs' as runs, wr.inputs->>'effort' as effort, wr.inputs->>'model' as model,
       wr.inputs->>'checklistsDir' as checklists_dir, wr.inputs->>'reviewFiles' as review_files,
       wr.inputs->>'forceOutcomes' as force_outcomes, wr.inputs->>'uncertainThreshold' as uncertain_threshold,
       wr.outputs_path
from reviews r left join workflow_runs wr on wr.id = r.workflow_run_id
where r.id in ('41a49412-a422-485f-8f6c-16e28df94a4c','196de05b-3d19-4e83-8fd7-6e4a4dfc5c3c');

-- (b) Is every item a comment row? Status mix per review.
select review_id, output_json->>'status' as status, count(*)
from review_comments
where review_id in ('41a49412-a422-485f-8f6c-16e28df94a4c','196de05b-3d19-4e83-8fd7-6e4a4dfc5c3c')
group by 1,2 order by 1,2;
-- If metadata.keys don't include the names above: select jsonb_object_keys(metadata) from reviews where id = '…';
-- and select jsonb_object_keys(output_json) from review_comments where review_id = '…' limit 50;

-- (b') Item ref + completeness per guide (no checklistItemId key; the ref is sourceFindings[].ref)
select review_id, split_part(f->>'ref', ':', 1) as guide, count(*) as refs, count(distinct f->>'ref') as distinct_refs,
       max(jsonb_array_length(output_json->'sourceFindings')) as max_refs_per_row
from review_comments, jsonb_array_elements(output_json->'sourceFindings') f
where review_id in ('41a49412-a422-485f-8f6c-16e28df94a4c','196de05b-3d19-4e83-8fd7-6e4a4dfc5c3c')
group by 1,2;
```

```bash
# (c') Guide text at the two commits (bureau repo)
git diff --stat 481bacac 8325169b -- jurisdictions/austin/completeness-check/v2.7-trimmed   # empty
git rev-parse 8325169b:jurisdictions/austin/completeness-check/v2.7-trimmed                 # e8df1601…
```

| Item | A (Opus 5, `41a49412`) | B (Sonnet 5.5, `196de05b`) | Decided |
|---|---|---|---|
| run | workflow_run `44fa806d`, legacy `1.4.0`, created 2026-10-01 15:18Z, label `2026_10_01_cc_v4_opus5`, outputs `workflow-runs/completeness-check/23301a8a…/2026-10-01-101731` | workflow_run `65994a64`, legacy `1.4.0`, created 2026-10-01 11:18Z, label `2026_09_28_cc_v4_winston`, outputs `…/2026-10-01-061823` | Both are `output_schema = 2026-03-completeness-check` on sv `6b9b85ed`. |
| (b) passes stored | 192 rows: pass 102, N/A 64, fail 21, warn 5, uncertain 0 | 192 rows: pass 104, N/A 64, fail 17, warn 7, uncertain 0 | **Yes.** The per-guide distinct refs equal the table counts for all 14 guides, with exactly one ref per row and no duplicates. The item ref is `output_json.sourceFindings[0].ref` = `"<guide>:<itemId>"`. There is no top-level `checklistItemId`, and `section` is a slug of the guide's area. `compare.ts` reads `review_comments` (§8.3). |
| (c) guide version + commit | `v2.7-trimmed`, bureau `8325169b` (2026-10-01), `checklistsDir` `jurisdictions/austin/completeness-check/v2.7-trimmed`, `reviewFiles` null (all 14) | `v2.7-trimmed`, bureau `481bacac` (2026-09-30), same dir, `reviewFiles` null | The commits differ, but `481bacac` is an ancestor of `8325169b` and the guide dir is unchanged between them (tree `e8df1601`). There is no A↔B drift. The loop pins to that tree (D28, D29). |
| (d) runs | 1 | 1 | The loop runs at `runs=1`, and no `uncertain` appears on either side (§8.3). |
| (e) effort / model | effort null, `claude-opus-5` | effort null, `claude-sonnet-5-5` | The presets leave effort unset (D6). |
| (also) | `forceOutcomes` null (no forced rows), `uncertainThreshold` null (0.35 default), `commentNumberingMap` `pape-dawson-comment-num-mapping.tsv`, `priorReviewId` `54d5c002`, `setCurrent` false, `maxWorkers` 20 | same | The loop request passes the same `commentNumberingMap`. Forced items are bucketed `forced` and not scored (D29). |
| (raw trees) | `output/runs/run-1/findings/cc-N.md.json` ×14, `enriched-findings.json`, `review-comments.json`, `logs/` all present | same layout present | The optional cross-lane replay is still possible (§8.2). |
| (Q8 aside) | `agent_trace` column populated on 192/192 rows (`tools_used`, `vision`, `semantic_search`) | same | A v2 review will be the first CC review with that column empty (D30). This is a fact for Q8's reader audit, not an answer to it. |
