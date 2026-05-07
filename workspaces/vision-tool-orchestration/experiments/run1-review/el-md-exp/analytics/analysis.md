# Vision-Check Experiment — Review (el-md-exp) Run 1 Analysis

**Date:** 2026-05-07
**Run:** Dispatcher run (Substation/Inngest), runs=3, review with `experiment=vision-check`
**Submission:** Valley View v2 (`submissionVersionId=48f705aa-...`)
**Department / Guide:** `el` / `el-md-exp` (101 deficiencies in ground truth, 3 guide files: 1.md, 2.md, 13.md)
**`runLabel`:** `VISION_CHECK_REVIEW_EL_MD_EXP_RUN_1` · workflow_runs.id `b7015e80-c771-4f9e-a149-2adffc5723df`
**Wall-clock duration:** 14 min 17 sec
**Smoke test, runs=1 originally, bumped to runs=3** for parity with `VISION_CHECK_REVIEW_EL_MD_EXP_BASELINE_V2`.

---

## TL;DR

This is the **first end-to-end vision-check experiment run on the review side**.
Three findings, ranked by importance:

1. **The review workflow is missing the inspect-drawing script entirely.**
   24 of 24 `drawing_inspect`-routed calls fell back to plain vision via
   `specialist_script_not_found_in_bureau`. The bureau script lives at
   `bureau/.../completeness-check/scripts/inspect-drawing.ts` but isn't
   present in `review/scripts/`. Phase B documented `measurement` as
   deferred; this is a second deferred specialist that wasn't tracked.
2. **Zero specialist execution this run.** Every one of the 59
   vision_check calls dispatched to plain `vision` (generic route worked
   normally; drawing_inspect fell back via missing-script; measurement
   fell back via deferred-arg-construction). We can measure classifier
   routing decisions, but not specialist execution accuracy.
3. **`logAllAgentTrace=true` worked for the experiment** (findings carry
   `agentTrace` with `tools_used`), in contrast to `BASELINE_V2` where it
   silently failed. The bug is specific to the production-prompt path —
   investigating remains worthwhile, but the experiment data is rich.

The headline question "is the classifier identifying measurement-needed
items?" has a partial answer: of 32 calls on horizontal-distance items,
only 13 (40.6%) were routed to `measurement`. Coverage on horizontal
items is also low — 11 of 51 (21.6%) got vision_check fired across the
3 runs. So both selection (which items to investigate) and routing
(what specialist to dispatch) are weak relative to the ideal.

---

## Numbers at a glance

**Vision-check call distribution (59 total calls):**

| Classifier route | Calls | Specialist outcome |
|---|---:|---|
| `drawing_inspect` | 24 | All 24 → fell back to generic vision (script missing) |
| `generic` | 20 | All 20 → vision (correct dispatch path) |
| `measurement` | 15 | All 15 → fell back to generic vision (arg construction deferred) |
| **total** | **59** | **All 59 ran plain `vision`** |

**Routing × ground-truth classification:**

| Ground-truth classification | drawing_inspect | generic | measurement | total | (expected route, strict) |
|---|---:|---:|---:|---:|---|
| `horizontal` | 7 | 12 | **13** | 32 | measurement |
| `vertical-or-mixed` | **0** | 1 | 1 | 2 | drawing_inspect |
| `not-applicable` | 17 | 7 | 1 | 25 | (no measure-distance — but vision could still apply) |

Note on `not-applicable`: the el-md-exp ground truth labels classification
for **measure-distance applicability**, not vision applicability overall.
Items labeled `not-applicable` may still legitimately need a vision
specialist — just not measure-distance. So the 25 calls in that row
aren't necessarily misuse — many may correctly route to `drawing_inspect`
or `generic`. Worth qualitative review.

**Headline measurement-route hit rate:**

- Calls on horizontal-distance items: **32** (across 26 distinct items × 3 runs)
- Of those, classifier picked `measurement`: **13 (40.6%)**
- Horizontal items in ground truth: **51**
- Horizontal items where vision_check fired ≥1× across runs: **11 (21.6%)**
- Horizontal items routed to `measurement` ≥1× across runs: **7 (13.7%)**

**Classifier confidence:** mean 0.931, range 0.85–0.99.

---

## The two-layer dispatch failure

The most actionable finding from this run is that **two of the three
specialist routes are inert** for review:

### Layer 1 — `drawing_inspect` route (24 fallbacks)

`dispatch.ts:330-360` calls `runBureauScript('inspect-drawing', ...)`
which `resolveScript`'s in `<workflowPath>/scripts/`. For review,
`workflowPath = bureau/.../workflows/review/`. There's no
`inspect-drawing.ts` there — the script lives only in
`completeness-check/scripts/`. Result: `ScriptNotFoundError` → fallback
to generic.

Every `drawing_inspect` route in this run hit this fallback. The
classifier decisions are still recorded (we can see `problemType:
drawing_inspect` in metadata.json), but the actual specialist never
ran.

**Fix:** copy or symlink `inspect-drawing.ts` (and its
`inspect-drawing-impl.py` helper, plus the prompt template) into
`bureau/jurisdictions/austin/workflows/review/scripts/`. Or, better,
factor specialist scripts into a shared location both workflows can
reference. Out of scope for this analysis but tracked.

### Layer 2 — `measurement` route (15 fallbacks)

Documented Phase B behavior — `dispatch.ts:432-442`. `measurement`
falls back to generic with `FALLBACK_REASON_MEASUREMENT_DEFERRED`
because measure-distance arg construction isn't wired up yet. We
already knew this; it's listed as a follow-up in
`vision-tool-orchestration/plan.md`.

Every `measurement` route in this run hit this fallback.

### Result

All 59 vision_check calls ran the plain `vision` tool under the hood,
with the classifier's intent recorded as a "would-have-been"
specialist call. **Specialist execution accuracy is unmeasurable on
this run** — same constraint as baseline_v2 in practice.

What we CAN measure (and did, above): classifier routing decisions,
agent-phrased questions per call, per-deficiency call counts, and
the gap between what the classifier intended vs what dispatched.

---

## Coverage breakdown — which items did the agent investigate?

The agent fired vision_check on **26 of 101 distinct deficiencies**
across all 3 runs (25.7%). Per ground-truth classification:

| Classification | In ground truth | Items called ≥1x | Coverage |
|---|---:|---:|---:|
| horizontal | 51 | 11 | **21.6%** |
| vertical-or-mixed | 11 | 1 | 9.1% |
| not-applicable | 39 | 14 | 35.9% |
| **total** | **101** | **26** | **25.7%** |

Horizontal items (where measure-distance is the eventual specialist)
are the most actionable, and they're the **least covered**. This
mirrors the CC pattern where the agent investigates a fraction of
items per run — partly stochastic, partly the agent deciding
"answerable from text."

For the 7 horizontal items where the classifier did pick `measurement`
≥1× across runs, we have the agent's full question + classifier
reasoning captured in `vision-check-calls/<id>/metadata.json`. When
measurement dispatch lands, those calls become the first measurement-
specialist execution data.

---

## What worked — schema observability

Per-call traceability is now solid. Each metadata.json captures:

- `inputs.checklistItemId` (`el-md-exp:EL-X.Y`) — exact attribution, no fuzzy match
- `inputs.checklistItemText` (canonical deficiency text)
- `inputs.question` (agent-phrased — first time we see what the agent asks Gemini for review items)
- `classifier.output.{problemType,reasoning,confidence}` — Haiku's decision + justification
- `dispatch.{specialistCalled,success,fallbackReason,specialistCallDir}` — actual execution outcome

`logAllAgentTrace=true` worked for this run (each finding has
`agentTrace.tools_used`), in contrast to `BASELINE_V2` which had the
same flag but produced no `agentTrace`. The bug is specific to the
baseline path — separately tracked as `TODO — baseline vision tool
prompt-traceability gap`.

---

## Open questions / follow-ups

1. **Move `inspect-drawing` script (and friends) into a shared location** the
   review workflow can reference. Without this, every `drawing_inspect`
   route on review will keep falling back. Same will be true for any
   measure-distance dispatch eventually.
2. **Wire up `measurement` arg construction** — Phase B's documented
   follow-up. Without it, `measurement` routes have no specialist.
3. **Coverage on horizontal items** is only 21.6% in 3 runs. Worth
   characterizing: are these items genuinely answerable from text /
   PDF extraction, or is the agent leaving them on the table?
4. **Routing accuracy on horizontal items** is 40.6% to `measurement`.
   Worth pulling the 12 horizontal-routed-to-generic and 7
   horizontal-routed-to-drawing_inspect cases to see what specifically
   tripped the classifier — likely a mix of agent-question phrasing
   ("are there transformer pads visible?" → generic correctly) and
   classifier framing.
5. **Specialist execution accuracy** is still unmeasured on review.
   Closing layer 1 (inspect-drawing script) is the smallest unblock.

---

## Files

- `el-md-exp/output/` — full run artifacts (59 vision-check call dirs,
  consolidated findings, synthesis intermediates, vision-log).
- `el-md-exp/analytics/analyze.py` — adapted from CC run 4 analyzer.
  Reads vision-check-calls/<id>/metadata.json, joins on
  `inputs.checklistItemId` against `item-classification.json`. Reports
  routing distribution, classifier accuracy by classification, and
  measurement-route hit rate.
- `el-md-exp/analytics/vision-check-calls-audit.tsv` — 59 rows, full per-call detail.
- `el-md-exp/analytics/routing-by-classification.tsv` — 101 rows, per-deficiency summary.
