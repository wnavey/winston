# CRC Majority Vote (medly) — Design Spec

> **Status:** Draft for implementation. 2026-06-23.
> **Branch:** `crc-majority-vote-design-spec` (winston).
> **Implementation target:** `bureau/workflows/comment-resolution-check/` (workflow.yaml + scripts + prompts/schemas if needed).
> **Successor work:** picked up by a fresh session via `bd ready` against the bead linked at the bottom of this spec.

---

## 1. Summary

Add a multi-run majority-vote ("medly") capability to the `comment-resolution-check` Conductor workflow, mirroring the implementation in `completeness-check`. When `runs > 1`, each department's CRC guide is reviewed by N independent agent runs in parallel; a new `cross-run-consolidate-crc` script then performs per-atomic-item majority vote, assigns a confidence tier (high/medium/low), and writes a single consolidated finding plus the full per-run trace for downstream consumption. Default behavior is unchanged (`runs = 1` is a passthrough). Per-run trace lands in `review_comments.agent_trace` JSONB so cityhall can surface the "Run voting" UX it already has for completeness-check — but **two small cityhall changes are required** for that UI to render correctly for `review_type='crc'` (routing + status colors; see §9).

The design is deliberately a near-clone of the completeness-check medly path. **Mirror that workflow whenever an explicit decision is not called out below.**

## 2. Goals

- **Quality lift on disagreement-prone items.** Three independent reads should reduce single-agent false-positives on `resolved` and false-negatives on `failed`.
- **Zero-impact default.** Workflow.yaml input `runs` defaults to `1`; when `1`, the new consolidate step is a passthrough and the on-disk + DB shape is identical to today.
- **Mirror completeness-check.** Reuse paths, layouts, script names, severity/confidence semantics — minimize cognitive load.
- **Minimal cityhall changes.** Two small touches to make the existing "Run voting" UI render for `review_type='crc'`: a routing branch (CRC reviews currently fall through to the formal-review `CommentCard`, not `CompletenessCommentCard`) and CRC's `resolved/failed` status colors. See §9.
- **Opt-in by flag.** Medly is enabled per-run via CLI or workflow input override; the default workflow shape is single-run.

## 3. Non-goals

- Fixing the structured-output retry storm bug (`bugs/STRUCT-OUTPUT-RETRY-STORM.md`). That is tracked as an independent risk; this spec proceeds without depending on its resolution. (See §10 risk register.)
- Asymmetric voting (e.g. `resolved` requires unanimity). Future option, see §11.
- Model-mixing across runs (Sonnet + Haiku ensemble). Future option, see §11.
- Prompt-variance across runs. Future option, see §11.
- Confidence-aware triage (`low confidence → triage_status='needs-review'`). Future option, see §11.
- Eval / accuracy lift measurement under medly. Iteration-2 in the SPEC; explicitly deferred here.
- PDF report skill (`generate-crc-report`) changes. The PDF renders the consolidated verdict only.

## 4. Background

### 4.1 CRC workflow today (single-run, iteration-1 MVP)

`bureau/workflows/comment-resolution-check/workflow.yaml` runs five sequential steps:

```
Step 1  fetch-crc-guides              (script) — Supabase storage → workspace
Step 2  review                        (agent fan-out: 1 per crc-{dept}.md guide)
                                       → output/findings/{checklistItem}.json
Step 3  enrich-findings               (script) — joins findings + guide metadata
Step 4  rephrase-titles               (agent) — verification sentence → short title
Step 5  build-crc-review-comments     (script) — assembles review-comments.json
                                                  for conductor's review-saver
```

The agent emits a `{ grouping, findings, summary }` envelope validated against `schemas/crc.schema.json`. Status enum is `resolved | failed | not-applicable`.

### 4.2 How completeness-check medly works (reference implementation)

`bureau/jurisdictions/austin/workflows/completeness-check/workflow.yaml` exposes a `runs: number` input; when `runs > 1`, conductor automatically loops a `runIndex` template variable from `1..N` and writes each run's output to `output/runs/{runIndex}/findings/{checklistItem}.json`. After fan-out, the workflow runs `cross-run-consolidate-cc.ts`:

- Per-checklist-item majority vote across the runs.
- Tie-break by **severity order** (4-status: `fail > unclear > not-applicable > pass`).
- **Confidence tier**: unanimous → `high`; ≥ 2 → `medium`; 1 → `low`. Compared against `totalRuns`, so missing runs prevent `high` (intentional).
- **Winning finding selection**: earliest run whose status matches the voted majority. Determinism without coin-flips.
- **Single-run passthrough**: when `totalRuns === 1`, the script copies `runs/run-1/findings/*` to `output/findings/` and exits. No vote logic runs.
- Outputs: per-grouping `output/findings/{grouping}.md.json` (winner finding only, drop-in for downstream `enrich-findings`) + a full `output/consolidated-findings.json` carrying all per-run data for downstream embed into `agent_trace`.

CityHall consumes the per-run trace through `CommentCard.svelte` (renders `confidence`, `runCount`, `totalRuns`, and an expandable per-run finding list).

### 4.3 Related precedents

Three forks of the same vote algorithm already exist:
- `bureau/workflows/review/scripts/cross-run-consolidate.ts` (formal review, fail-only)
- `bureau/jurisdictions/austin/workflows/review-4.3/scripts/cross-run-consolidate.ts` (older variant)
- `bureau/jurisdictions/austin/workflows/completeness-check/scripts/cross-run-consolidate-cc.ts` (4-status)

This spec adds a fourth fork specialized for CRC's 3-status enum. See §6.4 for rationale.

## 5. Design decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Default `runs` value | **`1`** (opt-in) | Keeps default behavior identical to today. Medly is enabled per-invocation by CLI override or workflow input. |
| D2 | Status enum width | **3 statuses** (`resolved | failed | not-applicable`) — unchanged | No schema change. Minimizes blast radius. |
| D3 | Tie-break severity order | **`failed > not-applicable > resolved`** | Matches the spec's "ambiguous evidence collapses to `failed`" rule. Cautious-applicant. |
| D4 | Vote semantics | **Symmetric majority** (winner-takes-all) | Mirrors completeness. 2-1 `resolved` → `resolved` with `medium` confidence. |
| D5 | Confidence tiers | **`high` (unanimous) / `medium` (≥2) / `low` (1)** | Identical to completeness; lets cityhall reuse its existing UI logic 1:1. |
| D6 | Evidence merge when statuses agree | **Winner-only** | Mirrors completeness. Per-run evidence is preserved in `agent_trace` for the curious. |
| D7 | Resolution-text merge | **Winner-only** | Same as above. No LLM synthesis step in critical path. |
| D8 | Missing-run handling | **Vote with what's present**; missing runs prevent `high` confidence | Mirrors completeness. A run that exhausts retries does not fail the workflow. |
| D9 | Run independence | **Identical prompt across runs; model-temperature drives variance** | Mirrors completeness. No per-run seed injection, no prompt variation, no model mixing. |
| D10 | `maxWorkers` default | **Scale linearly with `runs`** (e.g. `runs=3` → bump default proportionally) | Keeps wall-clock comparable to single-run baseline. Mirrors completeness's documented scaling. |
| D11 | Surface for `runs` input | **workflow.yaml input** with default `1` | Same shape as completeness. Enables medly without code change; documented in YAML. |
| D12 | Per-run trace storage | **`review_comments.agent_trace` JSONB** | No schema migration. Identical to completeness; cityhall surfaces from this column today. |
| D13 | File layout for runs > 1 | **`output/runs/{runIndex}/findings/{checklistItem}.json`** per-run, **`output/findings/{checklistItem}.json`** consolidated | Mirrors completeness exactly. Downstream steps' input paths unchanged. |
| D14 | Triage write semantics | **Consolidated verdict only** — `resolved` or `failed` from majority vote, regardless of confidence | Confidence is a UI signal, not a triage state. Triage write semantics are unchanged from iteration-1 SPEC §8.4. |
| D15 | Consolidated `summary` field | **Winner's summary** (mirrors completeness's first-run pick) | Cheapest, deterministic. Downstream doesn't depend on it. |
| D16 | Consolidate script approach | **Fork** — new file `bureau/workflows/comment-resolution-check/scripts/cross-run-consolidate-crc.ts` | Matches the three existing forks (review, review-4.3, completeness). Lowest coupling, ships fast. |
| D17 | Downstream scope | **Consolidate step (NEW) + `build-crc-review-comments` (MODIFIED)** | `enrich-findings` and `rephrase-titles` read from the same paths and are unchanged. Smallest blast radius. |
| D18 | Cost ceiling | **None — document expected ranges in workflow.yaml** | No hard go/no-go. Spec notes that `runs=3 × 15 depts × maxWorkers=39` mirrors completeness's operating point. |

## 6. Workflow changes

### 6.1 Inputs (workflow.yaml diff)

Add to `inputs:`:

```yaml
  runs:
    type: number
    required: false
    default: 1
    description: |
      Number of independent review runs per CRC guide. When >1, a cross-run
      consolidation step performs majority vote across runs to assign final
      status and confidence tiers. Defaults to 1 (single-run passthrough).
```

Update existing `maxWorkers` description to note the scaling guidance:

```yaml
  maxWorkers:
    type: number
    required: false
    default: 13
    description: |
      Max concurrent review-agent workers across (department × runIndex) cells.
      Default 13 matches single-run completeness-check baseline. For runs > 1,
      bump proportionally (e.g. runs=3 → maxWorkers=39) to keep wall-clock
      comparable to a single-run baseline and stay within Inngest's 3-hour cap.
```

### 6.2 `review` step — fan-out adds `runs` and templated path

Before:

```yaml
  - name: review
    agent:
      model: "{{ input.model }}"
      effort: "{{ input.effort }}"
      prompt: review.md
    tools:
      - crc-vision-check
      - script:semantic-search-blocks
    checklistItems: "{{ WORKSPACE_PATH }}/crc-guides/crc-*.md"
    schema: crc.schema.json
    output: "{{ WORKSPACE_PATH }}/output/findings/{{ checklistItem }}.json"
    retries: 5
    maxWorkers: "{{ input.maxWorkers }}"
```

After:

```yaml
  - name: review
    agent:
      model: "{{ input.model }}"
      effort: "{{ input.effort }}"
      prompt: review.md
    tools:
      - crc-vision-check
      - script:semantic-search-blocks
    checklistItems: "{{ WORKSPACE_PATH }}/crc-guides/crc-*.md"
    runs: "{{ input.runs }}"
    schema: crc.schema.json
    output: "{{ WORKSPACE_PATH }}/output/runs/{{ runIndex }}/findings/{{ checklistItem }}.json"
    retries: 5
    maxWorkers: "{{ input.maxWorkers }}"
```

The agent prompt and the schema (`schemas/crc.schema.json`) are unchanged. The agent emits the same `{ grouping, findings, summary }` envelope regardless of `runs`.

### 6.3 NEW step — `cross-run-consolidate-crc`

Insert between `review` (step 2) and `enrich-findings` (step 3):

```yaml
  - name: cross-run-consolidate-crc
    script:
      name: cross-run-consolidate-crc
      args:
        runsDir: "{{ WORKSPACE_PATH }}/output/runs"
        findingsDir: "{{ WORKSPACE_PATH }}/output/findings"
        runCount: "{{ input.runs }}"
```

### 6.4 NEW script — `scripts/cross-run-consolidate-crc.ts`

Fork `bureau/jurisdictions/austin/workflows/completeness-check/scripts/cross-run-consolidate-cc.ts`. Diffs:

1. **Status enum**:
   ```ts
   type Status = 'resolved' | 'failed' | 'not-applicable';
   ```
2. **Severity map** (per D3):
   ```ts
   const STATUS_SEVERITY: Record<Status, number> = {
     'failed': 2,
     'not-applicable': 1,
     'resolved': 0,
   };
   ```
3. **Output filename** — completeness writes `{grouping}.md.json`; CRC's `enrich-findings` reads `output/findings/{checklistItem}.json` where `checklistItem` already includes `.md` in the filename pattern. **Match whatever pattern conductor's `output:` template currently produces** (verify by inspecting the single-run pre-consolidate file naming during implementation). Likely `{grouping}.md.json` to mirror completeness.
4. **Status counts in the final log** — replace `pass/fail/unclear/n/a` with `resolved/failed/n/a`.
5. **Single-run passthrough** — keep as-is. `runCount === 1` copies `runs/run-1/findings/*` to `findingsDir`.
6. **Confidence semantics, vote algorithm, winning-finding selection, missing-run tolerance** — all preserved unchanged.

The output contract on disk is identical to completeness's:
- `output/findings/{checklistItem}.json` — full agent envelope `{ grouping, findings, summary }` with winning findings only. Drop-in replacement for the single-run output `enrich-findings` reads today.
- `output/consolidated-findings.json` — array of `ConsolidatedItem`s with per-run data, used by `build-crc-review-comments` to populate `agent_trace`.

### 6.5 MODIFIED step — `build-crc-review-comments`

Today's script reads `output/enriched-findings.json` and the rephrased titles, then emits the `review-comments.json` shape for conductor's review-saver. Under medly it additionally:

1. **Reads `output/consolidated-findings.json`** (passed via a new `--consolidatedFile` arg, mirroring completeness's `build-review-comments.ts`).
2. **Embeds per-run trace into `agent_trace` JSONB** for each review comment. Shape mirrors completeness — include `perRunFindings: [{ run, status, explanation, observation, reasoning, evidenceLocations }, ...]`, plus top-level `confidence`, `runCount`, `totalRuns`.
3. **Adds a new `--totalRuns` arg** so the script knows how many runs were expected (matches completeness).

When `runs = 1`, the consolidated file still exists (the passthrough writes it), with `totalRuns: 1`, `runCount: 1`, `confidence: 'high'` per item, and a single-entry `perRunFindings` array. CityHall will render this as a single-run trace, identical to today's UX modulo the badge.

`workflow.yaml` updates the `args` block for this step:

```yaml
  - name: build-crc-review-comments
    script:
      name: build-crc-review-comments
      args:
        enrichedFile: "{{ WORKSPACE_PATH }}/output/enriched-findings.json"
        rephrasedFile: "{{ WORKSPACE_PATH }}/output/rephrased-items.json"
        manifestFile: "{{ WORKSPACE_PATH }}/output/crc-guides-manifest.json"
        consolidatedFile: "{{ WORKSPACE_PATH }}/output/consolidated-findings.json"
        totalRuns: "{{ input.runs }}"
        outputFile: "{{ WORKSPACE_PATH }}/output/review-comments.json"
        bureauCommitHash: "{{ bureauCommitHash }}"
```

### 6.6 Steps that DO NOT change

- `fetch-crc-guides` — runs once before fan-out, identical to today.
- `enrich-findings` — reads `output/findings/{checklistItem}.json`, which is now produced by the consolidate step (or by the passthrough when `runs = 1`). Same input contract; zero changes.
- `rephrase-titles` — reads `output/enriched-findings.json`. The agent that produced the enrichment has already been collapsed to winning findings; rephrase sees a single set per item. Zero changes.

## 7. Agent prompt and schema

**No changes** to `prompts/review.md` or `schemas/crc.schema.json` as part of this spec. The agent emits the same envelope shape on each of the N runs.

The struct-output retry storm bug (`bugs/STRUCT-OUTPUT-RETRY-STORM.md`) is tracked independently. Its mitigations (anti-pattern example, sharpened schema description, tool-parameter contract restatement) may land in parallel without coordination with this work.

## 8. Per-run trace persistence (DB shape)

Mirrors completeness-check exactly. `review_comments.agent_trace` JSONB carries, per atomic item:

```jsonc
{
  "confidence": "high" | "medium" | "low",
  "runCount": 3,
  "totalRuns": 3,
  "perRunFindings": [
    {
      "run": "run-1",
      "status": "resolved",
      "explanation": "...",
      "observation": "...",
      "reasoning": "...",
      "evidenceLocations": [ { "documentId": "...", "sheetNumber": 7, "label": "..." } ]
    },
    /* ...one entry per run that produced a finding for this item... */
  ]
}
```

CityHall's existing `CommentCard.svelte` reads `confidence`, `runCount`, `totalRuns`, and `perRunFindings` and renders confidence badges + an expandable per-run trace. **No cityhall changes are required** as long as the agent_trace shape matches completeness 1:1.

## 9. CityHall UI changes (small)

The "Run voting" UX shown in the reference screenshot — `internal` badge, "X of N votes for Y" summary, per-run cards with status badges and dissenting markers — lives in **`CompletenessCommentCard.svelte`**. Today cityhall routes only `review_type='completeness_check'` to that component; CRC currently falls through to **`CommentCard.svelte`** (the formal-review variant), whose per-run UI is functional but less polished and doesn't match the target UX.

Two small touches light up the target UX for CRC. Both are pure UI; no DB migrations, no chat-API changes, no agent_trace shape changes.

### 9.1 Change 1 — route CRC reviews to `CompletenessCommentCard`

**File:** `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/[sectionId]/+page.svelte` (around line 608-628).

Today:

```svelte
{#if isCompletenessCheck}
  <CompletenessCommentCard {comment} ... />
{:else}
  <CommentCard {comment} ... />
{/if}
```

Change to:

```svelte
{#if isCompletenessCheck || isCRC}
  <CompletenessCommentCard {comment} ... />
{:else}
  <CommentCard {comment} ... />
{/if}
```

`isCRC` is already defined in the same file (`$derived(data.review.review_type === 'crc')` at line ~41). Verify the equivalent routing exists in the parent `[reviewId]/+page.svelte` if it also branches by review type; mirror there too.

### 9.2 Change 2 — add CRC's status enum to per-run badge colors

**File:** `cityhall/src/routes/(app)/project/[projectId]/review/CompletenessCommentCard.svelte` (around lines 274-279).

Today, the per-run status badge color branches:

```ts
run.status === 'pass' ? 'text-green-700 bg-green-50 border-green-200' :
run.status === 'fail' ? 'text-red-700 bg-red-50 border-red-200' :
run.status === 'warn' ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
run.status === 'not-applicable' ? 'text-gray-500 bg-gray-50 border-gray-200' :
'text-amber-700 bg-amber-50 border-amber-200'  // fallback
```

Add `'resolved'` (green) and `'failed'` (red). `'not-applicable'` already works:

```ts
run.status === 'pass' || run.status === 'resolved'
  ? 'text-green-700 bg-green-50 border-green-200' :
run.status === 'fail' || run.status === 'failed'
  ? 'text-red-700 bg-red-50 border-red-200' :
run.status === 'warn'
  ? 'text-yellow-700 bg-yellow-50 border-yellow-200' :
run.status === 'not-applicable'
  ? 'text-gray-500 bg-gray-50 border-gray-200' :
'text-amber-700 bg-amber-50 border-amber-200'
```

Also audit the **top-level** `comment.status` badge (separate from per-run badges) in the same file and add the same `'resolved'` / `'failed'` branches if it has a parallel color switch. Likely a 1-line addition; confirm during implementation.

### 9.3 What does NOT need to change

- **The "X of N votes for Y" summary string** is already status-agnostic — it reads `comment.status` directly and renders whatever the word is (will say "votes for failed" / "votes for resolved" with no template changes).
- **`agent_trace` shape.** Same JSONB shape as completeness; CRC writes it, the existing card reads it.
- **`CommentCard.svelte`** (the formal-review variant). CRC routes off it via Change 1; its CRC-amber fallback becomes dead code on the CRC path but stays in place for `review_type='review'`.
- **`SimplifiedCommentCard.svelte`** (a third variant). Not on the CRC review path; confirm during impl and skip.

### 9.4 PR shape and ordering

- Cityhall changes ship as a separate PR from the bureau workflow PR.
- **Either can land first.** The bureau workflow writes the correct `agent_trace` shape regardless of UI; cityhall just renders it with the formal-review card (and amber per-run badges) until the UI PR lands.
- Smoke-test plan (§12) runs against both PRs landed.

## 10. Risk register

### R1 — Struct-output retry storm (`bugs/STRUCT-OUTPUT-RETRY-STORM.md`)

**Risk:** The CRC review agent double-wraps the `StructuredOutput` envelope under a `findings` key on ~7% of single-run attempts (11 of 15 dept agents in the 2026-06-19 smoke run tripped at least once). Each failure burns ~5 wasted Sonnet calls before the outer retry loop fires.

**Medly amplification:** Three runs per department multiplies the structured-output call count by ~3×. Naive expectation: ~3× the absolute number of retry storms per workflow run, and ~3× the cost overhead. If retry-storm rate is independent across runs (likely — the failure is intra-run, not cross-run), this scales linearly.

**Treatment:** Independent track. This spec proceeds without requiring the bug fix. Implementation session should:
- Run the smoke test (§12) with `runs=3` and **record** the count of `agent.structured_output.coercion_failed` events in the error log. If the count is markedly worse than `3 ×` the single-run baseline, escalate as a blocker.
- Add a note in the workflow.yaml `runs` description that medly compounds the retry-storm cost until the bug is fixed.

### R2 — Inngest 3-hour cap

CRC's 15 departments × `runs=3` × `maxWorkers=39` should comfortably fit per the same envelope completeness-check operates in. Verify during smoke test by recording wall-clock; if a real run trends past 2 hours, surface to the same bead.

### R3 — Schema drift between fork and parent

The new `cross-run-consolidate-crc.ts` is a fork. When the completeness-check parent gets fixed for a bug in the vote algorithm, that fix won't auto-propagate. **Treatment:** add a one-line code comment at the top of the new script: `// Forked from bureau/jurisdictions/austin/workflows/completeness-check/scripts/cross-run-consolidate-cc.ts on 2026-06-23. Cross-reference upstream changes when modifying vote logic.`

## 11. Open questions / future work

These are explicitly **not** in scope for this spec but noted so they don't get re-discovered:

1. **Asymmetric voting** — require unanimity (or ≥ 2/3) for `resolved`; any `failed` vote demotes the consolidated verdict. Aligns more aggressively with the SPEC's "ambiguous evidence collapses to failed" rule. Tunable severity at the cost of more `failed` false-positives. Revisit when U1 accuracy eval (SPEC §10.2) gives us real calibration data.
2. **Model-mixing across runs** — Sonnet × Haiku ensemble. Strongest decorrelation across runs but biggest implementation lift (per-run model overrides in workflow.yaml). Revisit after single-model medly accuracy is measured.
3. **Prompt-variance across runs** — vary the system prompt subtly (e.g. "be skeptical", "be charitable", "neutral") to force perspective diversity. Decorrelates mistakes that share a model's prior. Revisit after model-mixing is benchmarked.
4. **Confidence-aware triage** — write `triage_status='needs-review'` for low-confidence items instead of the verdict. Surfaces disagreement as a triage signal rather than burying it in a UI badge. Iteration-3 candidate; deferred until cityhall has the UX affordance for it.

## 12. Smoke test plan

Per the discussion that produced this spec, the smoke test is **reuse 1700 South Lamar U0 + manual disagreement spot-check**:

1. **Single-run baseline.** Run the workflow with `runs=1` against 1700 South Lamar U0 plans + the gen-1 crc-guides. Confirm:
   - All gradeable items return `failed` (the city's deficiencies obviously still exist on the same U0 plans).
   - `consolidated-findings.json` exists with `totalRuns: 1`, `runCount: 1`, `confidence: 'high'`, and a single-entry `perRunFindings` array per item.
   - `review_comments.agent_trace` in Supabase carries the same shape.
   - CityHall renders the run normally (confidence badge visible, per-run trace expandable).

2. **Medly run.** Re-run with `runs=3` and `maxWorkers=39` against the same inputs. Confirm:
   - All gradeable items still return `failed` (unanimous → `confidence: 'high'`).
   - `consolidated-findings.json` shows three entries in `perRunFindings` per item.
   - Hand-inspect 5–10 items where the three runs cite different sheets or use different wording. Verify:
     - Winner finding is the earliest run that matched the voted status.
     - Per-run trace is complete and ordered run-1, run-2, run-3.
     - Confidence is `high` when unanimous.
   - Record retry-storm event count from `workspace/logs/comment-resolution-check-error.log`; check it scales roughly linearly with the single-run baseline (per R1).
   - Wall-clock should be within ~20% of the single-run wall-clock if maxWorkers is scaled correctly.

3. **Synthetic unit test (encouraged, not required for first ship).** Add a fixture-based test for `cross-run-consolidate-crc.ts` that exercises:
   - Unanimous `resolved` (high confidence).
   - 2-1 split (`resolved` wins, medium confidence).
   - 1-1-1 tie (severity tie-break selects `failed`).
   - Missing run (2 of 3 present → medium confidence even on unanimity within present runs).

   Mirroring whatever test pattern completeness-check uses, if any. If no existing test harness, this is good optional work; otherwise carry as a follow-up.

## 13. Cost / wall-clock expectations

No hard cap. Document in the workflow.yaml comments:

- `runs=1` (default): single-run baseline — currently ~15 Sonnet agent calls per workflow, plus retry-storm overhead.
- `runs=3`: ~45 Sonnet agent calls plus ~3× the absolute retry-storm overhead. Within Inngest's 3-hour cap at `maxWorkers=39`.
- Vision-tool calls scale linearly with runs; no cross-run caching today.

Real numbers should be recorded during the smoke test (§12) and added back to this spec as a follow-up commit.

## 14. Out of scope (explicit)

- Fixing the structured-output retry storm. Separate beads.
- CityHall UI changes. The completeness-check components already render the `agent_trace` shape we'll write.
- PDF report (`generate-crc-report` skill) changes. Renders consolidated verdict only.
- Eval / accuracy lift measurement.
- Asymmetric voting, model-mixing, prompt-variance, confidence-aware triage (see §11).
- Cross-run vision-tool caching.
- Refactoring `cross-run-consolidate-cc.ts` / formal-review consolidate scripts into a shared library. (See §6.4 — option C in the Q&A discussion; not chosen.)

## 15. Implementation checklist (for the next session)

A concise punch-list. Verify against the design above as you go.

- [ ] **Branch.** Work on `crc-majority-vote-design-spec` in winston (this spec); implementation lands in `bureau` on its own branch.
- [ ] **workflow.yaml** — add `runs` input (default `1`), update `maxWorkers` description, change `review` step's `output:` template to `output/runs/{{ runIndex }}/findings/{{ checklistItem }}.json` and add `runs:`.
- [ ] **NEW script** — fork `cross-run-consolidate-cc.ts` to `bureau/workflows/comment-resolution-check/scripts/cross-run-consolidate-crc.ts`. Apply the 3-status enum + severity map per §6.4. Keep single-run passthrough.
- [ ] **NEW step** — insert `cross-run-consolidate-crc` step between `review` and `enrich-findings`.
- [ ] **MODIFIED script** — update `build-crc-review-comments.ts` to read `consolidatedFile` + `totalRuns` and embed per-run trace into `agent_trace` JSONB. Update workflow.yaml `args:` for this step.
- [ ] **CityHall PR (separate)** — apply §9 changes: route `isCRC` to `CompletenessCommentCard` in `[reviewId]/[sectionId]/+page.svelte`; add `'resolved'`/`'failed'` color branches in `CompletenessCommentCard.svelte`; audit top-level comment-status badge for the same. Ship as its own PR; can land before or after the bureau PR.
- [ ] **Smoke test** — run §12 plan (single-run + medly on 1700 U0 + hand-inspect 5–10 items). Verify Run voting card renders for CRC after both PRs land.
- [ ] **Record numbers** — wall-clock, agent-call counts, retry-storm event counts → append to §13 as a follow-up commit on the impl branch.
- [ ] **Beads** — close the medly bead created with this spec; link the impl PR.

## 16. Beads

- Sibling bead: **`noetic-bj8`** — CRC W1 (iteration 1 MVP).
- **This spec's bead: `noetic-846`** — "CRC W2 — medly + majority vote in comment-resolution-check workflow". The bead description points back at this file; the impl PR closes it.

---

## Appendix — references

| Thing | Path |
|---|---|
| CRC SPEC (parent) | `winston/workspaces/comment-resolution-check/SPEC.md` |
| CRC workflow.yaml (today) | `bureau/workflows/comment-resolution-check/workflow.yaml` |
| CRC schema | `bureau/workflows/comment-resolution-check/schemas/crc.schema.json` |
| CRC review prompt | `bureau/workflows/comment-resolution-check/prompts/review.md` |
| Struct-output retry storm bug | `winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` |
| Completeness-check workflow (template) | `bureau/jurisdictions/austin/workflows/completeness-check/workflow.yaml` |
| Completeness-check consolidate script (fork source) | `bureau/jurisdictions/austin/workflows/completeness-check/scripts/cross-run-consolidate-cc.ts` |
| Completeness-check build-review-comments (fork source for the modifications) | `bureau/jurisdictions/austin/workflows/completeness-check/scripts/build-review-comments.ts` |
| CityHall consumer of agent_trace (formal review) | `cityhall/src/routes/(app)/project/[projectId]/review/CommentCard.svelte` |
| CityHall "Run voting" card (target UX for CRC) | `cityhall/src/routes/(app)/project/[projectId]/review/CompletenessCommentCard.svelte` |
| CityHall review-page routing branch (where CRC gets routed to the right card) | `cityhall/src/routes/(app)/project/[projectId]/review/[reviewId]/[sectionId]/+page.svelte` |
