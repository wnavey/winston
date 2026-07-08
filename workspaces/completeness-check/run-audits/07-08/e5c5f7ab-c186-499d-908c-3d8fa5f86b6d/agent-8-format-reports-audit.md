# Agent 8 — `format-reports` Step Audit

Review `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` · runLabel `2026_07_08_run_2_vision_exp` · 2026-07-08 · checklist v2.7-trimmed (194 items / 14 groupings) · runs=5
RUN_DIR: `/Users/wnavey/noetic/cc-audit/e5c5f7ab-c186-499d-908c-3d8fa5f86b6d/cc-run-output`

**Verdict: HEALTHY WITH NOTES**

---

## 1. Step purpose

Per `RUN_DIR/workflow/prompts/format-reports.md`, a single agent cell (no output schema) reads `output/enriched-findings.json` and produces three artifacts:

1. **Consolidated report** — `output/completeness-check-consolidated-report.md` (overview table, headline metrics, per-grouping breakdown, full Results tables with N/A omitted). Spec at prompt lines 84–122.
2. **Detailed reports** — `output/reports/[grouping-id].md`, one per grouping, ALL items included (incl. not-applicable), with an uncertain-consensus blockquote callout built from `tentativeStatus` + `voteBreakdown` (prompt lines 125–159).
3. **`output/rephrased-items.json`** — composite-keyed (`{grouping}:{itemId}`) map of item → title, consumed by the downstream `build-review-comments` script (prompt lines 162–181; line 168 explicitly forbids bare-ID keys as a collision hazard).

Display-status rule (prompt line 15): render **`consolidatedStatus ?? status`**; vocabulary `pass|fail|warn|uncertain|not-applicable`. Titles: **prefer the authored TSV** `bureau/{checklistsDir}/cc-item-title-mappings.tsv`, used **verbatim** (prompt lines 30–43); only rephrase per the fallback rules if an ID is missing.

Model: **`claude-sonnet-5`** (`RUN_DIR/workflow/workflow.yaml` line 279) — intentionally stronger than the review model (claude-haiku-4-5). Confirmed at runtime in the log: `"Running single agent" … "model": "claude-sonnet-5", "hasSchema": false`.

## 2. What happened (evidence)

Timeline from `RUN_DIR/workflow/run-log.json` (step index 7): started `2026-07-08T16:22:23.680Z`, ended `16:25:19.238Z`, status `completed` (~2m56s). Agent-level `result` event in `RUN_DIR/logs/completeness-check.log`: `num_turns: 20`, `duration_ms: 174860`, `is_error: false`, output tokens 16,003, cache-read ~924K. **Zero retries, zero structured-output issues** (no schema on this step).

Trace highlights (all from `logs/completeness-check.log`, `step:"format-reports"` lines):

- Turn 1: `Read output/enriched-findings.json` → benign error, "File content (380.5KB) exceeds maximum allowed size (256KB)"; agent pivoted to Bash/python3. A `jq` attempt also failed (`jq: command not found` — not installed in the sandbox); pivoted to python3. Both recovered cleanly.
- Found and read the authored TSV at `bureau/jurisdictions/austin/completeness-check/v2.7-trimmed/cc-item-title-mappings.tsv` — **195 lines = header + 194 authored titles**.
- **Self-verified coverage before writing**: cross-joined findings × TSV: `"total findings: 194 / tsv rows: 194 / missing from tsv: [] / dupes: []"`.
- Rather than hand-transcribing 194 items, the agent **wrote a deterministic generator script** (`Write /vercel/sandbox/workspace/generate_reports.py`) and ran it: `"Total groupings: 14 / Total findings: 194 / Total evaluated (non-NA): 129 / Pass/Fail/Warn/Uncertain: 99 7 4 19"` — exactly matching the pre-scan consolidated tallies (99/65/4/7/19 = 194). This eliminates LLM transcription drift across a 194-item render.
- Post-write self-checks: re-read the consolidated report, spot-read `cc-3.md`, `cc-19.md`, tail of `cc-24.md`, counted rephrased-items entries (194), then emitted a detailed final result message (see §4).

### Output verification (independent, this audit)

- **Consolidated report** (`output/completeness-check-consolidated-report.md`): headline "Total items evaluated: 129" (= 194 − 65 N/A ✓). Per-grouping table (lines 27–40) sums: evaluated 129, failures 7, uncertain 19 — all reconcile with enriched-findings. Overview markers correct per spec (fail→✗ for cc-1/cc-22/cc-23; uncertain→? for 7 groupings; ✓ otherwise; warn correctly does not demote a grouping, e.g. Land Development shows `?` from its 3 uncertains, line 20).
- **Results tables**: 129 rows total; 65 N/A items omitted per spec; markers ✓/✗/⚠/? all consistent with display statuses (e.g. Transportation Core, lines 207–219: 4 ✗ + 4 ? + 3 ✓ = 11 evaluated ✓). No raw checklist IDs leak into the consolidated report (spec shows title-only rows).
- **Detailed reports** (`output/reports/cc-*.md`, 14 files): 194 `###` item headings total; all 65 N/A items included per spec; **all 19 uncertain items carry the consensus callout** — e.g. `output/reports/cc-3.md` line 49: `> **Agent could not reach consensus.** Tentative verdict: **Fail** — 3 fail / 2 pass across runs. Please review manually.` — severity-ordered, non-zero buckets only, missing-clause correctly omitted (no `missing>0` in this dataset). Uncertain share is presented sanely: an Uncertain column in the per-grouping table, `?` markers, and per-item manual-review callouts; 19/129 evaluated ≈ 14.7% is visible at a glance from the headline metrics line 23.
- **`output/rephrased-items.json`**: **194 entries, 100% composite keys** (`cc-10:AE-01`, `cc-13:AW-01`, …), **zero bare keys, zero bare-ID repeats across groupings** (v2.7-trimmed item IDs are grouping-scoped, so even the bare-ID hazard is latent, not live — but the composite keying removes it regardless). Coverage: exactly matches the 194 enriched findings; no garbled entries; all 129 non-N/A titles appear verbatim in the consolidated report (the 65 absent ones are all N/A, per spec). Titles identical across JSON and both markdown surfaces, as the prompt requires.

## 3. What went right

1. **Exact count fidelity**: 194 items rendered, 129 evaluated, statuses 99/7/4/19/65 — matches the checklist manifest and pre-scan exactly. Zero duplicates, zero missing.
2. **Composite keying done correctly** — the known collision-hazard join into `build-review-comments` is safe: TSV composite IDs used verbatim, no stripping.
3. **Deterministic generation strategy**: the agent scripted the render instead of free-handing 194 rows, then reconciled counts against the dataset's own totals before finishing. This is the right pattern for this step and materially de-risked it.
4. **TSV preference honored**: all 194 titles sourced verbatim from the authored TSV; the agent explicitly verified zero fallback rephrasing was needed and said so in its final message.
5. **Uncertain rendering to spec**: all 19 callouts present, vote breakdowns correct (spot-checked cc-3: CC-3-21 "3 fail / 2 pass" matches `voteBreakdown {pass:2, fail:3}`), tentative-winner explanation/evidence preserved below.
6. **Fast, clean execution**: 20 turns, ~175s, no retries, graceful recovery from the oversized-Read and missing-`jq` hiccups.

## 4. What went wrong

### 4a. Stale grouping summary blockquotes contradict their own tables (MODERATE — upstream data, faithfully propagated)

The `> [Summary line from findings data]` at the top of each detailed report is copied verbatim from `enriched-findings.json`'s per-grouping `summary` field, which reflects **pre-consolidation (single-run/tentative) counts**, not the display statuses. Several summaries now contradict the tables directly beneath them:

- `output/reports/cc-19.md` line 3: *"1 item (CC-19-02) **fails** due to missing explicit MSL notation…"* — but line 17 of the same file: `**Status:** Pass`. The consolidated report (line 35) agrees: Floodplain grouping has **0 failures**.
- `output/reports/cc-3.md` line 3: *"9 of 11 items pass, **1 fails**, 1 not-applicable. CC-3-23 fails…"* — the file's actual statuses are 6 Pass, **3 Uncertain, 0 Fail**, 2 Not Applicable (CC-3-23 is `Uncertain`, line 69).
- Same pattern in cc-5 ("3 fail" vs consolidated 0 fail / 2 uncertain), cc-10 ("1 fail" vs 0 fail / 1 uncertain), cc-21, cc-24.

The format-reports agent followed its prompt (line 136: "Summary line from findings data") — the defect is that **enrich-findings emits summaries that predate the cross-run vote**, and the prompt tells the formatter to trust them. Every grouping that had a fail demoted to uncertain by the majority vote now opens its human-facing report with a false claim. This is the single most misleading element of the deliverable.

### 4b. Headline metrics omit the 4 warn items (MINOR — prompt spec gap)

Consolidated report line 23: `**Passed:** 99 | **Failed:** 7 | **Uncertain:** 19` → sums to 125, not the "129 evaluated" on line 22. The 4 warns are invisible in the headline and in the per-grouping breakdown table (no Warn column), appearing only as ⚠ rows in the Results tables (e.g. lines 69, 154–155, 240). The prompt itself (line 108) asks only for "Total passed / total failed / total uncertain", so the agent complied — but a careful reader hits an arithmetic mismatch, and `warn` was recently promoted to first-class status (cc-warn work), so the report spec lags the status model.

### 4c. Titles are declarative statements, not questions (COSMETIC — prompt/TSV drift)

Prompt line 28 mandates titles "ending with a question mark", and every example/anti-pattern is a question — yet the authored TSV's 194 titles are all declarative ("Completed CC Application PDF is included in the submittal package"). The agent correctly applied the higher-priority verbatim rule (line 41), so this is authored intent winning over stale prompt copy, but the rephrasing-rules section of the prompt is now dead weight that would produce *stylistically different* titles if the TSV ever had a gap. The prompt's fallback rules should be re-synced to the TSV's declarative house style (or vice versa).

### 4d. Scratch file left in workspace (TRIVIAL)

`generate_reports.py` was written to the workspace root (not `output/`), harmless but uncollected.

## 5. Observability gaps & remediations

1. **Pre-render / post-render assertions (script, not agent)**: add a tiny validation script after format-reports (or a pre-step in build-review-comments) asserting: (a) `rephrased-items.json` entry count == checklist manifest item count (194); (b) every key is composite and matches an enriched finding ref; (c) no duplicate `(grouping,itemId)`; (d) consolidated-report evaluated total == non-N/A finding count. The agent did all of this ad hoc this run — it should be deterministic and step-failing, not model-discretionary.
2. **Fix the stale summary at the source**: `enrich-findings` should regenerate (or drop) the per-grouping `summary` after consolidated statuses are stamped, or the format-reports prompt should instruct the agent to rewrite the blockquote from display statuses instead of copying `summary` verbatim. Cheapest immediate patch: prompt instruction "recompute the counts sentence of the summary from display statuses; keep only the narrative clauses that don't state a verdict."
3. **Uncertain-share circuit breaker**: no guard exists — a pathological run (like the 07-07 fragmentation run with 189 uncertain) would be formatted into a confident-looking report. Add a threshold check (e.g. uncertain > 25% of evaluated → step warns/fails or stamps a banner atop the consolidated report).
4. **Promote agent result-text to step status**: the agent's final message was a substantive self-audit ("counts reconcile … no fallback rephrasing was needed") but lives only as a `type:"result"` line inside a 43MB pino log. This run it flagged no anomalies — but had it flagged one, nothing would surface. Persist the agent result text as a step artifact (e.g. `output/format-reports-result.md`) and pattern-match it for warning language to set step status.
5. **Warn in headline metrics**: update the prompt's metrics spec (line 108) to include warn counts and a Warn column in the per-grouping table so headline arithmetic reconciles.

## Verdict

**HEALTHY WITH NOTES** — the step executed cleanly (20 turns, ~3 min, no retries), produced exactly 194 items with perfect count fidelity, safe composite-keyed `rephrased-items.json`, and to-spec uncertain rendering. The notes: stale pre-consolidation summary blockquotes contradict their own tables in ~6 grouping reports (upstream `enrich-findings` defect propagated by design), headline metrics silently drop the 4 warns (99+7+19 ≠ 129), and the prompt's question-mark title rules are dead letter against the declarative authored TSV.
