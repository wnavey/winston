# Completeness Check `uncertainExplanation` — Design Spec

> **Status:** Draft, 2026-07-06. Builds on the
> [uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md)
> (shipped: bureau #509, cityhall #565) and the
> [uncertain-status-reports DESIGN-SPEC](../uncertain-status-reports/DESIGN-SPEC.md)
> (winston #147; impl bureau #512 + substation #135). Decisions locked in
> the 2026-07-06 grilling session (20 questions).
> Drives a conductor PR + bureau PR + cityhall PR + substation PR.

---

## 1. Summary

Add a new agentic workflow step to completeness-check that runs after
the uncertainty gate has fired and **explains WHY each uncertain item is
uncertain**. For every item with consolidated `status='uncertain'`, an
agent reads the disputed runs' findings (statuses, explanations,
observations, reasoning, evidence) plus the checklist-item context, and
synthesizes the disagreement into two new fields on
`review_comments.output_json`:

- **`uncertainExplanation`** — external, applicant-facing. 2–5
  sentences, neutral, no implementation details (no vision tool, no
  `facts.md`, no block numbers, no run counts or multi-run framing).
  Voiced as a single agentic pass: *"The case for this passing is X.
  However, the case for it failing is Y. Our agent could not confidently
  determine a pass or failure."*
- **`agentTraceUncertainExplanation`** — internal-only (renders inside
  the `isNoetic`-gated Agent Trace). Verbose — similar to or longer
  than the existing observation/reasoning fields. Free to name runs,
  diagnose WHY the runs diverged (different sheets consulted, same
  evidence read differently, one run couldn't find the document,
  missing votes), and reference implementation machinery.

The step is **conditional**: zero uncertain items → zero agent calls.
The step **synthesizes only** — it never re-investigates (no site-plan
tools, no vision). A re-investigating adjudicator is explicitly a
different, future feature.

## 2. Decisions (locked, 2026-07-06 Q&A)

| # | Decision | Choice | Source |
|---|---|---|---|
| D1 | Granularity | **One agent cell per uncertain item**, CRC enrich-final-comment architecture: prepare-inputs script → agent fan-out over a glob → collect script → stamp in build-review-comments | Q1 |
| D2 | Pipeline position | **After `apply-forced-outcomes`**; the prepare script skips forced items (a force overrides uncertain — nothing to explain) | Q2 |
| D3 | Toggle | New workflow input **`explainUncertain`**, boolean, **default `true`** (`if:` gate on the three new steps, mirroring CRC's `enrichComments`) | Q3 |
| D4 | No re-investigation | Agent reads ONLY per-run findings + checklist context. **No tools.** | Q4 |
| D5 | Two output fields | `uncertainExplanation` (external) + `agentTraceUncertainExplanation` (internal), both plain strings, both camelCase, both on `review_comments.output_json` | Q4/Q9/Q10 |
| D6 | Neutrality | Strictly neutral case-for/case-against; NO "which case is stronger" — `tentativeStatus` already encodes the lean | Q5 |
| D7 | Multi-run concealment | `uncertainExplanation` must NOT disclose that uncertainty came from multiple runs disagreeing — voice it as one agentic pass that "could not reach high confidence." `agentTraceUncertainExplanation` is verbose and explicit about run divergence | Q6 |
| D8 | Missing-vote handling | External field: generic "could not reach high confidence." Internal field: explain the missing-votes arithmetic explicitly. The step still runs for missing-dominated uncertainty (e.g. 2 fail + 3 missing) — the internal field is the payoff there | Q7 |
| D9 | Prompt inputs | `perRunFindings` + `tentativeStatus` + `voteBreakdown` + checklist item text/condition + Fail Status policy + **the grouping's Validation Methodology section** | Q8 |
| D10 | Length | External: 2–5 sentences (wordier than a normal explanation is fine). Internal: ≥ existing observation/reasoning length | Q11 |
| D11 | Audience | External = non-technical applicants; internal = Noetic/technical reviewers | Q12 |
| D12 | Evidence citations | Prose-only for now (sheet mentions inline where natural); no structured citation objects | Q13 |
| D13 | Failure isolation | Mirror CRC exactly: agent always returns schema-valid output; `continueOnFailure: true`; collector null-fills missing cells with `failureReason`; a dead cell → both fields null, review saves normally | Q14 |
| D14 | Consumers | CityHall (§7) + substation PDF (§8). Bureau markdown reports out of scope (§10) | Q15/Q16/Q17 |
| D15 | CityHall rendering | For uncertain items, the main **Explanation field renders `uncertainExplanation`** instead of the winning finding's explanation (same UI slot, swapped source). `agentTraceUncertainExplanation` renders inside Agent Trace, **above** observation/reasoning, uncertain items only | Q16 |
| D16 | PDF rendering | Include `uncertainExplanation` in the substation PDF for uncertain items (§8) | Q17 |
| D17 | Model | **`claude-sonnet-4-6`** default (genuine reasoning-over-conflict task; volume is tiny) via `uncertainExplanationModel` input | Q18 |
| D18 | Inputs | `explainUncertain` (bool, true), `uncertainExplanationModel` (`claude-sonnet-4-6`), `uncertainExplanationMaxWorkers` (default 10) | Q19 |
| D19 | Backfill | **None** — fresh runs only | Q20 |
| D20 | Conditional-run mechanism | **Conductor change required**: new opt-in step field `allowEmptyChecklist: true`. Discovered during spec: an empty `checklistItems` glob THROWS (`conductor/src/orchestrator/checklist-manager.ts:229` — "Checklist is empty"), and `if:` conditions can only reference inputs/env/static variables, not runtime data. Precedent: `continueOnFailure` was added the same way (conductor#206) | spec session |

## 3. Pipeline changes (`bureau/workflows/completeness-check/`)

Step order becomes:

```
review
cross-run-consolidate-cc          (writes consolidated-findings.json)
apply-forced-outcomes
prepare-uncertain-explanation-inputs   (NEW, script, if explainUncertain)
explain-uncertain                      (NEW, agent fan-out, if explainUncertain)
collect-uncertain-explanations         (NEW, script, if explainUncertain)
enrich-findings
format-reports
build-review-comments             (MODIFIED — stamps the two fields)
```

### 3.1 `workflow.yaml` — new inputs

```yaml
  explainUncertain:
    type: boolean
    required: false
    default: true
    description: |
      When true (default) and the review produced uncertain items
      (runs >= 3 with an indecisive vote), run the explain-uncertain
      agent step to synthesize per-item uncertainExplanation (external)
      and agentTraceUncertainExplanation (internal) fields. When false,
      or when there are no uncertain items, the three explain steps
      no-op and the fields are absent. See
      winston/workspaces/completeness-check/uncertain-explanation/DESIGN-SPEC.md
  uncertainExplanationModel:
    type: string
    required: false
    default: claude-sonnet-4-6
    description: Model for the explain-uncertain agent. Reasoning over conflicting run findings; volume is small (only uncertain items).
  uncertainExplanationMaxWorkers:
    type: number
    required: false
    default: 10
    description: Max concurrent explain-uncertain agent cells. Uncertain counts are small; 10 keeps wall-clock negligible.
```

### 3.2 NEW script — `prepare-uncertain-explanation-inputs.ts`

Args: `consolidatedFile`, `findingsDir`, `checklistsDir`, `outputDir`.

1. If `consolidated-findings.json` is absent (runs=1 passthrough) →
   log + exit 0 writing nothing.
2. Load consolidated items; select `status === 'uncertain'`.
3. Drop items whose post-forced finding in `findingsDir` carries
   `forced: true` (D2) — log each skip.
4. For each remaining item, write one JSON to
   `output/uncertain-explanation-inputs/{grouping}__{itemId}.json`:

```jsonc
{
  "ref": "cc-13:AW-01",
  "grouping": "cc-13",
  "checklistItemId": "AW-01",
  "itemText": "…",                 // from checklist-policy parsing
  "condition": "…",
  "failStatus": "fail-or-warn",
  "validationMethodology": "…",    // the guide's Validation Methodology section (see below)
  "tentativeStatus": "fail",
  "voteBreakdown": { "pass": 1, "fail": 1, "warn": 1, "not-applicable": 0, "missing": 0 },
  "totalRuns": 3,
  "perRunFindings": [ /* verbatim from consolidated-findings.json:
       run, status, emittedStatus?, explanation, observation, reasoning, evidenceLocations */ ]
}
```

**Validation Methodology extraction:** locate the guide's
`Validation Methodology` heading (`##`/`###`, case-insensitive) and
include that section's text; when absent, omit the field and log. Reuse
`checklist-policy.ts` for the item-row parsing; add the section
extractor there (shared, pure, unit-testable).

5. Log the count written ("N uncertain items to explain; M forced items
   skipped"). Zero is a normal outcome, not an error.

### 3.3 NEW step — `explain-uncertain` (agent fan-out)

```yaml
  - name: explain-uncertain
    if: "{{ input.explainUncertain }}"
    agent:
      model: "{{ input.uncertainExplanationModel }}"
      prompt: explain-uncertain.md
    checklistItems: "{{ WORKSPACE_PATH }}/output/uncertain-explanation-inputs/*.json"
    allowEmptyChecklist: true        # ← NEW conductor field (D20/§4)
    schema: uncertain-explanation.emit.schema.json
    output: "{{ WORKSPACE_PATH }}/output/uncertain-explanation-results/{{ checklistItem }}"
    retries: 3
    maxWorkers: "{{ input.uncertainExplanationMaxWorkers }}"
    continueOnFailure: true
```

No `tools:` — the agent must not re-investigate (D4). Note the CRC
precedent on `output:` templates: `{{ checklistItem }}` expands to the
input file's basename INCLUDING `.json` — do not append another
extension.

**Emit schema** (`uncertain-explanation.emit.schema.json`): object with
two required string fields, `uncertainExplanation` and
`agentTraceUncertainExplanation`, plus an optional `failureReason`
string the agent sets (with both fields null) when it cannot produce a
compliant answer — the always-schema-valid pattern from CRC
enrich-final-comment.

**Prompt contract** (`prompts/explain-uncertain.md`), the load-bearing
rules:

- Read the single input JSON. The runs disagreed (or too few produced
  findings); your job is to explain the disagreement, NOT to resolve it.
- **`uncertainExplanation`** (external, 2–5 sentences):
  - Neutral case-for / case-against, covering each status that received
    votes: *"The case for this passing is … However, the case for it
    failing is …"* Close with a generic low-confidence statement
    ("…so a confident determination could not be made").
  - FORBIDDEN: any mention of runs, votes, multiple attempts/passes,
    vision tools, `facts.md`, `blocks.md`, block numbers/IDs, semantic
    search, or any internal file/tool name. Sheet references in plain
    language ("the utility plan on Sheet 12") are encouraged.
  - "the agent" may appear sparingly (once); prefer agentless phrasing.
  - When uncertainty is missing-vote-dominated, do not fabricate a
    two-sided case: state what WAS found and that confidence was
    insufficient (D8).
  - No verdict, no leaning, no recommendation (D6).
- **`agentTraceUncertainExplanation`** (internal, ≥ observation/
  reasoning length): name the runs and their verdicts, diagnose the
  divergence (different sheets consulted; same evidence, different
  threshold reading; document not found by one run; missing votes and
  what that does to winner share), and reference internal machinery
  freely (vision calls, blocks, search terms the runs cited).
- Return format: the two fields via structured output; nothing else.

### 3.4 NEW script — `collect-uncertain-explanations.ts`

Args: `resultsDir`, `inputsDir`, `outputFile`.

- Merge per-cell results into `output/uncertain-explanations.json`
  keyed by `ref`.
- Null-fill any input whose result file is missing
  (`failureReason: 'agent-failed'`) — D13.
- **Belt-and-suspenders lint on `uncertainExplanation`** (script-side,
  mirroring CRC's forbidden-terms pass): case-insensitive match on
  `run \d` / `runs` (word), `vote`, `facts.md`, `blocks.md`,
  `block \d`, `vision`, `semantic search`. On hit: null the external
  field with `failureReason: 'lint-reject'`, KEEP the internal field
  (it is allowed to say all of that). Cityhall/PDF fall back to the
  winning finding's explanation when the external field is null.
- Zero inputs → write an empty map `{}` and exit 0.

### 3.5 MODIFIED — `build-review-comments.ts`

- New optional arg `uncertainExplanationsFile`; tolerate absence
  (explainUncertain=false, runs<3, zero uncertain).
- For comments whose `effectiveStatus === 'uncertain'`: stamp
  `output_json.uncertainExplanation` and
  `output_json.agentTraceUncertainExplanation` from the map when
  present and non-null. Never stamp on non-uncertain or forced comments
  (the prepare step already excluded them; the guard here is
  defense-in-depth).
- workflow.yaml passes the new arg; version bump (1.3.0 → 1.4.0).

## 4. Conductor change — `allowEmptyChecklist`

`checklist-manager.ts:229-231` throws `'Checklist is empty - no items
to process'` when a checklist resolves to zero items, and `if:`
conditions cannot see runtime data — so a data-dependent fan-out
("one cell per uncertain item, usually zero") is impossible today.

Add an optional `allowEmptyChecklist: boolean` to the step schema
(`types.ts` StepDef + the workflow-loader zod schema). When true and
the checklist resolves to zero items, the step completes successfully
as a no-op with a log line ("checklist empty — step skipped by
allowEmptyChecklist"). Glob-type checklists only need it, but there is
no reason to restrict.

**Deploy order (load-bearing):** the conductor change must be deployed
to the Substation sandbox pool BEFORE the bureau workflow change goes
live — an older conductor ignores the unknown field and throws on the
first zero-uncertain review (which is the COMMON case). Same
deploy-coupling note as CRC's `continueOnFailure` (conductor#206).

## 5. DB shape — `review_comments.output_json` additions

```jsonc
{
  "status": "uncertain",
  "tentativeStatus": "fail",
  "voteBreakdown": { "pass": 1, "fail": 1, "warn": 1, "not-applicable": 0, "missing": 0 },
  "uncertainExplanation": "The required fire-flow information appears on the utility plan… However, the hydrant spacing table is incomplete… A confident determination could not be made.",   // NEW — external
  "agentTraceUncertainExplanation": "Run 1 (pass) located the fire-flow table on Sheet 12 via semantic search and judged it complete; runs 2–3 (fail) each cited block 12.4's missing hydrant rows… The divergence is interpretive: all three runs saw the same table…",  // NEW — internal
  /* … */
}
```

Both fields appear ONLY on uncertain, non-forced comments from runs
with `explainUncertain=true`, and may be null/absent after cell failure
or lint rejection. `output_schema` stays `'legacy'` (additive fields,
same rationale as the parent spec's D14).

## 6. Failure modes

- **Agent cell dies past retries** → `continueOnFailure` keeps the
  step alive; collector null-fills; comment renders exactly as it does
  today (winning-finding explanation + vote callout). Degraded, not
  broken.
- **Lint reject** → external field null (falls back like above),
  internal field preserved.
- **Zero uncertain items** → prepare writes nothing, agent step no-ops
  via `allowEmptyChecklist`, collector writes `{}`, build stamps
  nothing. This is the common case and must add ~0 wall-clock.
- **`explainUncertain=false`** → all three steps skipped via `if:`.

## 7. CityHall changes

- **Explanation source swap (D15):** in `CompletenessCommentCard`, the
  explanation slot for `status==='uncertain'` renders
  `comment.uncertainExplanation ?? <current source>` (the current
  source being `selectExplanationText(...)` → terse `comment` field).
  Non-uncertain items unchanged.
- **Agent Trace:** render `agentTraceUncertainExplanation` as a new
  block ABOVE observation/reasoning, only when present (uncertain items
  only). The trace section is already `isNoetic`-gated — the internal
  field never reaches applicants. Update `hasAgentTrace` to also count
  the new field so the trace section renders even if observation/
  reasoning are empty.
- **types.ts:** add both optional string fields to `ReviewComment`;
  add the two mapping lines in the parent and section loaders
  (`c.uncertainExplanation as …`), mirroring how
  `tentativeStatus`/`voteBreakdown` were mapped.
- Purely additive — old reviews without the fields render as today.

## 8. Substation PDF changes

- Route (`completeness-check-pdf.ts`): parse `uncertainExplanation`
  (string, defensive) into the comment. Do NOT parse the internal
  field — the PDF is external-facing.
- Document (`completeness-check-document.tsx`): for items in the
  Uncertain group, render `uncertainExplanation ?? item.comment` as the
  explanation body, keeping the vote-arithmetic callout annotation from
  #135 above it.
- **Noted tension (pre-existing, not introduced here):** the callout
  shipped in #135 (and cityhall's #565 callout) displays run/vote
  arithmetic ("2 fail / 1 pass across runs"), while D7 hides multi-run
  framing inside `uncertainExplanation`. If full concealment from
  applicants is wanted, the callouts need a follow-up pass — flagged
  for a future decision, not changed here.

## 9. Smoke test plan

Folds into the parent spec's pending §10 smoke test (runs=3/runs=5 on
1700 S Lamar):

1. runs=3 with ≥1 uncertain item: input files written (forced items
   skipped), one agent cell per item, both fields present on the
   uncertain rows, external field passes lint (grep the output for the
   forbidden terms), internal field names runs.
2. runs=3 with ZERO uncertain items (or `uncertainThreshold=0.0`… note
   0 disables nothing — use a review that happens to be decisive):
   prepare writes nothing, agent step no-ops via `allowEmptyChecklist`,
   workflow completes. **This is the regression test for D20.**
3. `explainUncertain=false`: steps skipped, fields absent.
4. Kill-a-cell simulation (optional): verify null-fill + fallback
   rendering.
5. CityHall: uncertain item shows the external prose in the Explanation
   slot; Agent Trace shows the internal field above observation.
6. PDF: uncertain item body shows the external prose under the callout.
7. Unit tests: Validation-Methodology extractor (checklist-policy);
   collector lint (accept/reject fixtures); conductor
   `allowEmptyChecklist` (empty-glob no-op vs. default throw).

## 10. Out of scope

- **Re-investigating adjudicator** (tools + evidence gathering to
  RESOLVE uncertainty) — future feature, explicitly not this.
- **Bureau markdown reports** rendering the new fields — optional
  follow-up; would ride the enriched-findings stamping pattern from
  the reports spec (§3.1 there).
- **CRC** — its uncertain items could use the same treatment later;
  separate spec (different per-run shape and audience rules).
- Backfill (D19). Callout-concealment follow-up (§8 tension).

## 11. Implementation checklist

Deploy order: **conductor → bureau**, cityhall/substation any time
(additive).

- [ ] **Conductor PR** — `allowEmptyChecklist` step field: StepDef type,
  workflow-loader schema, checklist-manager no-op branch + log, unit
  test. Deploy to Substation pool before the bureau PR merges.
- [ ] **Bureau PR**
  - [ ] workflow.yaml: 3 inputs, 3 new steps (with `if:` +
    `allowEmptyChecklist`), build-review-comments arg, version 1.4.0.
  - [ ] `checklist-policy.ts`: Validation-Methodology section extractor.
  - [ ] `prepare-uncertain-explanation-inputs.ts` (new).
  - [ ] `prompts/explain-uncertain.md` (new) + emit schema per §3.3.
  - [ ] `collect-uncertain-explanations.ts` (new) incl. lint.
  - [ ] `build-review-comments.ts`: stamp both fields on uncertain
    comments.
  - [ ] Fixture-chain test extension (zero-uncertain + happy path).
- [ ] **CityHall PR** — explanation source swap, Agent Trace block,
  types + loader mappings.
- [ ] **Substation PR** — route parse + document render of the external
  field.
- [ ] **Smoke test** per §9; record real uncertainExplanation samples
  back into this spec.

## 12. References

| Thing | Path |
|---|---|
| Parent uncertain-status spec | `winston/workspaces/completeness-check/uncertain-status/DESIGN-SPEC.md` |
| Reports spec (stamping pattern) | `winston/workspaces/completeness-check/uncertain-status-reports/DESIGN-SPEC.md` |
| CRC enrich-final-comment (architecture template) | `bureau/workflows/comment-resolution-check/workflow.yaml` steps 3.5a–c |
| Conductor empty-checklist throw | `conductor/src/orchestrator/checklist-manager.ts:229` |
| Conductor if-condition limits | `conductor/src/orchestrator/template-engine.ts:287` (`evaluateCondition`) |
| continueOnFailure precedent | conductor#206 |
| CC workflow | `bureau/workflows/completeness-check/workflow.yaml` |
| CityHall card | `cityhall/src/routes/(app)/project/[projectId]/review/CompletenessCommentCard.svelte` |
| Substation PDF | `substation/src/routes/completeness-check-pdf.ts`, `substation/src/pdf/completeness-check-document.tsx` |
