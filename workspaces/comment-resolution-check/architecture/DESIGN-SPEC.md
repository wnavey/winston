# CRC Review Step Architecture — how a `review` agent step actually executes

**Status:** Draft v1
**Date:** 2026-07-17
**Repos touched:** none — this is a descriptive architecture spec documenting conductor + bureau as-built (conductor@main 2026-07-17, post-#230; bureau@main post-#597)
**Repos NOT touched:** `conductor`, `bureau`, `substation`, `cityhall`
**Sibling sub-spec:** [`STRUCTURED-OUTPUT-RETRIES.md`](./STRUCTURED-OUTPUT-RETRIES.md) — deep dive on the emit → JSON.parse → retry stack (the inch-mark quote failure lives there)

## Problem

The v5 game-day run audit (`1700-S-Lamar/crc-run-audits/run-6-audit/`) and the inch-mark bug
(`bugs/STRUCT-OUTPUT-UNPARSED-EMIT-VARIANT.md`) raised questions nobody had a single document for:
where do the "5 SDK attempts" live, what is `coercion_failed`, where are retries configured, how much
of the CRC `review` step is conductor code vs bureau config, and is it the same code that
completeness-check and the ensemble review workflow use? This spec answers those questions and maps
the whole review step + every CRC workflow input, so future audits and remediations have a shared
mental model.

Everything below is verified against source with file:line citations. No behavior changes are proposed
here (remediation directions live in the bug doc and sub-spec).

## 1. One-diagram overview

```
 substation (Inngest event) ──► Vercel Sandbox ──► conductor CLI
                                                        │
   bureau clone (workflows, prompts, schemas, scripts)  │
   submission-version staging (projects/{id}/…)         ▼
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ conductor orchestrator (GENERIC — zero CRC-specific logic)               │
 │                                                                          │
 │ engine.ts ── loadWorkflow()                                              │
 │   bureau/jurisdictions/{slug}/workflows/{name}/workflow.yaml            │
 │   └─ fallback: bureau/workflows/{name}/workflow.yaml   ◄── CRC lives here│
 │                                                                          │
 │ step loop ── executeStep()  (step-executor.ts:318-382)                   │
 │   step.script → script runner        step.agent + checklistItems →      │
 │                                      executeParallelAgentStep()          │
 │                                                │                         │
 │   checklist-manager.ts:189-295                 ▼                         │
 │   glob crc-guides/crc-*.md ──► items × runs ──► cells                    │
 │   (24 guides × 5 runs = 120 cells, each {value, runIndex:'run-N'})       │
 │                                                │                         │
 │   worker pool (maxWorkers, e.g. 35) ──► per cell: runAgentForItem()      │
 │            │            outer retry loop: step.retries (CRC: 5),         │
 │            │            exponential backoff, FRESH session per retry     │
 │            ▼                                                             │
 │   runner.ts runAgent() ──► @anthropic-ai/claude-agent-sdk query()        │
 │     prompt: prompts/review.md (rendered + inject files)                  │
 │     tools:  crc-vision-check (conductor built-in),                       │
 │             script:semantic-search-blocks (bureau script via MCP)        │
 │     outputFormat: {type:'json_schema', schema: crc.emit.schema.json}     │
 │            │                                                             │
 │            ▼  agent session: read guide → applicability → evidence       │
 │               (guide.md/blocks.md/vision/search) → StructuredOutput emit │
 │            │                                                             │
 │     SDK in-session emit/parse/validate loop (5 attempts — see sub-spec)  │
 │            │ success                                                     │
 │            ▼                                                             │
 │   normalizeStructuredOutput() — inject `grouping` from cell filename,    │
 │   canonicalize lenient emit → strict {grouping, findings}                │
 │            ▼                                                             │
 │   write output/runs/{runIndex}/findings/{checklistItem}.json             │
 └──────────────────────────────────────────────────────────────────────────┘
                       │
                       ▼  subsequent workflow steps (scripts + small agents)
   cross-run-consolidate-crc → enrich-findings → enrichment fan-out →
   rephrase-titles → build-crc-review-comments → validate-review-output
                       │
                       ▼
   review-saver → reviews / review_sections / review_comments (review_type='crc')
   upload → workflow-runs bucket
```

## 2. Division of labor: conductor vs bureau

**The step executor is 100% generic.** `executeStep()` (`conductor/src/orchestrator/step-executor.ts:318-382`)
branches only on step *shape* (`step.agent` / `step.script` / `step.copy`) — there are no
workflow-name checks anywhere in the execution path. All CRC-specificity lives in bureau's
`workflows/comment-resolution-check/` directory (workflow.yaml + prompts/ + schemas/ + scripts/).

What each side owns for the `review` step:

| Concern | Owner | Where |
|---|---|---|
| Step semantics (fan-out, retries, workers, output writing) | conductor | `step-executor.ts`, `checklist-manager.ts` |
| Agent session mechanics (SDK invocation, structured output, repair) | conductor | `src/agent/runner.ts`, `src/agent/structured-output-repair.ts` |
| `crc-vision-check` tool implementation | conductor | `src/tools/index.ts:185-300` (resolved by tool *name*, not workflow) |
| `semantic-search-blocks` tool implementation | bureau | `workflows/comment-resolution-check/scripts/semantic-search-blocks.ts`, exposed via the generic `script:` tool prefix; optional typed schema from `schemas/{script}.tool-schema.json` |
| What the agent does (methodology, evidence rules, emit rules) | bureau | `prompts/review.md` |
| Emit schema (lenient) + canonical schema (strict) | bureau | `schemas/crc.emit.schema.json`, `schemas/crc.schema.json` |
| Which guides to review | bureau + runtime | `checklistItems` glob over `crc-guides/` fetched from the `crc-guides` Supabase bucket by the `fetch-crc-guides` script |
| Retry counts, worker counts, model | bureau yaml (values) / conductor (mechanism) | `workflow.yaml:161-188` |

The only conductor code that knows the *word* "crc" is the `crc-vision-check` tool registration —
a named built-in in the tool registry, selected by the yaml's `tools:` list exactly like `vision`
or `site_imagery` for other workflows.

## 3. The `review` step, field by field

From `bureau/workflows/comment-resolution-check/workflow.yaml:161-188`, with the conductor code that
consumes each field:

| yaml field | Value (CRC) | What consumes it |
|---|---|---|
| `agent.model` | `{{ input.model }}` (default `claude-sonnet-5`) | rendered in `step-executor.ts:1289-1307`, passed to SDK `query()` in `runner.ts:298` |
| `agent.effort` | `{{ input.effort }}` | validated against `low/medium/high`; ignored for models without effort |
| `agent.prompt` | `review.md` | `loadPrompt()` (`workflow-loader.ts:265-288`) from the workflow's `prompts/` dir, path-escape confined |
| `tools` | `crc-vision-check`, `script:semantic-search-blocks` | `getTools()` (`tools/index.ts:185-300`) → provided to the agent as MCP servers |
| `inject.untrustedInputContract` | shared bureau prompt fragment | rendered into the prompt template before the session starts |
| `checklistItems` | `{{ WORKSPACE_PATH }}/crc-guides/crc-*.md` | `initializeChecklist()` glob (`checklist-manager.ts:196-200`) — one item per guide file |
| `runs` | `{{ input.runs }}` (game day: 5) | cell multiplication (`checklist-manager.ts:243-262`): items × runs, each tagged `runIndex: 'run-N'` |
| `schema` | `crc.emit.schema.json` (lenient: findings-only, no `grouping`) | `outputFormat: {type:'json_schema', schema}` → SDK (`step-executor.ts:859-864`); post-success canonicalization injects `grouping` (`structured-output-repair.ts:286-336`) |
| `output` | `output/runs/{{ runIndex }}/findings/{{ checklistItem }}.json` | templated write of `result.structured_output` (`step-executor.ts:1330-1361`). NB: `{{ checklistItem }}` = matched file basename INCLUDING extension → files land as `crc-SP-3.md.json` |
| `retries` | `5` | outer per-cell retry budget (`step-executor.ts:1026`, default 2) — see sub-spec §4 |
| `maxWorkers` | `{{ input.maxWorkers }}` (default 13; game day 35) | worker-pool cap in `executeParallelAgentStep()` (`step-executor.ts:1101-1158`) |
| `requiredEnv` | Supabase URL/keys | forwarded into the agent child env (post Sec Wave 9: scoped run token, no service_role) |

A "cell" = (guide file × runIndex). Game day: 24 guides × 5 runs = 120 cells, claimed by up to 35
concurrent workers. Each cell is one full agent session ending in one StructuredOutput emit.

## 4. Same engine, three workflows

Yes — CRC's `review`, completeness-check's `review`, and the ensemble review workflow's `review-runs`
all execute through the **identical** conductor path (`executeStep` → `executeParallelAgentStep` →
`runAgentForItem` → `runAgent`). They differ only in yaml configuration:

| | CRC `review` | CC `review` | review `review-runs` |
|---|---|---|---|
| workflow file | `bureau/workflows/comment-resolution-check/workflow.yaml:161` | `bureau/workflows/completeness-check/workflow.yaml:157` | `bureau/workflows/review/workflow.yaml:123` |
| prompt | `review.md` (CRC's own) | `review.md` (CC's own) | `{{ input.reviewPromptName }}.md` |
| checklist source | `crc-guides/crc-*.md` (fetched from Supabase bucket at runtime by `fetch-crc-guides`) | `bureau/{{ input.checklistsDir }}/*.md` (in-repo) | `bureau/jurisdictions/{slug}/review-guides/{{ guideCode }}/*.md` (in-repo) |
| emit schema | `crc.emit.schema.json` (lenient) | `completeness.emit.schema.json` (lenient) | `{{ input.reviewSchemaName }}.schema.json` |
| tools | `crc-vision-check`, `script:semantic-search-blocks` | (CC's own set) | `vision`, `site_imagery` |
| default model | sonnet | sonnet-class | haiku (3-run ensemble) |
| `retries` | 5 | 5 | 5 |
| `runs` | input (1 default; 5 game day) | input | input (3 default) |
| output template | `output/runs/{{ runIndex }}/findings/{{ checklistItem }}.json` | identical | identical |

Practical consequence: any fix in the conductor layer (repair strategies, retry behavior,
observability events) lands on all three workflows at once; any fix in a prompt/schema (e.g. the
bureau#591 inch-mark rule) must be applied per workflow — which is why #591 patched both CRC's and
CC's `review.md` but the ensemble review prompt (haiku, no observed storms) was left alone.

The prompts differ substantially in *task* (CRC verifies resolution of specific comments against U1;
CC checks submittal completeness; review hunts deficiencies) but share the same skeleton: read
guide → applicability → gather evidence (progressive text nav + vision + search) → per-item verdict
→ StructuredOutput emit.

## 5. Workflow, prompt, schema, and script resolution

`loadWorkflow()` (`conductor/src/orchestrator/workflow-loader.ts:41-69`) resolves:

1. `bureau/jurisdictions/{jurisdiction}/workflows/{name}/workflow.yaml` — jurisdiction override
2. fallback: `bureau/workflows/{name}/workflow.yaml` — shared, jurisdiction-agnostic

CRC has no austin override; it loads from the shared path. (`jurisdiction` is an input anyway —
reserved for future routing; CRC's jurisdiction-specific content arrives via the *generated guides*,
not the workflow.) `promptsDir` and `schemasDir` derive from whichever workflow dir won
(`workflow-loader.ts:97-98`), so prompts/schemas/scripts always come from the same directory family
as the yaml.

## 6. CRC workflow inputs — the complete map

From `workflow.yaml:36-133`. Grouped by what they drive:

**Identity / data staging**

| input | required | default | drives |
|---|---|---|---|
| `submissionVersionId` | yes | — | U1 (target) plans. Drives `resources.submissionVersion` — conductor stages the pre-processed site-plan data into `projects/{projectId}/` before step 1 |
| `crcGuidesSubmissionVersionId` | yes | — | U0 (baseline) whose MCR generated the guides; sets the `crc-guides` bucket prefix `fetch-crc-guides` pulls from. May equal `submissionVersionId` (smoke-test mode) |
| `crcGenerationNumber` | no | highest | picks the generation dir (0,1,2…) under the bucket prefix; omitted → highest integer-named dir |
| `jurisdiction` | no | `austin` | reserved for future jurisdiction-override routing; CRC review logic is jurisdiction-agnostic today |
| `departmentCode` | no | `crc` | stamped on the `reviews` row |

**Review-step behavior**

| input | required | default | drives |
|---|---|---|---|
| `model` | no | `claude-sonnet-5` | review agent model. NB: model choice is entangled with the inch-mark emit bug — sonnet quotes dimensioned content verbatim; haiku baseline had zero unparsed emits (see sub-spec §5) |
| `effort` | no | — | agent effort, models 4.6+ only |
| `runs` | no | 1 | ensemble width; multiplies cells (guides × runs). >1 activates majority-vote consolidation |
| `maxWorkers` | no | 13 | concurrent cells; bump proportionally with `runs` to hold wall-clock (game day: runs=5, maxWorkers=35) |
| `uncertainThreshold` | no | 0.35 | dissent share at/above which a consolidated item becomes `uncertain`; only applies when runs ≥ 3 |

**Enrichment fan-out (steps 3.5a–c)**

| input | required | default | drives |
|---|---|---|---|
| `enrichComments` | no | `true` | gates the whole prep → agent → collect chain; false → `enrichedFinalComment` null everywhere, cityhall falls back to terse comment |
| `enrichmentModel` | no | haiku-4.5 | per-comment synthesis agent (no tools, no storm exposure) |
| `enrichmentEffort` | no | — | effort for the enrichment agent (haiku ignores it) |
| `enrichmentMaxWorkers` | no | 50 | concurrency for the ~80–150 per-comment cells |

**Not inputs but load-bearing context:** `projectId` (injected by conductor from the submission
version; used in the upload prefix), `bureauCommitHash` (stamped into review-comments for
provenance), `WORKSPACE_PATH`/`outputPath` (sandbox paths), `runIndex`/`checklistItem`
(per-cell template vars).

## 7. Full step walkthrough (what surrounds `review`)

1. **fetch-crc-guides** (script) — pulls guide markdown + manifest + figures from the `crc-guides`
   bucket into `workspace/crc-guides/`. This is what makes CRC's checklist *runtime-fetched* rather
   than bureau-committed (unlike CC / review).
2. **review** (agent fan-out) — §3 above.
3. **cross-run-consolidate-crc** (script) — majority vote across runs per atomic item → final
   status (`resolved`/`failed`/`not-applicable`) + confidence tier + `uncertain` gate. runs=1 →
   passthrough copy. Writes per-grouping files to `output/findings/` (per-*department* merged files,
   e.g. `crc-CA.md.json` merging the crc-CA-1/2/3 split guides).
4. **enrich-findings** (script) — joins findings with guide metadata (atomic-item rows) so
   downstream never re-parses markdown.
5. **prepare-enrichment-inputs / enrich-final-comment / collect-enriched-final-comments**
   (script → agent fan-out → script, all gated on `enrichComments`) — per-comment applicant-facing
   prose synthesis with two-layer failure isolation (schema-valid nulls + `continueOnFailure: true`).
6. **rephrase-titles** (agent, single) — verification sentences → noun-phrase titles, with a
   bucket-cached `titles.json` so titles are stable across runs of the same guide generation.
7. **upload-titles-cache** (script) — persists the title map back to the bucket.
8. **build-crc-review-comments** (script) — assembles `review-comments.json`
   (metadata.reviewType='crc'), validates/strips agent-cited block numbers against the staged
   block-manifest.
9. **validate-review-output** (script) — shape check + every `sourceFindings[].ref` must be a
   checklist ref the deterministic enrich step actually joined (prompt-injection defense, Wave 9/T3).

Then conductor's generic post-run machinery: `review:` file → review-saver → Supabase tables;
`upload:` → `workflow-runs/comment-resolution-check/{projectId}/{datetime}`.

## 8. The retry stack (summary — full detail in the sub-spec)

Two nested retry layers, different owners:

- **In-session (SDK/CLI, 5 attempts, hardcoded)** — the StructuredOutput emit/parse/validate loop
  inside `@anthropic-ai/claude-agent-sdk`. Parse or schema failure → error tool_result back to the
  *same live session* → model re-emits. Exhaustion surfaces to conductor as result subtype
  `error_max_structured_output_retries`.
- **Conductor repair (one shot)** — `tryRepairStructuredOutput()` (4 envelope-rewrap strategies +
  ajv re-validation). Success → cell completes, event `coercion_repaired`. Failure → event
  `agent.structured_output.coercion_failed` (`runner.ts:347`) → throw.
- **Outer per-cell retry (conductor, `retries: 5` from the yaml, default 2)** — any thrown cell error
  → exponential backoff (2s base → 30s cap; rate-limits 15s → 120s) → **fresh agent session from
  scratch** (`step-executor.ts:1026,1130-1156`). Budget exhausted → cell `markFailed` → step fails
  (unless `continueOnFailure: true`, which CRC's review step does NOT set — a failed cell fails the
  run).

See [`STRUCTURED-OUTPUT-RETRIES.md`](./STRUCTURED-OUTPUT-RETRIES.md) for the full walk-through,
the inch-mark case study, and the levers-and-knobs inventory.

## Open questions

- **Q1** — CRC's `review` step has no `continueOnFailure`, so a cell that exhausts all 5 outer
  retries fails the whole run (vs. the enrichment step, which degrades gracefully). Given the
  latent inch-mark worst case (a cell whose *required* evidence keeps breaking JSON), is fail-the-run
  the intended posture, or should review cells degrade to a missing-grouping marker + alert?
- **Q2** — `checklistItem` template expansion includes the `.md` extension (files land as
  `crc-SP-3.md.json`). Harmless but a recurring foot-gun (the enrichment step comment warns about
  `…json.json`). Worth normalizing in conductor, or leave as-is with documentation?
- **Q3** — Should the ensemble review workflow's prompt get the inch-mark emit rule too, proactively?
  Haiku has shown zero unparsed emits, but the workflow accepts a `model` input — someone running it
  with sonnet inherits the exposure with no prompt guard.
