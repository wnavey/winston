# Agent 6 — `collect-uncertain-explanations` Step Audit

Review `e5c5f7ab-c186-499d-908c-3d8fa5f86b6d` · runLabel `2026_07_08_run_2_vision_exp` · 2026-07-08
As-ran script: `cc-run-output/workflow/scripts/collect-uncertain-explanations.ts`
Step window: 16:22:22.760Z → 16:22:23.227Z (467 ms), `completed`.

**Verdict: HEALTHY WITH NOTES** — 19/19 cells shipped, 0 nulls, all three collector guards passed genuinely (verified by independent replay, not vacuously). Notes are one soft machinery hint in one shipped external, plus latent guard weaknesses that did not bite this run.

---

## 1. Step purpose

Merges the explain-uncertain fan-out's per-cell result files (`output/uncertain-explanation-results/*.json`) into a single `output/uncertain-explanations.json` keyed by ref (`<guide>:<itemId>`, e.g. `cc-10:AE-01`), pairing each result against its input stub (`output/uncertain-explanation-inputs/*.json`, same basename). Consumed downstream by `build-review-comments` (log line 33798: `--uncertainExplanationsFile=...`). Gated by `if: {{ input.explainUncertain }}` (workflow.yaml:253–260).

## 2. Guard logic (from the as-ran script)

**Important correction to the audit charge**: the charge describes four guards including a collector-side forbidden-terms lint. The as-ran script has **three** collector-side guards; the forbidden-terms lint was **deliberately removed from the collector** and lives in the explain-uncertain prompt's self-check instead. The script docstring (lines 22–28) documents why: audit `ae7cb127` found the collector regex false-positived on the English verb "runs" ("the wall runs along the property line") and nulled a legitimate explanation. Trade explicitly accepted: small machinery-leak risk over silent loss of whole explanations.

| # | Guard | Location | Logic | Action on trip |
|---|-------|----------|-------|----------------|
| 1 | Ref cross-check | script lines 121–127 | Agent echoes `ref` from inside its input file; compared to the ref from the paired input stub (`result.ref !== expectedRef`) | Null BOTH fields, `failureReason: 'ref-mismatch'`, `console.warn("REF-MISMATCH: ...")` |
| 2 | Attribution heuristic | lines 84–104, applied 140–145 | External prose must contain ≥1 item-text word of length ≥5, OR `"sheet {N}"` for any evidence sheetNumber, OR ≥1 evidence-label word of length ≥5 | Null EXTERNAL only (internal kept), `failureReason: 'attribution-mismatch'`, `console.warn` |
| 3 | Failure-rate tripwire | lines 74–75, 235–243 | If inputs exist and `nullCount / total > 0.5` → `process.exit(1)` after writing output + sidecar | Fails the workflow loudly (`console.error("TRIPWIRE: ...")`) |
| (4) | Forbidden-terms lint | **prompt-side**: `workflow/prompts/explain-uncertain.md` lines 36, 40, 58–61 | Self-check: model scans its own `uncertainExplanation` for forbidden terms (`run`/`runs` as review passes, `vote`, `facts.md`, `blocks.md`, `block <N>`, `vision`, `semantic search`, tool names, file paths, UUIDs, "checklist item") and multi-run framing; rewrites once, else emits both fields null with `failureReason: 'lint-failed'` | Cell self-nulls |

Other bookkeeping: missing/unparseable result file → `'agent-failed'` (lines 111–119); both fields null in result → passthrough `failureReason` or `'empty-output'` (lines 132–138). Zero/absent inputs → write `{}`, exit 0, tripwire not applicable (lines 182–194). Observability sidecar `collect-summary.json` written in all paths (lines 171–178, 185, 192, 225–233), must-never-fail.

## 3. What happened (evidence)

**Log** (`cc-run-output/logs/completeness-check.log`):
- Line 33730–33731: step executes, 19 result + 19 input files present on disk (confirmed by directory listing).
- Line 33732: `step.script.completed`, `duration_ms: 467`, **stdout captured in the log event**: `"Collected 19 uncertain explanation(s): 19 ok, 0 null\nWritten to: .../uncertain-explanations.json"`, `stderr: ""`. The charge's caveat that the summary line may be unrecoverable does not apply — the conductor observability remediation (conductor#212/#213 lineage) is live here and `step.script.completed` carries both streams. Empty stderr ⇒ **no REF-MISMATCH / ATTRIBUTION-MISMATCH / TRIPWIRE warnings fired** (grep for those tokens: zero hits anywhere in the log).
- Line 33733: `Step completed`.

**Output** (`cc-run-output/output/uncertain-explanations.json`):
- 19 entries, matching the run's 19 uncertain cells. Keys are colon-form refs (`cc-6:CMP-01` etc.), matching what `build-review-comments` loaded ("Loaded uncertain explanations: 19 items", log line 33799).
- All 19: non-null `uncertainExplanation`, non-null `agentTraceUncertainExplanation`, `failureReason: null`. **Null count 0; per-reason breakdown empty.** No `lint-failed` self-nulls in any result file either.

**Sidecar** (`cc-run-output/output/collect-summary.json`): `{total: 19, collected: 19, nullCount: 0, perFailureReason: {}, tripwireThreshold: 0.5, tripwireFired: false, failedRefs: []}` — consistent with the log stdout and the output file.

**Guards passed for the right reasons (independent replay over all 19 cells):**
- **Guard 1**: every result file carries a populated `ref` field, and all 19 equal the paired input's `ref`. The guard was genuinely exercised (a missing/echoed-wrong `ref` would have tripped it), not bypassed.
- **Guard 2**: replaying `checkAttribution` verbatim: all 19 pass, with wide margins — median ~6 item-keyword hits, 18/19 also match a literal `"sheet {N}"` string, and all 19 match evidence-label words (3–14 distinct). Weakest cell: `cc-6:CMP-01` (2 keyword hits — `showing`, `adjacent` — no sheet-string hit, 6 label hits); still comfortably past a threshold of 1. No cell passed on generic-only keywords (checked against {shown, provided, required, information, ...}) — the attributions are substantive.
- **Guard 3**: null rate 0/19 = 0% vs the 50% threshold — not close (would need ≥10 nulls).

## 4. What went right

1. **Perfect collection**: 19/19 shipped with both fields; output keys, count, and downstream load all consistent.
2. **Guards non-vacuous**: guard 1 compared real echoed refs; guard 2 passed on substantive item-specific language, not filler words.
3. **Lint efficacy (prompt-side)**: full-corpus regex sweep of all 19 shipped externals for `run(s)/vote(s)/passes/attempts/iterations`, internal artifacts (`facts.md`, `blocks.md`, `block N`, `vision`, `semantic search`, file paths, UUIDs, "checklist item"), and agent/tool/model framing: **zero hard hits**. Field separation is exemplary — every internal `agentTraceUncertainExplanation` carries the vote breakdown ("Vote breakdown: 3 fail, 2 pass across 5 runs...") while the paired external voices one review that saw conflicting evidence. Sampled 7 externals in full (`cc-6:CMP-01`, `cc-22:CC-22-14`, `cc-3:CC-3-21`, `cc-24:CC-24-16`, `cc-13:AW-07`, `cc-5:ADR-04`, `cc-21:CC-21-01`): well-attributed, sheet-referenced, applicant-appropriate tone, uniform "a confident determination could not be made — please review" close.
4. **No attribution false positives to adjudicate** — zero nulls means zero legitimate explanations lost, which is exactly the failure mode the removed collector lint used to cause.
5. **Observability sidecar worked**: `collect-summary.json` persisted the summary/tripwire data redundantly with the (this time recoverable) stdout.
6. **Removed-lint rationale documented in the script itself** (lines 22–28) with the audit reference — good archaeology for future readers.

## 5. What went wrong

Minor; nothing degraded this run's output materially.

1. **One soft machinery hint shipped** (`cc-22:CC-22-14` external): "...with **some analysis concluding** that no neighboring curb cuts are distinctly shown..." and "...**some finding** graphical depictions sufficient, **others** requiring explicit textual identification...". No forbidden noun is used, but the "some…, others…" plural-analysis framing implies multiple independent reviews — exactly the multi-run framing the prompt self-check (explain-uncertain.md line 60) tells the model to catch. 1/19 leak rate; the other 18 use compliant single-voice constructions ("on one reading… however…"). This is the predictable residual of moving the lint prompt-side: term lists catch nouns, not framing.
2. **Doc/code mismatch in guard 2**: the comment at line 81 claims keywords are "≥ 5 chars, **non-stopword**" but the code (lines 87–90) filters by length only — no stopword list exists. Generic 5+-letter words (`shall`, `shown`, `provided`, `required`) count as attribution evidence, making the guard more permissive than documented. Didn't matter here (no generic-only passes), but wholesale wrong-item prose containing "provided" would slip through.
3. **Silent overwrite on duplicate refs**: `collected[expectedRef] = entry` (line 206) — if `prepare-uncertain-explanation-inputs` ever emitted two stubs with the same `ref`, the second silently clobbers the first and the entry count masks the loss. 19/19 refs unique this run, so latent only.

## 6. Tripwire calibration

Observed null rate: **0/19 (0%)** against a 50% threshold — 10 nulls of headroom; nowhere near tripping. The threshold is calibrated to the CRC catastrophe it commemorates (86.6% silent nulls) and is fine as a backstop, but it is blunt at n=19: 9 nulls (47%) — half the run's explanations lost — would still pass silently, surfaced only in the sidecar.

**Per-reason thresholds would be better**, because the reasons have very different priors:
- `ref-mismatch` is deterministic wrong-file reading — **even 1 is systemic** (harness handoff bug, not model noise). Recommend: any `ref-mismatch` > 0 ⇒ fail, or at minimum a `level:40` warn log.
- `agent-failed` / `input-missing` are infra: cluster-sensitive; ≥ ~20% ⇒ fail.
- `attribution-mismatch` / `lint-failed` are heuristic/model judgment with known false-positive risk: tolerate individually, keep under the aggregate 50%.

A cheap composite: `ref-mismatch > 0 || infra-reasons/total > 0.2 || nullCount/total > 0.5`.

## 7. Observability gaps & remediations

1. **Summary not emitted as a structured pino line.** The summary exists as stdout (recoverable this run only because `step.script.completed` captures it) and as the JSON sidecar. Neither is a queryable log line. Remediation: emit one JSON line to stdout/stderr in pino shape (`{"event":"collect-uncertain.summary", total, collected, perFailureReason, tripwireFired}`) so log-only triage (the common audit mode) sees the per-reason breakdown without fetching the output dir.
2. **No `degenerate-input` failure reason.** If an input stub lacks both `itemText` and `evidenceLocations`, `checkAttribution` can only return false and the cell is mislabeled `attribution-mismatch` — blaming the model for a prepare-step defect. Remediation: pre-check the stub; if it carries zero usable keywords/labels, record `failureReason: 'degenerate-input'` (and count it as an infra reason for the per-reason tripwire). Not observed this run (all 19 stubs had rich itemText + evidence).
3. **No dedup warning at collect time.** Add `if (expectedRef in collected) console.warn("DUPLICATE-REF: ...")` before line 206, and include a duplicate count in the sidecar.
4. Smaller: fix the guard-2 comment/code mismatch (add a stopword list or correct the comment); consider logging guard-2 *pass margins* (keyword-hit counts) in the sidecar so drift toward barely-passing attributions is visible across runs.

---

**Verdict: HEALTHY WITH NOTES.** The step did its one job flawlessly on clean inputs — 19/19 collected, guards verified non-vacuous by replay, tripwire never approached. Notes: one shipped external softly implies multiple analyses (prompt-lint blind spot), and three latent script weaknesses (undocumented-permissive attribution keywords, silent duplicate-ref overwrite, missing degenerate-input reason) are worth fixing before a run with degraded inputs exercises them.
