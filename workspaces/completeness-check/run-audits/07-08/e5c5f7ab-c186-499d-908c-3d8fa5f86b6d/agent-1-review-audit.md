# Review Step Audit — CC run e5c5f7ab (2026_07_08_run_2_vision_exp)

**Scope**: `review` step (agent fan-out), 14 groupings × 5 runs = 70 cells, model claude-haiku-4-5-20251001, maxWorkers=35, experiment=vision-check, checklist v2.7-trimmed (194 items).
**RUN_DIR**: `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/cc-run-output`

**Verdict: HEALTHY WITH NOTES**

---

## Step purpose

For each (grouping × runIndex) cell, an agent reads the grouping guide from bureau `v2.7-trimmed`, gathers evidence from pre-processed site-plan data plus the experimental `vision_check` tool (classifier-routed to `generic-vision` or `inspect-drawing`) and `semantic-search-blocks`, then emits one finding per checklist row via StructuredOutput against `workflow/schemas/completeness.emit.schema.json`. Downstream, cross-run consolidation majority-votes the 5 runs per item.

---

## What happened (evidence)

### Completion & reliability

- **70/70 cells `done`** (`workflow/run-log.json`, review step items; all `status: "done"`). `agent.started` = `agent.completed` = 70 for `step:"review"` in `logs/completeness-check.log`.
- **Zero structured-output failures**: `error_max_structured_output_retries` = 0, `coercion` = 0, no repair strategies fired. All 70 cells emitted a clean lenient envelope; conductor logged exactly 70 × `agent.structured_output.normalized` ("Canonicalized lenient structured output into {grouping, findings} envelope"). No agent crashes, no turn-limit hits (`max_turns` grep = 0).
- **Error log** (`logs/completeness-check-error.log`, 42 lines): every level-50 line is a `vision_check` tool failure (`category:"tool_failure"`), none fatal to a cell.

### Timing

| metric | value |
|---|---|
| min / p50 / p90 / max per cell | 145s / 1,057s / 2,340s / 3,499s |
| mean | 1,173s |
| step wall-clock | 58.3 min (15:20:49 → 16:19:09) |
| total agent-time | ~1,369 min (~22.8 h); 35-worker utilization ≈ 67% |

The wall-clock is set by a single cell: **cc-13 run-2 (index 26) ran 3,499s ≈ the entire 58-min step**, started 15:20:50 in the first wave. It is the largest grouping (37 items) and made **36 vision_check calls** — the most of any cell. Second wave of cells started as workers freed (last start 15:49:14). Fastest cells: cc-20 (6 items) at 145–150s.

### Coverage (emitted IDs vs checklist tables)

Checklist source verified against `/Users/wnavey/noetic/bureau/jurisdictions/austin/completeness-check/v2.7-trimmed`: cc-1:33, cc-2:6, cc-3:11, cc-5:14, cc-6:3, cc-10:4, cc-13:37 (incl. AW-38a/AW-38b), cc-15:14, cc-19:22, cc-20:6, cc-21:10, cc-22:14, cc-23:11, cc-24:9 = **194**.

- **69 of 70 cells emitted exactly their grouping's ID set** — no missing, no extra, no duplicate IDs, all in bare form (`CC-22-12`, `AW-01`). Zero grouping-prefix fragmentation.
- **The one exception — cc-2 run-2** (`output/runs/run-2/findings/cc-2.md.json`): emitted 5 findings (CC-2-02, CC-2-14, CC-2-16, CC-2-21, CC-2-23), **missing CC-2-24** ("Underground utility lines … not shown", Fail Status `warn`, `v2.7-trimmed/cc-2.md:41`). Its `summary` **misreports coverage**: "5 of 5 items pass" — the agent genuinely believed the grouping had 5 items (see root cause).
- Status distribution across all 969 emitted findings: pass 525, not-applicable 336, fail 91, warn 17.
- No other cell's summary misreports its item count.

### The missing vote: cc-2 run-2 root cause (wrong checklist VERSION, not a skip)

Transcript evidence from `logs/completeness-check.log` (`item:"cc-2.md"`, `runIndex:"run-2"`, index 23):

1. The prompt hands the agent a **bureau-relative** grouping path (overlay `workflow/experiments/vision-check/review.md:6`: `{{ input.checklistsDir }}/{{ checklistItem }}` → `jurisdictions/austin/completeness-check/v2.7-trimmed/cc-2.md`).
2. The agent's first Read resolved it against the sandbox cwd: `/vercel/sandbox/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-2.md` → not found. (**Run-wide, 73 Read attempts used this wrong root** across cells; nearly all recovered to the correct `/vercel/sandbox/workspace/bureau/...` path.)
3. This cell instead ran `find /vercel/sandbox -name "cc-2.md" ...` and opened **`/vercel/sandbox/workspace/bureau/jurisdictions/austin/completeness-check/v2-trimmed/cc-2.md`** — the **v2-trimmed** file, which contains exactly 5 items (CC-2-02/14/16/21/23; no CC-2-24, no Fail Status column — verified against bureau `v2-trimmed/cc-2.md`).
4. It evaluated that stale table faithfully — 5/5 items, IDs overlapping v2.7 — so the error surfaced only as one missing vote. The string "CC-2-24" appears **zero** times in the cell's transcript.

One other cell misfired similarly (Read of non-existent `.../completeness-check/v2.7/cc-15.md`) but recovered to the correct file.

Downstream safety net worked: consolidation recorded the gap explicitly — `output/consolidation-summary.json` `voteMissingDistribution: {"0":193,"1":1}`; `consolidated-findings.json` CC-2-24 = pass with votes `{pass:4, missing:1}`.

### ID contract (charge 1)

- **Effective prompt** (`workflow/experiments/vision-check/review.md`): line 16 mandates bare IDs for `vision_check.checklistItemId` — "the item ID exactly as it appears in your grouping file's checklist table (e.g., `CC-22-12`, `AW-01`) — the same bare form you use for `checklistItemId` in your emitted findings. Do NOT prefix it with the grouping." Line 169 (findings): "The ID from the checklist table (e.g., 'FP-01')". **One format, everywhere. No contradiction.**
- **Why this run is clean**: the 07-07 fragmentation bug was this exact line. Diff vs the 07-07 run's overlay (`/Users/wnavey/noetic/cc-audit/50a1a78d-4517-4c00-82d8-593179cb20a5/cc-run-output/workflow/experiments/vision-check/review.md:16`) shows the **only change** between the two overlays: 07-07 said "Use the form `<grouping>:<item-id>` (e.g., `cc-22:CC-22-12`)" for vision calls, which bled into emitted findings. The fix held: all 279 vision_check calls this run used bare IDs (verified from `output/runs/run-*/vision-check-calls/*/metadata.json` inputs), and all 70 cells emitted bare IDs.
- **Schema**: `workflow/schemas/completeness.emit.schema.json:12-15` — `checklistItemId` is `type: string` with a description only. **No `pattern` constraint**; a prefixed ID would validate fine. The prompt is the only line of defense at emit time.
- **Canonicalization**: `conductor/src/agent/structured-output-repair.ts` (`normalizeStructuredOutput`; grouping derivation at lines 131-136, envelope repair/injection at lines 181-203). It fixes the *envelope* (injects `grouping` from the filename, unwraps nesting) but **nothing in conductor validates `checklistItemId` against the grouping's checklist table**. The only detection of a bad/missing item ID is cross-run consolidation's vote accounting (`workflow/scripts/cross-run-consolidate-cc.ts` → `voteMissingDistribution`), i.e., one full pipeline stage later.

### Vision tooling (charge 4)

279 `vision_check` invocations, 52/70 cells used the tool. Per-run: run-1 46, **run-2 100**, run-3 50, run-4 32, run-5 51. Per-call artifacts complete: 279 `metadata.json` dirs under `output/runs/run-*/vision-check-calls/` with inputs, classifier output (+ prompt sha256), and dispatch outcome.

| dispatch | count | success | failed |
|---|---|---|---|
| `inspect-drawing` (problemType `drawing_inspect`) | 155 | **155** | 0 |
| `generic-vision` (problemType `generic`) | 124 | 82 | **42 (34%)** |
| total | 279 | 237 | 42 (15%) |

- Classifier: median confidence 0.95, min 0.72, `fallbackUsed:false` on all 279. Only generic/drawing_inspect produced (measure-distance not enabled, never routed).
- **No empty `--sheetNum`** on any of the 155 inspect-drawing subprocess invocations (0 matches for `--sheetNum=''`); no subprocess exit failures.
- **Failure breakdown (all 42 on the generic-vision path)**: 30 × "Failed to download sheet thumbnail: fetch failed"; 6 × DB fetch failed (`plan_set_version` / `document_version`); 1 × signed-URL fetch failed; 2 × no-version-found — one of which (cc-20 run-5, `logs` time 1783525834938) was **agent error**: it passed plan_set_id `777f2782-…` as `documentId`; 4 × gateway errors (3 × `GatewayInternalServerError` after 3 attempts, 1 non-retryable `GatewayResponseError`). ~20 of the fetch failures land in a single burst at 15:52:07Z — a sandbox-wide network blip hitting storage and DB simultaneously.
- **Graceful fallback**: yes at the mechanical level — every failure returned a completed tool call (`vision_check.completed` with `success:false`); no cell crashed or lost its emission. 9/42 failures were followed by a later successful call for the same (run, item); 33 were not retried.
- **Finding degradation**: for the 33 unrecovered failures, the affected item's status matched at least one other run in 32 cases. The single divergence: **run-4 CC-3-17 = fail vs pass in all four other runs**, immediately downstream of a thumbnail-fetch failure — outvoted 4-1 in consolidation (final: pass). Net output impact of all 42 failures ≈ zero, thanks to 5-run redundancy.
- **Silent at the finding level**: 0 of 969 findings mention a tool failure in observation/reasoning/explanation. Degraded evidence is invisible unless you read the log.

### Overlay drift (charge 5)

Diff of `workflow/experiments/vision-check/review.md` (ran) vs stock `workflow/prompts/review.md`:

1. **Intended change** — vision section replaced (stock lines 9-17 "Using the Vision Tool" → overlay lines 9-23 `vision_check` with required params, confidence branching). Fine.
2. **Dropped machinery — the whole warn / Fail Status system**:
   - Stock checklist-table description includes the **Fail Status column** (stock line 67); overlay says the table "has four columns" and omits it (overlay lines 69-73).
   - Stock Step 4 defines **`warn`** and its gating rules incl. "Emitting warn for an item whose Fail Status is fail or absent is an error" (stock lines 115-122); overlay Step 4 lists only pass/fail/not-applicable (overlay lines 119-123).
   - Stock status field: `"pass", "fail", "warn", "not-applicable"` (stock line 174); overlay: `"pass", "fail", "not-applicable"` (overlay line 173). Stock's warn-aware `resolution` guidance (line 176) also dropped (overlay line 175).
   - The overlay is a fork of the **pre-v2.6 stock prompt** — it predates the warn-first-class change and was never rebased.
3. **Observed cost**: the emit schema still allows warn (`completeness.emit.schema.json:29-33`) and the grouping files carry Fail Status columns (cc-1, cc-2, cc-5, cc-13, cc-21, cc-24), so agents behaved inconsistently — 17 warns emitted (16 legal by item policy; **1 illegal: CC-1-34 run-3, Fail Status=fail**), while **12 pre-vote clamp events were fail→warn on advisory items** (CC-24-04/13/15/16, CC-1-32 — `output/consolidation-summary.json.preVoteClampEvents`, 13 events total): agents defaulted to `fail` on warn-only items because the prompt never told them warn existed. The `checklist-policy.ts` clamp (lines 205-209) corrected all of it pre-vote, but the two cc-21 `fail-or-warn` items split votes (CC-21-01: 1 pass/2 fail/2 warn; CC-21-04: 3 fail/2 warn) and **both consolidated to `uncertain`** — 2 of the run's 19 uncertain items are plausibly overlay-drift artifacts.
4. No contradictory ID instructions this time (the 07-07 failure signature) — see ID contract above.

### Provenance drift note

`output/review-comments.json` stamps `bureauCommit: c29a96ea…`, but the log shows it is **inherited from the prior review** ("Bureau commit from prior review", time 1783524025138) and bureau git proves that commit **predates the creation of v2.7-trimmed** (`2cc7ba4e6 Add v2.7-trimmed` lies in `c29a96ea..HEAD`). The stamp cannot describe the content this run actually read. Actual content is verifiable indirectly: all 969 emitted IDs match local bureau HEAD (`148418db`) v2.7-trimmed tables exactly, and `git diff c29a96ea..HEAD -- v2.7-trimmed/cc-*.md` is pure file-addition, so no material drift between run content and current local checkout.

---

## Root-cause analysis

1. **cc-2 run-2 missing vote (CC-2-24)** — not a lazy skip: the prompt injects a *bureau-relative* grouping path (overlay line 6); the agent's cwd-resolved Read failed, it recovered via `find`, and picked the stale sibling **v2-trimmed** version of cc-2.md (5 items). It then did exactly what it was told with the wrong table, and its "5 of 5" summary is internally honest. Two enabling conditions: (a) relative path injection (73 wrong-root reads run-wide show this is systemic), (b) stale checklist versions present and discoverable in the sandbox bureau checkout.
2. **Zero ID fragmentation** — direct result of the one-line overlay fix after the 07-07 audit (bare-ID mandate, aligned across tool calls and emissions). Not luck: 279/279 tool calls and 70/70 emissions conformed with no schema pattern or runner validation enforcing it.
3. **Vision generic-path failure rate (34%)** — infrastructure (storage/DB fetch flakiness in the sandbox, one 15:52:07Z network blip ≈ half of all failures) plus gateway 5xx; the inspect-drawing subprocess path was flawless. 5-run majority voting absorbed effectively all of it.
4. **warn inconsistency** — stale overlay fork missing the v2.6 warn machinery; masked by the pre-vote clamp but it manufactured fail/warn vote splits on fail-or-warn items → 2 uncertains.

---

## What went right

- 70/70 cells completed; zero structured-output retries/coercions (the lenient emit schema + envelope canonicalization did its job — 70 clean normalizations, vs 37 retry-storm failures in the 5-01 debug era).
- ID contract clean end-to-end: 969/969 bare IDs, 0 fragmentation — the 07-07 overlay fix verified effective.
- Coverage 193/194 item-ID sets perfect across 69 cells; the one gap was caught and labeled by consolidation (`missing:1`) rather than silently absorbed.
- inspect-drawing specialist: 155/155 success, correct `--sheetNum` on every call; classifier never fell back, median confidence 0.95.
- Vision failures degraded nothing that survived consolidation (single 4-1 outvote); per-call artifacts are excellent forensic material (classifier prompt sha, inputs, dispatch outcome per call).
- Policy clamp caught all 13 Fail Status violations pre-vote, including the illegal warn.

## What went wrong

- **cc-2 run-2 evaluated the wrong checklist version** (v2-trimmed) after a relative-path miss — the run's only missing vote, and its summary self-reports full coverage.
- **73 wrong-root grouping-file reads** across the run — wasted turns and a live foot-gun (this is what sent one agent version-hunting).
- **Overlay prompt is a stale fork**: all warn/Fail Status machinery missing → 12 fail-on-advisory emissions needing clamps, 1 illegal warn, and fail/warn splits that pushed CC-21-01/CC-21-04 to `uncertain`.
- **42 vision failures (34% of the generic path)**, silent at the finding level; one degraded vote (run-4 CC-3-17).
- **bureauCommit provenance stamp is wrong by construction** (inherited from prior review, predates the checklist version it claims to describe).

---

## Observability gaps & remediations

1. **No emit-time coverage validation.** The runner never diffs emitted `checklistItemId`s against the grouping table; a wrong-version read is invisible until consolidation. Add a set-difference check (warn or one retry) where the envelope is canonicalized — `conductor/src/agent/structured-output-repair.ts` / `conductor/src/agent/runner.ts`; the parser already exists in bureau `workflows/completeness-check/scripts/checklist-policy.ts`.
2. **No `pattern` on `checklistItemId`.** Add e.g. `"pattern": "^[A-Za-z]+-\\d+[a-z]?(-\\d+[a-z]?)?$"` to `bureau/workflows/completeness-check/schemas/completeness.emit.schema.json` so prefixed IDs fail mechanically instead of prompt-only (07-07 would have been caught at emit).
3. **Grouping path injected as bureau-relative** (`prompts/review.md:6` and `experiments/vision-check/review.md:6` in bureau `workflows/completeness-check/`). Inject the absolute sandbox path; optionally provision only the requested checklist version so `find` can't land on stale siblings.
4. **Overlay fork drift.** Rebase `bureau/workflows/completeness-check/experiments/vision-check/review.md` onto the current stock prompt (it only needs to replace the vision section); consider generating overlays as section patches rather than full-file forks so stock changes (warn machinery) propagate.
5. **Vision failures invisible in findings.** Surface `success:false` vision_check results into the finding (e.g., a `degradedEvidence` flag or a required mention in `observation`), and include `checklistItemId` in the tool_failure error-log lines (currently only item/index/callId).
6. **Provenance stamp.** Record the actually checked-out bureau commit at provisioning time instead of copying the prior review's (`conductor` bureau setup; log msg "Bureau commit from prior review").

---

**Verdict: HEALTHY WITH NOTES** — all 70 cells completed with clean structured output and near-perfect coverage; the single missing vote traces to a wrong-checklist-version read enabled by relative path injection; vision experiment mechanics worked (routing, artifacts, inspect-drawing 100%) despite a 34% infra-failure rate on the generic path; overlay prompt drift (missing warn machinery) is the main content-quality debt, costing ~2 uncertain items.
