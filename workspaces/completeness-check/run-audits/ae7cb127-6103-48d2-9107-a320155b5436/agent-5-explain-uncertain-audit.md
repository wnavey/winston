# Agent 5 — `explain-uncertain` step audit

Review ID: `ae7cb127-6103-48d2-9107-a320155b5436` • Step wall: 2m 59s • Items: 16 • Model: `claude-sonnet-4-6` • Workers: 10

## Verdict — HEALTHY WITH NOTES

The step ran cleanly at the mechanical level (16→16 result files, no retries, no structured-output errors, ~$0 waste on artifactual uncertainty), and the sampled explanations are high-quality — genuinely reasoned prose that names each run's evidence, diagnoses the divergence honestly (e.g., "Run 3 did not independently verify..."), and keeps the external field neutrally applicant-facing. The single blemish is a collector-side lint-reject that nulls one of 16 external explanations (6.25%) on a **false positive** for the literal English word "runs" — the agent wrote "the retaining wall runs along the southern portion of the site" and the collector's regex clobbered it. Downstream (`review-comments.json`) that item ships to the applicant with a null `uncertainExplanation` and a filled `agentTraceUncertainExplanation`, so the applicant loses the external prose while engineers keep the trace.

The second-order finding — and this is the one worth escalating — is that `enriched-findings.json` never surfaces the `uncertainExplanation` / `agentTraceUncertainExplanation` fields at all (0/16 uncertain findings carry them; workflow.yaml:262-269 does not pass `uncertainExplanationsFile` to `enrich-findings`). The fields do reach the report path via `format-reports` / `build-review-comments` (workflow.yaml:291), so nothing user-visible is broken, but anyone reading enriched-findings.json expecting the explanations to be there will find them absent. That coupling is invisible from the enriched artifact.

## Step purpose

Per prompt (`workflow/prompts/explain-uncertain.md:1-4`): the step **does not adjudicate**. It reads the per-run findings for a single uncertain checklist item and synthesizes two fields — an external, applicant-facing 2–5-sentence neutral explanation, and an internal, verbose engineer-facing trace. Status remains `uncertain` regardless of what the explanation says; the tentative winner is separately promoted to `status` by `enrich-findings` for display. No re-investigation, no tools, no adjudication.

**Answer to the "can it change status?" question:** No. It is annotation only. The 16 uncertains in the pre-scan match the 16 in the FINAL `consolidated-findings.json` (workflow/output/consolidated-findings.json) and match the 16 with `consolidatedStatus=uncertain` in `enriched-findings.json` (workflow/output/enriched-findings.json — totals: `pass=107, fail=4, warn=6, uncertain=16, notApplicable=61, total=194`). None flipped because none could flip — the prompt explicitly forbids adjudication (`explain-uncertain.md:3, :53`).

## What happened

### Execution stats (run-log.json)
- **16 items claimed → 16 wrote structured output → 16 completed.** All statuses = `done`; no `attempts`/`retries` fields exposed by run-log for this step (a real observability gap — see below).
- Per-item durations (from run-log): min **62.5s**, p50 **78.8s**, max **112.1s** (`cc-23__CC-23-10.json`). Wall 2m 59s with 10 workers ≈ 1.9 waves of 16/10 items — consistent with 12 items in wave 1 and a 4-item tail.
- Log corroborates 1:1: 16× "Claimed item, launching agent" → 16× "Wrote structured output" → 16× "Item completed" (grep on `logs/completeness-check.log`, filter `"step":"explain-uncertain"`).

### Model / cost
Token totals (aggregated from nested `usage` blocks in the log across all 16 cells):
- input: 48
- cache_creation_input_tokens: **396,377**
- cache_read_input_tokens: **678,443**
- output: **67,345**

Per-item output range: 3,307 (cc-13__AW-14) → 5,366 (cc-13__AW-05). Nothing anomalously expensive — the largest by output tokens is not the same as the slowest by wall (which is cc-23__CC-23-10 at 112s). The variance in `cache_creation_input_tokens` between items (7k vs 35k) suggests worker-pool cache locality: the seven `cc-13__AW-*` items sharing a grouping-context prefix hit each other's caches (all cc-13 items show cc≈7k / cr≈59.7k), while the singletons paid full first-touch prefix creation (cc≈35k / cr≈32k). Design-appropriate — no cost anomaly.

### Structured-output health
- **Zero coercion mentions.** Zero `error_max_structured_output_retries`. Zero level>=40 log entries for this step.
- Four `"schema"` string hits in the log — all false positives (they appear inside `$schema` fields in the streamed thinking/text content, not schema-fail events).
- All 16 result files pass the emit schema: `ref`, `uncertainExplanation`, `agentTraceUncertainExplanation` all present; each has `failureReason: null`.
- Every result's `ref` matches the corresponding input file's `ref` — **zero anti-misattribution guard trips.**

### Result quality — 4 sampled outputs

Sampled `cc-2__CC-2-14` (5-way split on PE-seal interpretation), `cc-13__AW-14` (3 NA / 2 pass, blank UCM waiver table classification dispute), `cc-21__CC-21-01` (3 fail / 1 warn / 1 pass on drainage AP3 acknowledgment), `cc-23__CC-23-07` (3 NA / 1 pass / 1 fail on signage/striping scope). Findings:

1. **The internal trace is genuinely diagnostic, not hand-wavy.** Example from `output/uncertain-explanation-results/cc-2__CC-2-14.json:4`: > "Critically, Run-3 did not independently verify that Sheets 37–43 actually bear an architect's seal — it appears to have inferred the presence of an appropriate seal from the firm name alone. Runs 1, 2, and 4 all directly confirmed these sheets carry no professional seal whatsoever, making Run-3's pass verdict the weakest of the three."
   This is exactly the "diagnose WHY the runs diverged" charge from `explain-uncertain.md:47`.
2. **Correctly recognizes non-artifactual uncertainty.** All 16 items have `voteBreakdown.missing=0` — the agent never fabricates a missing-vote explanation. The internal traces routinely name the fault line: pure interpretive disagreement (cc-2, cc-13:AW-14), sheet-coverage gap (cc-23:CC-23-07 flagged Run 1's failure to consult Sheet 13), or "different legal theory applied" (cc-21:CC-21-01 correctly identifies Run 3 as applying a scoped-out standard).
3. **External field is neutral and short.** Lengths: min 539 chars, p50 991, max 1195 — all within the 2–5-sentence guideline. Case-for/case-against framing appears in every sampled item; the mandated closer ("a confident determination could not be made — please review") appears in all 4 sampled.
4. **No multi-run framing leaks in the sampled externals.** No `run/runs` (in the review-pass sense), no `vote`, no `facts.md`, no block numbers, no UUIDs.

### Waste accounting

Zero cells were spent explaining artifactual uncertainty. `voteBreakdown.missing=0` on all 16 inputs (see per-input dump: every uncertain is a genuine vote split — cc-13:AW-30 is `warn=3/pass=2`, cc-2:CC-2-14 is `pass=3/fail=2`, etc.). This is the ideal case for the step: every dollar of sonnet-4-6 spend went to real interpretive disagreement.

## Root-cause analysis — the one thing that went wrong

**Symptom.** `output/uncertain-explanations.json[cc-23:CC-23-08].uncertainExplanation = null, failureReason = "lint-reject"`. The internal trace is preserved. Downstream `review-comments.json` shows the uncertain comment with `uncertainExplanation: null` and full `agentTraceUncertainExplanation`.

**Root cause.** The agent produced a well-formed, prompt-compliant external explanation. Its own self-lint (per `explain-uncertain.md:60-62`) accepted it because the prompt scopes the forbidden term as "run / runs (as review passes)". The literal English word "runs" appears in the sentence: > "the retaining wall runs along the southern portion of the site" (`output/uncertain-explanation-results/cc-23__CC-23-08.json:3`).

The collector's regex is stricter than the prompt intent (`workflow/scripts/collect-uncertain-explanations.ts:75`):
```
{ reason: 'run-reference', re: /\brun\s*\d+\b|\bruns\b|\brun\b/i }
```
The mechanical rule bans the string `run`/`runs` in ANY sense — verb, noun, "runs along", "the water runs down" — and the collector then null-fills the external field (`collect-uncertain-explanations.ts:159-164`).

**Impact.** 1/16 = 6.25% of externals silently blanked. The failure mode is invisible to the workflow status (`continueOnFailure: true`, and the item is still `done` because the sonnet call succeeded). The `>50%-null tripwire` (`collect-uncertain-explanations.ts` header comment) is nowhere near tripping at 6.25%, so no workflow-level surface.

**Why the collector chose the strict regex.** The design pragmatism is defensible: the agent might occasionally slip a "Run 2 found..." or "runs 3–5 concluded" past its own self-lint, and a deterministic regex is the cheap-and-loud backstop. The collision with the literal English "runs" was the price. A narrower regex — e.g., `/\brun[\s-]?\d+\b|\bruns?\s+\d+\b|\bruns?\s+(that|which|who|found|concluded|passed|failed|read)\b/i` — would catch the review-pass sense without blowing up idiomatic English.

## What went right

- **Result 1:1 with input.** 16 inputs (`output/uncertain-explanation-inputs/`) → 16 result files (`output/uncertain-explanation-results/`) → 16 entries in `uncertain-explanations.json`. Zero drops.
- **Ref-echo anti-misattribution guard held.** 16/16 output refs match input refs. No cell read the wrong file.
- **All 16 pass the emit schema.** No `failureReason` from the agent side; every result has both fields populated.
- **Prompt fidelity in the sampled outputs.** External fields honor the case-for/case-against structure and the "single agentic pass" framing; internal fields diagnose WHY the runs diverged rather than just enumerate them (this is the specific behavior the prompt asks for at `explain-uncertain.md:47-50`, and the samples deliver it).
- **Zero retries, zero coercion, zero level≥40 log lines** — the sonnet-4-6 model held the schema tightly on every call.
- **Cache behavior is sane.** The cc-13 grouping cluster reuses each other's prompt-prefix cache (evidenced by the 7k/59.7k cc/cr split vs 35k/32k for singletons). Nothing to tune.
- **No cost anomaly.** Slowest item (112s) does not have the highest output tokens; the wall variance is dominated by model latency, not output length.
- **No missing-vote-driven uncertainty.** All 16 uncertains are genuine vote splits — the step is spending its sonnet budget on real interpretive disagreement, not fragmentation artifacts. Zero waste.
- **`explain-uncertain` correctly leaves status alone.** The 16 uncertain refs are identical between `consolidated-findings.json` (pre-explain) and `enriched-findings.json` (post-explain, `consolidatedStatus=uncertain` on the same 16). Status flow is: `consolidatedStatus=uncertain` (breadcrumb) + `tentativeStatus=<winner>` promoted into `status` for display — verified by walking `enriched-findings.json` totals `pass=107/fail=4/warn=6/uncertain=16/notApplicable=61` matching the pre-scan headline.

## What went wrong

1. **Collector's forbidden-terms regex is too broad** (`workflow/scripts/collect-uncertain-explanations.ts:75`). Nulls externals containing the literal English verb/noun "runs" that has nothing to do with review passes. One casualty here (`cc-23:CC-23-08`); over larger uncertain volumes this will compound.
2. **Enriched-findings.json does not carry the explanations** (`workflow/workflow.yaml:262-269`). By design (the fields are joined in later steps), but the enriched artifact is the natural place to look for full per-item context; anyone auditing the run from that file will report "explanations missing" and be wrong. Documentation gap, not a correctness gap.
3. **Run-log items expose only `startedAt`/`endedAt`/`status`/`index`/`value`** — no `attempts`, no `retries`, no `usage`, no `cost`. This is a general conductor observability gap; it happens to be benign here (all items succeeded first try) but blocks post-hoc cost/retry accounting without re-parsing the raw log.
4. **The step's success rate is only knowable by inspecting the collector's `failureReason` distribution**, not from `run-log.json`. The workflow status shows 16/16 `done` even when the collector null-fills fields — a mildly misleading surface for a step whose output quality is defined by whether the externals survived four post-hoc guards.

## Observability gaps & remediations

1. **Loosen the `runs` regex or wire the collector's decision back to the sub-agent.** Preferred: replace the standalone `\bruns?\b` clause with a review-pass-scoped one (`\bruns?\s+(?:\d+|that|which|who|found|concluded|noted|passed|failed|read|saw|examined|reviewed)\b`) and let the standalone verb through. Alternative: on `lint-reject`, log the trip verbatim (already done at `collect-uncertain-explanations.ts:163`) AND write the offending prose to `output/lint-reject-diagnostics/` so triage can decide case-by-case whether the trip was legit.
2. **Emit a per-item collector report.** A single file (say `output/uncertain-explanations-report.json`) with `{ref, failureReason, guardTrippedAt, promptExternalLenChars, promptInternalLenChars}` would let synthesis-time audits (and the >50% tripwire operator) see at a glance how many externals survived and which guards fired. Today you have to read the whole `uncertain-explanations.json` and infer.
3. **Populate `enriched-findings.json` with the two explanation fields.** Extend `enrich-findings` to accept `uncertainExplanationsFile` (workflow.yaml already reads it two steps downstream; pass it here too) and stamp `uncertainExplanation` + `agentTraceUncertainExplanation` onto the enriched finding whenever `consolidatedStatus=uncertain`. This makes `enriched-findings.json` the honest single source of truth and lets any downstream consumer (including CC audits like this one) skip the walk through `format-reports` intermediates.
4. **Extend run-log's item shape to include `attempts`, `usage`, and — if the agent runner has it — `costUSD`.** For this step the cost surface is tiny, but the `explain-uncertain` step is exactly the surface where per-item cost telemetry pays off (small item count, expensive model).
5. **Emit a `uncertaintyKind` flag from `prepare-uncertain-explanation-inputs`** (`missing-vote-dominated` vs `genuine-split`). When missing-vote-dominated, take a template path instead of an LLM call — currently the step handles this correctly by prompt discipline, but flagging up front would let the workflow route around sonnet-4-6 entirely for zero-waste cost floors on future runs. (On this run all 16 are genuine — no cost saving today, but the plumbing would harden the invariant.)
6. **Surface the collector's guard-fire count in workflow/run-log.json.** Something like `steps[collect-uncertain-explanations].summary = { total: 16, refMismatches: 0, attributionMismatches: 0, lintRejects: 1, agentFailures: 0 }`. Today an operator only sees "collector: done". A single-item lint-reject is invisible without walking the JSON.

---

### Verdict — HEALTHY WITH NOTES

Step ran cleanly, produced high-quality explanations, spent zero effort on artifactual uncertainty, and enforced its anti-misattribution invariant. One external explanation (6.25%) was collateral damage of the collector's over-broad `runs` regex; downstream this manifests as `uncertainExplanation: null` on `cc-23:CC-23-08` in `review-comments.json` while the internal trace is preserved. The regex, the enriched-findings coupling, and the run-log item shape are all fixable without design-level changes.
