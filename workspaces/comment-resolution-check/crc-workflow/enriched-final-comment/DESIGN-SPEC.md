# CRC `enrichedFinalComment` — Design Spec

> **Status:** Draft, 2026-06-30. Iteration on top of the
> [CRC SPEC](../../SPEC.md), the
> [crc-workflow DESIGN-SPEC](../DESIGN-SPEC.md), the
> [majority-vote DESIGN-SPEC](../majority-vote/DESIGN-SPEC.md), and the
> [uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md).
> Drives a bureau PR (workflow + script + prompt + schema) and a thin
> cityhall PR (Vercel-gated read of the new field with fallback).

---

## 1. Summary

Add a new agentic workflow step — **`enrich-final-comment`** — to the
`comment-resolution-check` Conductor workflow that synthesizes the
per-run agent trace (`explanation` + `observation` + `reasoning` +
`evidenceLocations`) of the **winning cohort** into a single
applicant-facing paragraph per atomic item. The synthesized prose is
written to a new field, `review_comments.output_json.comments[].enrichedFinalComment`,
alongside the existing terse `comment` (which is unchanged — still the
verbatim winning-run `explanation`).

The existing `comment` is 6–30 words and frequently insufficient — it
states the verdict but rarely conveys *what the agent looked at*, *what
it saw*, and *why that drove the verdict*. The enriched field merges
those signals into 1–4 sentences, applicant-friendly, free of
implementation-detail leakage (no tool names, block IDs, file paths,
UUIDs, internal idioms like `blocks.md` / `facts.md` / "U0" / "U1" /
"MCR"). For `uncertain` items it presents both sides of the dispute
plus a synthesis sentence on why the verdict is uncertain.

**Failure isolation is first-class.** A single comment failing
enrichment (lint reject after one retry, API error, schema validation)
nulls out only that comment's `enrichedFinalComment` and lets the
existing `comment` field carry the UI. The workflow step never fails
the whole run.

This is implemented in two layers: (a) the agent's normal "soft
failure" path always returns a schema-valid response with
`enrichedFinalComment: null` + `source.failureReason`, so the cell is
treated as a success by Conductor; (b) for the residual case of true
hard cell failure (transport exhaustion past `retries`, structured-output
deserialization failure), the step relies on a Conductor
`continueOnFailure: true` primitive that does not yet exist in
`step-executor.ts` — a prerequisite Conductor PR introduces it. Without
that primitive, a single hard-failed cell halts the whole workflow at
`engine.ts:371–376`. See §6.7 for the dependency.

CityHall reads `enrichedFinalComment` behind a Vercel feature flag,
falling back to `comment` when null or when the flag is off. No DB
migration — the new field rides inside the existing
`review_comments.output_json` JSONB blob.

## 2. Goals

- **Lift comment quality without changing the verdict.** Status,
  citation, sheet refs, vote breakdown, source findings — all
  unchanged. Only the displayed prose gets richer.
- **Bring agent-trace signal to the applicant.** Today the
  observation + reasoning fields are debugging artifacts buried in
  `sourceFindings`. The enrichment step is the laundering layer that
  turns those into applicant-safe prose.
- **Surface real evidence locations in the prose.** Sheet number + sheet
  name (e.g. `"Sheet C-2.1 (Striping Plan, page 12)"`) appear inline,
  not just as chips, so the applicant knows *where* the verdict came
  from without bouncing eyes to a sidebar.
- **First-class uncertain UX.** Uncertain comments get a
  for/against/synthesis structure so the applicant can see the
  dispute on its own terms rather than a single-run snippet.
- **Vercel-gateable, zero-risk rollout.** The DB always has both
  `comment` and `enrichedFinalComment`; the UI chooses which to
  render. Easy on/off, easy A/B.
- **Graceful per-comment failure.** No single bad enrichment can break
  a workflow run or a department's comments. Failure → field is null →
  UI falls back to `comment`.

## 3. Non-goals (this spec)

- **Changing `comment`, `status`, `citation`, `sheetReferences`,
  `voteBreakdown`, `confidence`, or `sourceFindings`.** Existing fields
  are unchanged. The enriched field is purely additive.
- **Changing the review agent's prompt or per-run schema.** The
  enrichment step reads consolidated output; the review agent's job is
  unchanged.
- **Backfilling enriched comments on past runs.** No backfill script
  in iter-1. We accept that older `review_comments` rows have
  `enrichedFinalComment` absent — UI falls back to `comment` for those.
  Backfill can be a follow-up if we find we want it.
- **Per-run enrichment.** The enrichment lives on the consolidated
  comment object; individual `sourceFindings[0].perRunFindings[]`
  entries are NOT enriched (they remain raw `comment` = raw per-run
  `explanation`). Only the top-level comment gets the enriched field.
- **PDF report skill (`generate-crc-report`) changes.** The PDF can
  pick up `enrichedFinalComment` in a follow-up. Not in this spec.
- **Streaming / structured output validation beyond a simple length +
  forbidden-terms lint.** The enrichment is prose; we don't try to
  parse it.
- **Cost-bounded selective enrichment.** We always enrich (Q17). If
  the output looks similar to `explanation`, that's fine — no
  unanimous-resolved shortcut.

## 4. Background

### 4.1 What the applicant sees today

Cityhall's `CompletenessCommentCard` renders, for each
`review_comments` row:

- **`output_json.title`** — short noun-phrase label (4–12 words) from
  `rephrase-titles`.
- **`output_json.status`** — verdict badge (`resolved` / `failed` /
  `not-applicable` / `uncertain`).
- **`output_json.comment`** — the verbatim winning-run `explanation`,
  6–30 words. **This is the field this spec enriches.**
- **`output_json.citation`** — code-citation chip (e.g.
  `DCM Fig. 9-2`).
- **`output_json.sheets`** — sheet refs chip (e.g. `Sheet 14`).
- **`output_json.sourceFindings[0].perRunFindings[]`** — collapsible
  "Run voting" panel showing each run's verdict + per-run
  `comment` (renamed from agent's `explanation`) + agent trace
  (`observation`, `reasoning`).
- **`output_json.voteBreakdown` + `confidence`** — when present, a
  consensus-status callout.

The 6–30-word `comment` is the first prose the applicant reads. It is
frequently terse to the point of being unhelpful — e.g. `"Sheet 9
parking note missing required dimension"` tells the applicant the
verdict but not *what the agent checked*, *what it saw*, or *whether
the agent considered an alternative*.

### 4.2 What signal is available (and currently hidden)

Each run's structured-output result (per `crc.emit.schema.json`) carries:

- **`explanation`** — 6–30 word verdict summary (becomes
  `output_json.comment`).
- **`observation`** — what the agent saw on which sheets. Specific,
  prose. Often the highest-density applicant-relevant signal.
- **`reasoning`** — how the observations drove the verdict.
- **`tools_used`** — array of tool names (e.g.
  `["crc-vision-check"]`). Internal.
- **`evidenceLocations`** — `{ documentId, sheetNumber, label }[]`.
  Sheet number + sheet name come from here.

`cross-run-consolidate-crc` already preserves all of these
per-run in `consolidated-findings.json` (when `runs > 1`) under
`perRunFindings[]`, and on the winning finding under `winningFinding`.

### 4.3 Why a dedicated step, not an embedded synth in `build-crc-review-comments`

`build-crc-review-comments` is a pure assembly script. Inserting an
LLM call into it would entangle deterministic output assembly with a
flaky network call and force its retry semantics to mirror the agent
step's. Splitting `enrich-final-comment` out keeps the assembly script
pure, lets the agent step use Conductor's standard
fan-out + retries + maxWorkers machinery, and produces a sidecar JSON
file (`output/enriched-final-comments.json`) that's easy to inspect
in workflow-run artifacts.

## 5. Design decisions (locked)

| #   | Decision | Choice | Rationale |
|-----|---|---|---|
| D1  | Field name | **`enrichedFinalComment`** on each comment object inside `output_json.comments[]` | Q13. Names the intent. `enriched` distinguishes from the raw `comment`; `Final` signals "this is the applicant-facing render target." |
| D2  | Field placement | Top-level comment field only; **NOT** propagated to `sourceFindings[0].perRunFindings[]` | Q13. Per-run findings stay raw; only the consolidated comment is enriched. |
| D3  | DB shape | New field inside existing `review_comments.output_json` JSONB blob; **no migration** | Q14. Review-saver passes through unknown fields. |
| D4  | Default value when not produced / fails / not enriched | **`null`** (or absent — UI treats both as fallback) | Q1. UI falls back to `comment` cleanly. |
| D5  | Cityhall read | **Vercel feature flag**; flag off → render `comment` as today; flag on → render `enrichedFinalComment` when present, fall back to `comment` when null/absent | Q14. Zero-risk staged rollout, easy A/B. |
| D6  | Step ordering | New step `enrich-final-comment` runs **after `cross-run-consolidate-crc` and `enrich-findings`, before `build-crc-review-comments`** | Q1. `build-crc-review-comments` then merges `enriched-final-comments.json` into the comment objects. |
| D7  | Fan-out granularity | **One agent cell per atomic comment** (per-comment fan-out via `checklistItems` glob over the prepared input files) | Q2. Tightest prompt scoping, simplest schema, per-item failure isolation, no concurrent-write management. Tradeoff: more total calls; mitigated by Haiku 4.5 default + bumped `maxWorkers`. |
| D8  | Pre-fan-out preparation | New script step **`prepare-enrichment-inputs`** writes one `output/enrichment-inputs/{ref}.json` per atomic item from `consolidated-findings.json` + `enriched-findings.json` | The agent step needs one input file per cell for `checklistItems` globbing. |
| D9  | Concurrency | New workflow input **`enrichmentMaxWorkers`**, default **50** | Per-comment fan-out → ~80–150 cells; default needs to be higher than review's 13 to avoid wall-clock blowup. |
| D10 | Model | New workflow input **`enrichmentModel`**, default **`claude-haiku-4-5-20251001`** | Q16. Cheap, fast, sufficient for short prose synthesis. Configurable so we can A/B against Sonnet. |
| D11 | Effort | New workflow input **`enrichmentEffort`** (optional) | Mirrors `review.effort` plumbing; haiku ignores effort, so safe-no-op by default. |
| D12 | Opt-out | New workflow input **`enrichComments`**, default **`true`** | Q3. Skips the prep + agent + merge steps when `false`. |
| D13 | Single-run path (`runs=1`) | **Still enrich** | Q6. The single run's observation/reasoning is still richer than its explanation. The cohort is just `[run-1]`. No uncertain handling needed (single-run is never uncertain by D6 of uncertain-status). |
| D14 | Cohort selection (`resolved` or `failed`) | **Only runs whose per-run status matches the consolidated status** | Q4. For 2-failed/1-resolved (66% agreement, above 65% threshold → consolidated `failed`), only the 2 failed runs feed the enrichment. The dissenting `resolved` run is invisible. |
| D15 | Cohort selection (`uncertain`) | **All runs**, grouped by per-run status into `failed` cohort vs. `resolved` cohort | Q5. With only 2 agent-emitted statuses (`resolved`, `failed`), there are at most 2 cohorts to present. |
| D16 | Prose structure (`resolved` / `failed`) | **1–2 sentences framing what the comment asks for and what the agent checked/observed; 1 sentence stating the verdict and (for failed) the corrective direction.** Single paragraph, no headings, no bullets, no markdown. Soft length target ~10–70 words; **no lower bound** | Q8, Q12. A 10-word enrichment is fine when sufficient; expand to 50–70 only when needed for coherence. |
| D17 | Prose structure (`uncertain`) | **1 sentence framing the comment; 1–2 sentences describing what the disputing cohorts each saw / reasoned; 1 sentence concluding why the verdict is `uncertain`.** Single paragraph; soft length target ~40–90 words; no markdown | Q12. The for/against structure makes the dispute legible without leaking run mechanics. |
| D18 | Sheet-citation format inline | **`"Sheet C-2.1 (Striping Plan, page 12)"`** preferred; bare `"Sheet C-2.1"` when label is unknown | Q9. Sheet number + sheet name + page when available; falls back gracefully. |
| D19 | Sheet citation when cohort runs cite different sheets | **Union of distinct `evidenceLocations` from the winning cohort.** Agent decides which to mention inline based on relevance; required to mention at least one when the cohort cited any | Q9. Prevents the agent from inventing sheet refs. |
| D20 | Code-citation weave | **Allowed and encouraged when the codeCitation came from the MCR comment** (i.e. from the finding's `codeCitation` field). Phrase inline as authoritative reference: `"…required by DCM Fig. 9-2"` | Q11. Reinforces the verdict's regulatory anchor. |
| D21 | Tool-trace translation | **Tool names forbidden; translate intent into plain English.** `tools_used=["crc-vision-check"]` → `"Visual review of Sheet C-2.1…"` or `"Inspection of the U1 plan sheet…"`. `tools_used=["semantic-search-blocks"]` → `"A search across the plan set…"` or omitted entirely | Q7. The agent transforms tool usage into evidence-grounded prose. |
| D22 | Forbidden terms list | **First-person framing** ("I checked…", "I found…"), **run references** ("Run 2…", "across three runs…"), **internal IDs / paths** (UUIDs, document IDs, project IDs, `projects/<id>/…`), **internal idioms** (`blocks.md`, `facts.md`, `U0`, `U1`, `MCR`, "checklist item", "atomic item"), **tool literal strings** (`crc-vision-check`, `semantic-search-blocks`, `StructuredOutput`) | Q10 + this-spec confirmation. Replacement guidance below in §6.4. |
| D23 | Lint-fail handling | **Agent self-checks once and rewrites**; on second self-check failure, the agent **emits a schema-valid response** with `enrichedFinalComment: null` and `source.failureReason = "lint-failed"`. The cell still returns success to Conductor. | Q15 + audit. Soft-failing inside a schema-valid response keeps Conductor's per-cell view as "success" and avoids tripping the agent step's failure path on routine lint rejects. |
| D24 | Agent step retries | `retries: 3` at the Conductor step level | Bumped from 1 → 3 to cover transient API errors before Conductor sees a hard cell failure. D23 handles lint inside the prompt-handler; this budget is purely network/API. |
| D24a | Hard-failure tolerance (Conductor primitive) | Step uses **`continueOnFailure: true`**, which requires a prerequisite Conductor PR adding the field to agent-step schema + executor. Without it, one cell exhausting `retries` halts the entire workflow at `engine.ts:371–376`. | Audit. Closes the residual hard-failure case that D23 + D24 can't cover from inside the agent (deserialization failure, transport exhaustion). |
| D25 | Always-enrich | **Yes**, no unanimous-resolved shortcut | Q17. UX consistency + we're not optimizing cost in iter-1. |
| D26 | Output file | `output/enriched-final-comments.json` — flat object `{ ref: { enrichedFinalComment: string | null, source: { cohortRuns: string[], cohortSize: number, prosePattern: 'single-cohort' | 'uncertain' } } }` | Single file for easy inspection and merge into `build-crc-review-comments`. |
| D27 | Merge into review-comments.json | `build-crc-review-comments` reads `enriched-final-comments.json` (if present) and stamps `enrichedFinalComment` per comment via the existing `checklistRef` key | Mirrors the existing `consolidatedFile` plumbing. Absent file → all comments get `enrichedFinalComment: null`. |
| D28 | Metadata stamp | `output_json.metadata.enrichmentVersion: "1.0"` written whenever any comment in the run has a non-null `enrichedFinalComment` | Q13. Lets us detect schema drift across iterations without joining workflow inputs. |
| D29 | Inputs available to the enrichment agent | Per-cohort-run `{ explanation, observation, reasoning, tools_used, evidenceLocations }`; finding-level `{ requirement, codeCitation, evidenceExpected, severity }`; consolidated `{ status, tentativeStatus, voteBreakdown, confidence }` | Q7 + Q11 + Q12. Enough context to ground the prose without re-reading the guide. |

## 6. Implementation plan

### 6.1 Workflow.yaml changes

Add four new inputs:

```yaml
inputs:
  # ... existing inputs ...
  enrichComments:
    type: boolean
    required: false
    default: true
    description: |
      When true (default), run the enrich-final-comment step to
      synthesize a longer applicant-facing comment from the winning
      cohort's agent trace, written to
      output_json.comments[].enrichedFinalComment. When false, skip
      the prep + agent + merge steps; enrichedFinalComment is null
      on every comment and cityhall falls back to comment.
  enrichmentModel:
    type: string
    required: false
    default: claude-haiku-4-5-20251001
    description: |
      Model for the enrich-final-comment agent. Default Haiku 4.5 —
      short prose synthesis with tight constraints, no tools, no
      structured-output retry storm. Override to Sonnet for quality
      A/B.
  enrichmentEffort:
    type: string
    required: false
    description: |
      Agent effort level for the enrichment agent. Only applied for
      models that support it. Haiku 4.5 ignores effort.
  enrichmentMaxWorkers:
    type: number
    required: false
    default: 50
    description: |
      Max concurrent enrichment-agent workers across atomic items.
      Default 50 to keep wall-clock low under per-comment fan-out
      (~80–150 cells per project). Bump if a project has many
      comments and Inngest budget allows.
```

Insert three new steps between `enrich-findings` and `rephrase-titles`:

```yaml
  # Step 3.5a — prepare per-atomic-item input files for enrichment fan-out.
  # Reads consolidated-findings.json + enriched-findings.json and writes one
  # JSON per atomic item into output/enrichment-inputs/ so the agent step
  # can glob-fan-out and write one output per cell with no concurrent-write
  # management. Skipped when enrichComments=false.
  - name: prepare-enrichment-inputs
    if: "{{ input.enrichComments }}"
    script:
      name: prepare-enrichment-inputs
      args:
        consolidatedFile: "{{ WORKSPACE_PATH }}/output/consolidated-findings.json"
        enrichedFile: "{{ WORKSPACE_PATH }}/output/enriched-findings.json"
        outputDir: "{{ WORKSPACE_PATH }}/output/enrichment-inputs"
        totalRuns: "{{ input.runs }}"

  # Step 3.5b — agent fan-out: one cell per atomic comment. Each agent reads
  # its input file (cohort runs + finding context), writes one output file
  # containing { enrichedFinalComment, source }. Per-comment failure isolation
  # is two-layer: (i) the agent ALWAYS returns a schema-valid response, so
  # lint-fails surface as enrichedFinalComment=null with source.failureReason
  # and the cell reports success to Conductor; (ii) for residual hard cell
  # failure (transport exhaustion past retries, deserialization failure),
  # `continueOnFailure: true` lets the step keep running. NOTE: that field
  # is added to Conductor by the prerequisite PR in §6.7; it is silently
  # ignored by older Conductor builds, so the bureau PR must not merge until
  # the Conductor PR is deployed.
  - name: enrich-final-comment
    if: "{{ input.enrichComments }}"
    agent:
      model: "{{ input.enrichmentModel }}"
      effort: "{{ input.enrichmentEffort }}"
      prompt: enrich-final-comment.md
    checklistItems: "{{ WORKSPACE_PATH }}/output/enrichment-inputs/*.json"
    schema: enriched-final-comment.schema.json
    # `{{ checklistItem }}` is the basename of the matched input file
    # INCLUDING extension (`crc-tpw__TPW-3.1.json`), so the output template
    # must NOT append a trailing `.json` — doing so would write
    # `crc-tpw__TPW-3.1.json.json` and the collector script would miss every
    # cell. See conductor/src/orchestrator/checklist-manager.ts:196.
    output: "{{ WORKSPACE_PATH }}/output/enrichment-results/{{ checklistItem }}"
    retries: 3
    maxWorkers: "{{ input.enrichmentMaxWorkers }}"
    continueOnFailure: true   # requires Conductor PR (§6.7)

  # Step 3.5c — merge per-cell agent outputs into a single
  # enriched-final-comments.json keyed by ref, which build-crc-review-comments
  # then reads. Tolerates missing cell outputs (failed agents) by writing
  # null for those refs.
  - name: collect-enriched-final-comments
    if: "{{ input.enrichComments }}"
    script:
      name: collect-enriched-final-comments
      args:
        resultsDir: "{{ WORKSPACE_PATH }}/output/enrichment-results"
        inputsDir: "{{ WORKSPACE_PATH }}/output/enrichment-inputs"
        outputFile: "{{ WORKSPACE_PATH }}/output/enriched-final-comments.json"
```

Wire the new file into `build-crc-review-comments`:

```yaml
  - name: build-crc-review-comments
    script:
      name: build-crc-review-comments
      args:
        # ... existing args ...
        enrichedFinalCommentsFile: "{{ WORKSPACE_PATH }}/output/enriched-final-comments.json"
```

### 6.2 Scripts

#### `prepare-enrichment-inputs.ts`

**Inputs**: `consolidatedFile` (path), `enrichedFile` (path), `outputDir`
(path), `totalRuns` (number).

**Logic**:

1. Read `enriched-findings.json` to get every `{ grouping.id, finding }`
   pair. This is the source of truth for the universe of atomic items.
2. Read `consolidated-findings.json` if it exists (multi-run path). Index
   by `ref` for cohort lookup.
3. For each atomic item:
    - `ref = "${grouping.id}:${finding.atomicItemId}"`.
    - Determine cohort runs:
        - If `consolidated[ref]` exists:
            - If consolidated status is `resolved` or `failed`: cohort = `perRunFindings.filter(r => r.status === consolidated.status)`.
            - If consolidated status is `uncertain`: cohort = **all** `perRunFindings` (we pass both sides).
            - If consolidated status is `not-applicable` (legacy backfilled data only): cohort = `perRunFindings.filter(r => r.status === 'not-applicable')` — same single-cohort treatment as resolved/failed.
        - If `consolidated[ref]` is missing (`runs=1` passthrough): cohort = synthesize from the enriched finding itself (one synthetic entry `{ run: 'run-1', status, explanation, observation, reasoning, tools_used, evidenceLocations }`).
    - Write `{ref-slug}.json` to `outputDir` containing:
      ```jsonc
      {
        "ref": "crc-tpw:TPW-3.1",
        "grouping": "crc-tpw",
        "atomicItemId": "TPW-3.1",
        "consolidated": {
          "status": "failed" | "resolved" | "not-applicable" | "uncertain",
          "tentativeStatus": "failed" | "resolved" | null,
          "voteBreakdown": { "resolved": 1, "failed": 2, "not-applicable": 0, "missing": 0 },
          "confidence": "high" | "medium" | "low"
        },
        "finding": {
          "requirement": "...",
          "codeCitation": "DCM Fig. 9-2",
          "evidenceExpected": "Sheet C-2.1, striping plan",
          "severity": "required",
          "parentCommentId": "TPW-3"
        },
        "cohorts": {
          // For resolved/failed/not-applicable: only the matching cohort populated.
          // For uncertain: both populated, possibly empty if no runs voted that side.
          "failed":   [ { "run": "run-1", "explanation": "...", "observation": "...", "reasoning": "...", "tools_used": [...], "evidenceLocations": [...] } ],
          "resolved": [ ]
        },
        "prosePattern": "single-cohort" | "uncertain"
      }
      ```
    - Input filename = `{ref-slug}.json`, where `ref-slug` = `ref` with
      `:` → `__`, safe for filesystem.

The `{{ checklistItem }}` template expands to the matched input file's
basename including extension (e.g. `crc-tpw__TPW-3.1.json`) — see
`conductor/src/orchestrator/checklist-manager.ts:196` (`path.basename`)
and `template-engine.ts:144`. We exploit that by giving inputs `.json`
and using `{{ checklistItem }}` with no trailing `.json` as the agent
step's `output:` template, so the per-cell result file lands at
`enrichment-results/crc-tpw__TPW-3.1.json`. The collector script
therefore looks up `resultsDir/{ref-slug}.json` (i.e.
`resultsDir/{checklistItem-basename}`) and the keying is direct.

#### `collect-enriched-final-comments.ts`

**Inputs**: `resultsDir` (path), `inputsDir` (path), `outputFile` (path).

**Logic**:

1. Read every `*.json` in `inputsDir` to get the canonical universe of
   refs (so we always emit an entry for every atomic item, even if the
   agent skipped or failed).
2. For each ref:
    - Look up the corresponding `resultsDir/{slug}.json`.
    - If present and contains a non-null `enrichedFinalComment`: copy
      verbatim along with its `source` metadata.
    - If absent or `enrichedFinalComment` is null: write
      `{ enrichedFinalComment: null, source: { failureReason: 'agent-failed' | 'lint-failed' | 'absent' } }`.
3. Write `outputFile` as a flat map keyed by `ref`.

#### `build-crc-review-comments.ts` (modification)

1. New optional arg `--enrichedFinalCommentsFile`. Load and index by
   `ref` when present.
2. For each comment, set `enrichedFinalComment` from the lookup
   (defaulting to `null` when not present).
3. If **any** comment in the run gets a non-null `enrichedFinalComment`,
   set `output.reviewData.metadata.enrichmentVersion = '1.0'`.

### 6.3 Schema — `enriched-final-comment.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CRC Enriched Final Comment",
  "type": "object",
  "required": ["enrichedFinalComment", "source"],
  "additionalProperties": false,
  "properties": {
    "enrichedFinalComment": {
      "type": ["string", "null"],
      "description": "Applicant-facing synthesized comment. Null when the agent could not produce a compliant string (lint retry exhausted, content empty)."
    },
    "source": {
      "type": "object",
      "required": ["cohortRuns", "cohortSize", "prosePattern"],
      "additionalProperties": false,
      "properties": {
        "cohortRuns": {
          "type": "array",
          "items": { "type": "string", "pattern": "^run-\\d+$" }
        },
        "cohortSize": { "type": "integer", "minimum": 0 },
        "prosePattern": {
          "type": "string",
          "enum": ["single-cohort", "uncertain"]
        },
        "lintRetried": { "type": "boolean" },
        "failureReason": {
          "type": ["string", "null"],
          "enum": [null, "lint-failed", "empty-output"]
        }
      }
    }
  }
}
```

### 6.4 Prompt — `prompts/enrich-final-comment.md`

The prompt is short. Sketch:

> You are synthesizing one applicant-facing comment for a single
> atomic item in a Comment Resolution Check. You will receive the
> consolidated verdict (`resolved` / `failed` / `not-applicable` /
> `uncertain`), the finding context, and a cohort of runs to draw
> from.
>
> **You produce one paragraph of plain prose. No bullets, no
> headings, no markdown.**
>
> **Structure depending on `prosePattern`:**
>
> *single-cohort* (`resolved` / `failed` / `not-applicable`):
>
> 1. 1–2 sentences framing what the city's comment asks for and what
>    was checked/observed. Use sheet number + sheet name where the
>    cohort cited evidence — e.g. `"Sheet C-2.1 (Striping Plan, page
>    12) was reviewed for the required hydrant offset…"`.
> 2. 1 sentence stating the verdict and (for `failed`) the corrective
>    direction.
>
> *uncertain*:
>
> 1. 1 sentence framing the city's comment.
> 2. 1–2 sentences describing what the disputing cohorts each
>    checked / observed / reasoned. Group by per-run status (failed
>    cohort vs. resolved cohort) but never mention runs.
> 3. 1 sentence stating that the verdict is uncertain in light of the
>    dispute.
>
> **Length**: as short as ~10 words is fine when sufficient; expand
> to 50–90 only when needed for coherence. Pure padding is forbidden.
>
> **Citation weave**: when the finding has a `codeCitation` (it
> originated in the city's MCR comment), reference it inline where it
> reinforces the verdict — e.g. `"…required by DCM Fig. 9-2"`. Don't
> manufacture citations.
>
> **Forbidden terms / framings — never emit:**
>
> | Forbidden | Replacement |
> |---|---|
> | First-person (`"I checked…"`, `"I found…"`) | Third-person passive (`"The plan shows…"`, `"Sheet 12 was reviewed…"`) |
> | Run references (`"Run 2…"`, `"across three runs…"`) | Aggregate framing (`"Review of Sheet 12…"`); for uncertain, group by verdict not by run |
> | `crc-vision-check` / `semantic-search-blocks` / `StructuredOutput` (tool literal strings) | Translate to intent — `"Visual review of Sheet C-2.1…"` or `"A search across the plan set…"` |
> | `blocks.md`, `facts.md`, the words `"block"` or `"section block"` referring to data structures | `"The section on Sheet 12 covering…"`, `"Zoning research of the site indicates…"` |
> | Internal idioms: `U0`, `U1`, `MCR`, `"checklist item"`, `"atomic item"` | `"original plan set"`, `"revised plan set"`, `"the city's comment"`, `"this requirement"` |
> | UUIDs, document IDs, project IDs, paths like `projects/<id>/…` | Don't reference them at all |
>
> Output: a JSON object with `enrichedFinalComment` (the prose string)
> and `source` (cohortRuns, cohortSize, prosePattern). Call
> `StructuredOutput` with these as top-level parameters.
>
> **Self-check before emitting**: scan your draft for any forbidden
> term. If you spot one, rewrite. If after one rewrite a forbidden
> term remains, emit a schema-valid response with
> `enrichedFinalComment: null` and `source.failureReason = "lint-failed"`.
> **Never throw, never refuse, never emit an out-of-schema response.**
> A soft null is always the right fallback; it is the contract that
> lets the surrounding workflow continue.

The script-side post-validation runs the forbidden-terms regex list
as a belt-and-suspenders check (D23). If the agent's self-rewrite
passes its own check but the script-side check still trips, the
collector (`collect-enriched-final-comments`) overwrites the field
with `enrichedFinalComment: null` + `source.failureReason =
"lint-failed"` before merging. No second agent retry — D24's network
retry budget is purely for transient API failures, not lint.

### 6.5 Cityhall changes

Behind a Vercel feature flag `NEXT_PUBLIC_CRC_ENRICHED_COMMENT` (or
similar — naming up to cityhall):

- `CompletenessCommentCard.svelte` reads
  `comment.enrichedFinalComment ?? comment.comment` when the flag is
  on; reads `comment.comment` when the flag is off.
- No type changes; the prop already passes through the entire
  `output_json.comments[]` entry.
- Confirm the existing markdown renderer (or plain-text renderer)
  works with the longer paragraph; the comment field is currently
  short, so verify no width / overflow regression on cards that grow
  from 30 words to ~90.

### 6.6 Forbidden-terms regex list (post-validation lint)

Maintained in `consolidate-logic.ts`-adjacent (or a new
`enrichment-lint.ts`) so a test can pin the list:

```ts
export const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(I|me|my)\b/, reason: 'first-person' },
  { pattern: /\brun[- ]?\d+\b/i, reason: 'run-reference' },
  { pattern: /\bacross (?:two|three|all) runs\b/i, reason: 'run-reference' },
  { pattern: /\bcrc-vision-check\b/i, reason: 'tool-name' },
  { pattern: /\bsemantic-search-blocks\b/i, reason: 'tool-name' },
  { pattern: /\bStructuredOutput\b/, reason: 'tool-name' },
  { pattern: /\bblocks\.md\b/i, reason: 'internal-path' },
  { pattern: /\bfacts\.md\b/i, reason: 'internal-path' },
  { pattern: /\b(U0|U1)\b/, reason: 'internal-idiom' },
  { pattern: /\bMCR\b/, reason: 'internal-idiom' },
  { pattern: /\b(checklist item|atomic item)\b/i, reason: 'internal-idiom' },
  { pattern: /\bprojects\/[a-z0-9-]+\//i, reason: 'internal-path' },
  { pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, reason: 'uuid' },
];
```

Pinned by a unit test that asserts every reason has at least one
forbidden example and one allowed neighbor (e.g. `"Sheet 4"` is
allowed, `"block 4"` near `blocks.md` is forbidden).

### 6.7 Conductor prerequisite PR (`continueOnFailure` on agent steps)

The fan-out step's failure-isolation guarantee depends on a Conductor
primitive that does not exist today. Concretely:

- `conductor/src/orchestrator/step-executor.ts:1016–1022` returns
  `success: false` from a parallel agent step whenever any cell has
  `failed > 0` after retries.
- `conductor/src/orchestrator/engine.ts:371–376` then `break`s out of
  the step loop on `success: false`, halting the entire workflow
  (including the downstream `rephrase-titles`, `upload-titles-cache`,
  `build-crc-review-comments`, and the review-save).

D23 makes the *agent* always return a schema-valid response, so the
common "lint reject" path no longer counts as a cell failure. But the
residual hard-failure cases (structured-output deserialization
failure, transport exhaustion past `retries: 3`) still hit the path
above and would cascade. To close that gap, a small Conductor PR
introduces a `continueOnFailure: boolean` field on the agent-step
schema (`types.ts`) and threads it through `step-executor.ts` so that
when set, the step returns `success: true` with a summary of failed
cells instead of `success: false`.

**Dependency ordering:**

1. Conductor PR lands and is deployed to the Substation pool that
   runs CRC.
2. Bureau PR (this spec) merges. The bureau workflow.yaml uses
   `continueOnFailure: true`, which a pre-prereq Conductor would
   silently ignore (unknown YAML key) — so merging out of order means
   one bad cell still halts the workflow until the Conductor side
   catches up. Hold the bureau PR behind the Conductor deploy.
3. Cityhall PR can land any time after step 2.

## 7. Failure modes & risks

| Risk | Mitigation |
|---|---|
| Lint rejects too aggressively (legit prose contains a forbidden bigram) | Pinned regex tests + a "release valve" — operator can disable the lint via a workflow input in a follow-up if false-positive rate is high. Iter-1 ships with the strict list. |
| Haiku 4.5 over-pads / under-delivers | A/B against Sonnet via `enrichmentModel` workflow input. Default is Haiku because most enrichments will be short blends. |
| Per-comment fan-out blows out Inngest 3-hour cap | `enrichmentMaxWorkers=50` default keeps ~150-comment runs under ~10 minutes at Haiku throughput. If we see slow runs, bump default. |
| `consolidated-findings.json` absent (runs=1 path) | `prepare-enrichment-inputs` synthesizes a single-run cohort from `enriched-findings.json`. Tested as a first-class path. |
| `not-applicable` legacy data | D14 / `prepare-enrichment-inputs` treats `not-applicable` consolidated like `resolved`/`failed`: single-cohort enrichment from `not-applicable` runs only. New data won't hit this branch (post-comment-triage-rework 2-state enum). |
| Agent leaks `documentId` UUIDs into prose | UUID regex in D29 forbidden list + the prompt explicitly tells the agent never to surface IDs, only sheet number + label. |
| `evidenceLocations` empty across the cohort (rare — moot resolved) | Allowed; agent omits sheet-citation phrasing and produces a verdict-only sentence (e.g. `"The feature this comment addresses has been removed from the revised plan set; the comment is moot."`). |
| Cityhall renders longer text in a card sized for 30 words | Cityhall PR checks card overflow; if needed, add a max-height with read-more, or stack the title above. UI change isolated behind the feature flag. |
| Enrichment quality regression on a future model bump | The metadata stamp `enrichmentVersion: "1.0"` lets us bump to `"1.1"` when prompt changes meaningfully. Tooling can compare versions across runs to A/B. |
| The `comment` field stops being meaningful because we never look at it | We deliberately keep `comment` unchanged. UI fallback path keeps it load-bearing for unenriched rows, off-flag rendering, and debug tooling. |
| Bureau PR ships before the Conductor `continueOnFailure` PR is deployed | YAML field is silently dropped (unknown key); one hard-failed enrichment cell halts the entire workflow at `engine.ts:371–376`, losing the run and the save. Mitigation: hold the bureau PR behind the Conductor deploy (§6.7 dependency ordering). Defense-in-depth: the agent's always-valid-schema contract (D23) means routine lint rejects never trip this path even if the Conductor PR slips. |
| Transient API error past `retries: 3` on a single cell | With `continueOnFailure: true`, the cell's output file is absent → `collect-enriched-final-comments` writes `enrichedFinalComment: null` with `source.failureReason = 'agent-failed'`. Without `continueOnFailure` (pre-Conductor-PR), the workflow halts — see row above. |

## 8. Out-of-scope follow-ups (future work)

- **PDF report (`generate-crc-report`)** — pick up `enrichedFinalComment`
  in the rendered PDF. The PDF currently prints `comment`; flag-gated
  swap once cityhall UX validates.
- **Backfill of historical CRC runs.** A standalone script can replay
  the enrichment step against `output_json.sourceFindings[]` of
  existing rows. Iter-2 if we want it.
- **Per-run enrichment** (richer prose inside the "Run voting" panel).
  Not done in iter-1 — the panel is debugging-oriented and the raw
  per-run `comment` is fine there.
- **Selective enrichment** (skip when unanimous-resolved + single
  sheet). Adds branching complexity for limited cost win at Haiku
  prices. Revisit when we have run data.
- **Forbidden-term auto-correction** instead of null-out. Iter-1 keeps
  the lint binary; an iter-2 pass could try sentence-level rewrite.
- **Telemetry**: per-run lint-failure rate, per-run cohort-empty rate,
  per-model length distribution. Add when the field is on for >0%
  of UI rollout.

## 9. Test plan

- **Unit (`prepare-enrichment-inputs`)**:
    - runs=1 passthrough produces single-run cohort from
      `enriched-findings.json`.
    - runs=3 + consolidated `failed` (2/1 split): cohort contains
      only the 2 failed runs.
    - runs=3 + consolidated `uncertain` (1/1/1 or 1/2 below
      threshold): cohort contains all runs grouped by status.
    - `not-applicable` legacy consolidated status maps to
      single-cohort.
- **Unit (`collect-enriched-final-comments`)**:
    - Missing cell file → entry with
      `failureReason: 'agent-failed'`.
    - Cell file with `null` enrichedFinalComment → carried through
      with the agent's `source.failureReason`.
- **Unit (forbidden-terms lint)**:
    - Pinned list — each pattern has a forbidden example + an allowed
      near-neighbor.
    - `"Sheet 4"` allowed.
    - `"block 4"` allowed (we don't forbid the bare word `block` —
      only `blocks.md` and `section block`).
    - `"DCM 5.3.1"` allowed.
- **Integration (smoke)**:
    - `runs=1`, single department, ~4 atomic items: every comment
      has a non-null `enrichedFinalComment`. Forbidden terms absent.
    - `runs=3`, single department with one forced 1/1/1 split:
      verify uncertain comment uses the uncertain prose structure.
- **Failure injection**:
    - Force one agent cell to return an invalid schema → that one
      ref ends up `null`, others unaffected.
- **Cityhall**:
    - Flag off: card renders `comment` exactly as today.
    - Flag on: card renders `enrichedFinalComment` when present;
      falls back to `comment` when null.
    - Visual: card height with a 90-word enrichment doesn't break
      the section grid.

## 10. Rollout plan

0. **Conductor PR (§6.7) merged and deployed** to the Substation pool
   that runs CRC. This is a hard prerequisite — the bureau PR's
   `continueOnFailure: true` is silently dropped by older Conductor
   builds, and one hard cell failure would halt the run.
1. Bureau PR merged; workflow defaults `enrichComments: true` from the
   first deploy. (Cityhall flag is off, so UI doesn't change.)
2. Run on 1–2 active projects; inspect
   `output/enriched-final-comments.json` artifacts manually for
   quality + lint-failure rate.
3. If quality looks good and lint-failure rate < ~5%, ship the
   cityhall flag on for the team account; eat dog-food for a week.
4. If still good, default the cityhall flag on for all accounts; keep
   the flag for emergency-off.
5. Revisit model choice (Haiku → Sonnet?) based on quality + cost
   data. Update `enrichmentModel` workflow input default if needed
   (no schema change).

## 11. Open questions

- Should the prompt include 2–3 worked examples (good + bad enriched
  comments)? Likely yes; deferred to prompt-authoring time. The spec
  doesn't pin them since the calibration set will grow.
- Does the forbidden-terms list want to be data-driven (JSON file in
  bureau) or code-pinned? Code-pinned for iter-1 — a JSON file is the
  refactor we do when the list is changing often.
- Should we surface `enrichedFinalComment` in CSV / JSONL exports?
  Iter-1 keeps the field UI-only; an export switch can be a follow-up.

---

## Appendix A — Example enriched comments

### A.1 `failed`, single sheet cited, with code citation weave

**Inputs**:

- Finding: `requirement = "Verify on-street parking is dimensioned ≥15 ft from either side of fire hydrants per TCM 9.2.3.1.B"`, `codeCitation = "DCM Fig. 9-2"`, `severity = "required"`.
- Cohort (2 failed runs):
    - run-1 observation: `"Sheet C-2.1 striping plan shows parking spaces directly adjacent to the southside hydrant at station 12+45. No dimension callout."`, evidenceLocations: `[{ sheetNumber: 12, label: "Striping Plan (C-2.1)" }]`.
    - run-3 observation: `"Striping plan on page 12 — visual review of the area around the south-frontage hydrant shows no 15 ft offset annotation."`.

**Output**:

> The Striping Plan on Sheet C-2.1 (page 12) was reviewed for the
> required 15 ft offset between on-street parking and the south-frontage
> fire hydrant. No dimension callout or offset annotation is shown
> adjacent to the hydrant, leaving the requirement of DCM Fig. 9-2
> unmet. Add the 15 ft hydrant-offset dimension to the striping plan.

### A.2 `resolved`, moot

**Inputs**:

- Finding: `requirement = "Verify the proposed parking bulb-outs adhere to standard design."`.
- Cohort (3 resolved runs): all explanations like `"Moot — bulb-outs removed in U1."`; observations note the feature was removed in the revised plan; evidenceLocations empty.

**Output**:

> The proposed parking bulb-outs have been removed from the revised
> plan set, so the standard-design requirement no longer applies. The
> comment is moot.

### A.3 `uncertain`, 1/1/1 three-way (one failed, one resolved, one not-applicable legacy)

Skipping for iter-1: post comment-triage-rework, agent emits only
`resolved` / `failed`, so the 1/1/1 case across 3 statuses cannot
occur on new runs. The uncertain prose pattern is exercised by §A.4.

### A.4 `uncertain`, 2 failed / 1 resolved with high dissent threshold

**Inputs**:

- Finding: `requirement = "Confirm 58 ft of ROW is dedicated from existing centerline of S. Lamar per ASMP"`.
- Threshold tuned high (e.g. 0.4 → uncertain when winner ≤ 60%): 2/1 = 66.7% > 60% → still `failed`. Use a hypothetical 1 failed / 1 resolved / 1 resolved at threshold 0.35: winner share 66.7% > 65% → also still `failed`. Genuine uncertain on a 2-state run requires more runs; the typical case is `runs=5` with 3/2.
- Cohort (uncertain, all 5 runs grouped):
    - failed cohort (3): observations cite the survey-tie sheet showing the centerline at offset X; reasoning concludes ROW dedication is short of 58 ft.
    - resolved cohort (2): observations cite the same sheet but read the dedication note as inclusive of an additional 4 ft slope easement, satisfying 58 ft total.

**Output**:

> The revised plan set was checked for 58 ft of ROW dedication from the
> existing S. Lamar centerline as called for by ASMP. Some review
> passes read the survey-tie sheet's dedication note as the
> dedication-only width — coming up short of 58 ft — while others read
> the same note as inclusive of the adjoining slope easement, which
> would satisfy the requirement. Given this disagreement on how to
> interpret the dedication callout, the verdict is uncertain pending
> applicant clarification.

---

> *Drives three PRs landing in order: (1) a prerequisite Conductor PR
> adding `continueOnFailure: boolean` to the agent-step schema +
> executor (see §6.7); (2) a bureau PR (workflow.yaml +
> prepare-enrichment-inputs.ts + collect-enriched-final-comments.ts +
> enrichment-lint.ts + enrich-final-comment.schema.json +
> prompts/enrich-final-comment.md + build-crc-review-comments.ts
> modification + tests); (3) a small cityhall PR (Vercel-flag-gated
> read of `enrichedFinalComment` with fallback to `comment`).*
