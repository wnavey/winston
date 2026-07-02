# Completeness Check — Structured-Output Retry-Storm Bugfix

> **Status:** Draft spec, ready for review. Filed 2026-07-02.
> **Surface:** `bureau/workflows/completeness-check/` only (`workflow.yaml`, `schemas/`, `prompts/review.md`, both experiment prompt overlays). **Zero conductor changes.**
> **Prior art:** `winston/workspaces/comment-resolution-check/crc-workflow/bugs/STRUCT-OUTPUT-RETRY-STORM.md` (the CRC bug history this port draws from), `winston/workspaces/workflow-triad-audit/audit.md` (recommendation #1).
> **Ports:** bureau PR #457 (`crc.emit.schema.json` lenient-emit pattern) + PR #459 (prompt/schema alignment), adapted for CC. Conductor #194 (`normalizeStructuredOutput`) + #197 (structure-matched repair) are already generic and already deployed — CC just has to opt in.

---

## 1. Problem

### 1.1 CC has the storm today, with receipts

From the 2026-05-01 debug run (`winston/workspaces/5-01-cc-debug/`, submission `6cd47f07-…`, medly run):

- **37 × `error_max_structured_output_retries`** in `completeness-check-error.log`.
- Individual agent cells burned **38–60 minutes each** before dying on the structured-output boundary (`cc-1.md` run-2: 60 min; `cc-5.md` run-2: 48 min; `cc-2.md` run-2: 47 min; …), then re-entered the outer step retry (`retries: 5`) with a fresh session.

The findings themselves were fine — the *data* was right, the *envelope shape* was wrong. This is the exact failure signature CRC diagnosed in June: the model treats the `StructuredOutput` tool as if it had a single parameter holding the whole result, and wraps the envelope under an invented key. Each such event wastes ~5 internal SDK attempts, and each outer retry replays the entire evidence-gathering session (CC cells run 30–60 min on Sonnet — this is the most expensive place in the workflow to lose work).

### 1.2 What CC does today

- **Schema:** `completeness.schema.json` is strict — top-level `required: ["grouping", "findings"]`.
- **Prompt:** `prompts/review.md` Step 5 spends ~30 lines fighting the envelope (a CORRECT skeleton + three WRONG examples), all oriented around *"don't forget `grouping`"*.
- **Conductor:** since conductor #197 merged, the *failure-path* repair (`tryRepairStructuredOutput`) already covers CC's strict schema — wrapped envelopes that exhaust the SDK's 5 retries get structure-matched, unwrapped, `grouping`-injected, re-validated, and rescued as `coercion_repaired`. That's the safety net. But:
  1. The net only fires **after** the SDK burns 5 internal attempts (~minutes of retry latency + token cost per event).
  2. The model still has a *reason* to invent a wrapper: the strict schema demands a field (`grouping`) that is pure ceremony — 100% derivable from the cell's guide filename. CRC's data showed that requiring `grouping` is what anchored the specific `{ findings: { grouping, findings } }` double-wrap.

### 1.3 What CRC learned (and what we must not repeat)

The CRC history has a critical negative result baked into it. Sequence of events:

1. **06-19:** strict schema → 11 `coercion_failed` events, all shaped `{ findings: {…} }`.
2. **06-24:** lenient emit schema shipped **alone** (bureau #457 + conductor #194 normalize). Result: the storm got **worse** — per-cell failure rate rose 15% → 23%, the wrapper key migrated (`data` ×72, `output` ×59, `properties` ×27, `content`/`results`/`result`), **and** the old failure-path repair silently deactivated (it guarded on `schemaRequiresGroupingAndFindings`, false for the lenient schema). The lenient schema removed the model's reason to nest under `findings` specifically, but the *wrap-under-one-key reflex* is generic.
3. **06-25:** conductor #197 fixed the real layer — `extractFindingsArray` matches findings **by structure, not wrapper-key name**, and repair now runs under the lenient schema too. bureau #459 aligned the prompt (the prompt had been *contradicting* the lenient schema by listing flat `{findings:[...]}` as WRONG).

**The corrected root cause:** the trigger was never `grouping` per se — it's the generic single-parameter-wrapper reflex. The complete fix is three legs, and they only work together:

| Leg | What it does | Where it lives |
|---|---|---|
| Lenient emit schema | Removes the model's reason to wrap; kills the biggest single validation error class (`must have required property 'grouping'`) | bureau, per-workflow |
| Structure-matched normalize + repair | Primary path: canonicalizes every successful lenient emit (`inject_grouping` et al.). Failure path: rescues any-key-wrapped envelopes after SDK retries exhaust | conductor (generic, shipped) |
| Prompt alignment | Reduces wrap *frequency* so the nets fire rarely; must not contradict the schema | bureau, per-workflow |

CC gets to skip CRC's painful middle chapter because leg 2 is already deployed and schema-shape-keyed: `schemaIsLenientFindingsEnvelope()` activates for **any** step schema that requires `findings` but not `grouping`. Flipping CC's schema is the opt-in switch.

---

## 2. Design

Four file changes, one PR, all in `bureau/workflows/completeness-check/`. Not a 1:1 copy of CRC — §2.5 lists the deliberate divergences.

### 2.1 New file: `schemas/completeness.emit.schema.json`

The lenient EMIT contract the agent is validated against. Derived from `completeness.schema.json` by:

- **Drop top-level `grouping` entirely** — removed from `required` AND removed as a property (mirrors `crc.emit.schema.json`; the runner injects it post-hoc, and `normalizeStructuredOutput`'s passthrough tolerates a voluntarily-emitted `grouping` anyway).
- **Keep `required: ["findings"]`** at the top level; keep `summary` optional.
- **Keep the per-finding items STRICT and unchanged** — same `required` list (`checklistItemId`, `observation`, `reasoning`, `tools_used`, `status`, `explanation`, `evidenceLocations`), same `status` enum (`pass` / `fail` / `not-applicable`), and CC's own extras that CRC doesn't have: `resolution` (string|null) and the `resolutionDetails` `standard_note_diff` object. The lenient schema loosens only the envelope; finding quality enforcement stays at the SDK boundary.
- **Carry a `$comment`** modeled on CRC's, explaining: why `grouping` is absent, that the runner injects it (`conductor src/agent/structured-output-repair.ts` → `normalizeStructuredOutput`), and that the strict canonical shape lives in `completeness.schema.json`.

`completeness.schema.json` is **retained untouched** as the canonical documentation of the on-disk/downstream shape (same role `crc.schema.json` plays for CRC).

### 2.2 `workflow.yaml`: point the review step at the emit schema

```yaml
  - name: review
    ...
    # Lenient EMIT schema (findings-only; no top-level `grouping`). The runner
    # injects `grouping` from the cell filename and canonicalizes to the strict
    # {grouping, findings, summary} shape (completeness.schema.json) before
    # writing the output file, so downstream scripts + DB are unchanged.
    # Dropping `grouping` from what the agent emits removes the primary
    # structured-output retry-storm trigger (see winston 5-01-cc-debug: 37 ×
    # error_max_structured_output_retries) — same fix as CRC (bureau #457/#459).
    schema: completeness.emit.schema.json
```

Bump workflow `version` 1.0.0 → 1.1.0.

No other step touches the review schema. `retries: 5` on the step stays as-is (it's the outer net for genuinely-dead cells; the point of this fix is that it stops being *exercised* by shape errors).

### 2.3 `prompts/review.md`: rewrite Step 5's envelope contract

Replace the current envelope block (lines ~123–158) following CRC's post-#459 `review.md` Step 5, adapted to CC. Specifically:

- **Delete** the "Your grouping ID is the filename without extension" instruction and the `grouping` top-level field doc. Replace with CRC's parenthetical: *"(The `grouping` ID is derived from your guide's filename and injected for you — you do not emit it.)"*
- **Replace** the grouping-oriented CRITICAL warning with CRC's generic anti-wrapper contract: *"`findings` is a TOP-LEVEL parameter; do not wrap it. The `StructuredOutput` tool's parameters ARE the envelope… The wrapper key's name does not matter, and there is never an outer wrapper."*
- **Replace** the WRONG examples with CRC's generic set — this is the #459 lesson; the current CC examples would actively contradict the new schema (they label flat-without-`grouping` as WRONG, which is now the CORRECT shape):

```jsonc
// WRONG — nested under a wrapper key. The wrapper name is irrelevant
// (data / output / result / properties / even `findings` itself):
{ "data": { "findings": [ ... ] } }
{ "findings": { "findings": [ ... ], "summary": "..." } }

// WRONG — bare array; `findings` must be a named top-level parameter.
[ { ... }, { ... } ]

// WRONG — empty object; every checklist item needs a finding.
{}
```

- **Keep everything CC-specific untouched:** the CORRECT skeleton (minus `grouping`), "include ALL checklist items — every row must have a finding," the full per-finding field docs including `resolution` formats and `resolutionDetails` / `standardNotesReferenceUrl` handling, and `summary`.

### 2.4 Experiment overlays: same Step 5 rewrite

`experiments/inspect-drawing/review.md` and `experiments/vision-check/review.md` are **full prompt replacements** (experiment-loader overrides per-step `prompt`, not fragments), and each carries its own copy of the Step 5 envelope block — verified: `experiments/inspect-drawing/review.md:139–171` duplicates the strict-envelope prose. Both get the identical §2.3 rewrite in the same PR. An experiment run with a stale overlay would reintroduce the schema/prompt contradiction that burned CRC.

### 2.5 Deliberate divergences from the CRC solution

| CRC | CC port | Why |
|---|---|---|
| Two verdicts (`resolved`/`failed`), findings terse | Three statuses + `resolutionDetails` diff object | CC's finding shape is richer; the emit schema keeps all of it strict. Only the envelope loosens. |
| Guides fetched from Supabase bucket; grouping = `crc-{dept}` | Guides from Bureau git; grouping = `cc-N` | No change needed — `deriveGroupingFromChecklistItem` strips one trailing extension from the cell filename (`cc-3.md` → `cc-3`), identical convention. |
| `crc.emit.schema.json` has no `resolutionDetails` | `completeness.emit.schema.json` keeps it | CC-only feature (standard-note diff UI). |
| CRC shipped schema first, prompt alignment 10 days later (and paid for it) | Schema + prompt + experiment overlays land in ONE PR | The #459 lesson: a prompt contradicting the schema increases wrap frequency exactly when the old repair guard is off. Conductor #197 makes the window survivable now, but there's no reason to open it. |
| New `rephrase-titles`/enrichment steps involved | None | CC's downstream (consolidate → forced-outcomes → enrich → format-reports → build) is untouched; see §3. |

---

## 3. Why downstream is unaffected (verification)

The canonicalization happens **inside the runner, before the step's output file is written**: on `success`, `normalizeStructuredOutput` rewrites the payload to `{ grouping, findings, summary? }` (strategies: `passthrough` / `inject_grouping` / `unwrap_*` / `wrap_bare_findings_array`), and *that* value lands at `output/runs/{runIndex}/findings/{cc-N}.json`. Confirmed consumers all read exactly that shape and keep working unchanged:

- `cross-run-consolidate-cc.ts` — types `GroupingResult { grouping, findings, summary? }`; majority vote keyed on `grouping` + `checklistItemId`.
- `apply-forced-outcomes.ts` — patches per-grouping findings files, keyed on composite `grouping:itemId`.
- `enrich-findings.ts` — joins on `raw.grouping` against checklist markdown.
- `build-review-comments.ts`, format-reports agent, review-saver, City Hall — consume `enriched-findings.json` / `review-comments.json`, two steps removed.

**One known edge, accepted:** in the unwrap strategies (`unwrap_findings_object` / `unwrap_wrapped_envelope`), normalize deliberately rebuilds a clean `{ grouping, findings }` and drops any sibling fields inside the junk wrapper — including a `summary` the model put there. `summary` is optional and cosmetic (one-line rollup); losing it on the small fraction of wrapped-then-healed cells is fine. Only the flat `inject_grouping` path preserves `summary`. No action; documented here so nobody chases it as a bug later.

---

## 4. Preconditions & risks

1. **Conductor ≥ #197 must be live in the Substation pool before this merges.** Under the lenient schema, #197's structure-matched repair is the only failure-path net (the pre-#197 guard bailed on lenient schemas — that's what bit CRC on 06-24/25). CRC has been running on this build since late June, so this is a verify-not-build item: confirm the pool build includes `agent.structured_output.normalized` events in a recent CRC run log.
2. **Expect the wrapper reflex to persist at reduced frequency.** CRC's post-fix data shows wrapping didn't go to zero — it gets *healed* (as `normalized`/`coercion_repaired`) instead of *failing*. Success criteria are framed accordingly (§5).
3. **Medly (runs>1) multiplies exposure.** The 5-01 storm was a multi-run CC; every (item × runIndex) cell is an independent chance to wrap. That makes this fix *more* valuable for CC medly runs, and means the validation run should use runs=3 to exercise the consolidation path against healed outputs.
4. **No DB / City Hall / review-saver changes.** `review-comments.json` shape is identical.
5. **Rollback:** revert the `schema:` line in workflow.yaml (plus the prompt block if desired). The emit schema file can stay; it's inert unless referenced.

---

## 5. Test plan & closure criteria

**Validation run** (mirrors the CRC audit method):

1. Local or Substation CC run on a submission with a prior baseline — ideally the 5-01 storm submission (`6cd47f07-7f6d-4a7e-92bd-2945486b5be3`) or a current equivalent, `runs=3` to match the storm conditions.
2. Grep the run's error log + run-log for the three event types.
3. Diff `output/runs/*/findings/*.json` and final `review-comments.json` against a pre-change baseline for shape parity (`grouping` present and correct in every findings file; same enriched/built shapes).
4. Spot-check 2–3 cells' agent traces: first `StructuredOutput` attempt should be flat `{ findings: [...], summary }`.

**Closure criteria** (adopting CRC's revised, three-bar version):

| Bar | Target |
|---|---|
| `agent.structured_output.coercion_failed` | **Zero.** Any occurrence means a shape the structure-matcher couldn't heal — file it with the payload summary. |
| `coercion_repaired` + `normalized` (changed=true) counts | Nonzero is the net *working*, not a regression. Track per run; should trend down as the aligned prompt reduces wrap frequency. |
| Wasted internal SDK attempts | Cells hitting the failure-path repair still burn ~5 internal attempts first. If `coercion_repaired` stays materially nonzero after the prompt alignment beds in, escalate with further prompt work rather than schema changes. |

Plus one CC-specific bar: **cell wall-clock**. The 5-01 storm's signature was 38–60-min cells dying at the output boundary. Post-fix, max cell duration should reflect genuine review work, with no outer-retry replays attributable to shape errors.

---

## 6. Out of scope / follow-ups

- **Formal review workflow** has the same strict `{grouping, findings}` contract (`review.schema.json`) plus a prompt warning about grouping-prefix mistakes — same fix applies (triad audit rec #1). Separate spec/PR after CC validates; review's ensemble (runs=3 × ~59 groupings × per-item cells) makes the cost math even more favorable.
- **Reducing the SDK's 5 internal retries** before repair fires — conductor-side, cross-workflow; not worth touching until the post-fix `coercion_repaired` rate is known.
- **`unclear` status drift note (pre-existing):** `cross-run-consolidate-cc.ts` types a 4-status union including `unclear`, but `completeness.schema.json`'s enum has only 3. Not touched by this change; flagging for a housekeeping pass so the emit schema doesn't get blamed for it.

## 7. Implementation checklist

- [ ] `bureau`: add `workflows/completeness-check/schemas/completeness.emit.schema.json`
- [ ] `bureau`: `workflow.yaml` review step → `schema: completeness.emit.schema.json`, version 1.1.0, explanatory comment
- [ ] `bureau`: rewrite Step 5 envelope block in `prompts/review.md`
- [ ] `bureau`: apply the same Step 5 rewrite to `experiments/inspect-drawing/review.md` and `experiments/vision-check/review.md`
- [ ] Verify Substation pool conductor build ≥ #197 (check for `normalized` events in a recent CRC run)
- [ ] Validation run per §5; record results in this workspace
- [ ] Follow-up bead for the formal-review port
