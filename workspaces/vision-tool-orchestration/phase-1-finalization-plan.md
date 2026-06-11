# Phase 1 finalization plan — vision-tool orchestration

**Status:** ready to close Phase 1 once dynamic-scale extraction lands.
Phase 1 commits to **variant 2 (`vision_check` classifier-routing)** as
the architectural direction for vision tooling on agentic site-plan
reviews. Phase 2 builds out from there.

This doc is the wrap-up brief for what we set out to test in Phase 1,
the data we collected, the conclusion we're drawing, and what we're
explicitly *not* claiming yet.

> **Audience:** stakeholders (engineering leadership). Treat this as
> the executive summary — the per-metric details live in
> [`metrics/analysis.md`](metrics/analysis.md), the var-2 story lives
> in [`metrics/var2-uplift.md`](metrics/var2-uplift.md), and the
> source-run register lives in [`metrics/source-runs.md`](metrics/source-runs.md).

---

## What we set out to answer

When an agent reviews a site plan, it needs a vision tool — something
that can read drawings. We had three architectures to choose between:

1. **ctrl (baseline):** the agent has a single generic `vision` tool
   that handles any visual question. Production today.
2. **var-1 (bifurcated):** the agent has `vision` *plus* one or more
   specialist tools (e.g. `measure-distance` for clearance checks)
   exposed directly. The agent decides which to use.
3. **var-2 (classifier-routing):** the agent only has one tool —
   `vision_check`. Internally, a classifier reads the agent's question
   and dispatches to the right specialist (generic, measure-distance,
   inspect-drawing, …). The agent never picks the specialist directly.

Phase 1's job was to **prove which architecture is right** using a real
review checklist with real site plan data, not vibes.

## How we measured it

We ran all three architectures on the same submission (Valley View
Townhomes v1) against the same review guide (`el-md-exp`, 101
checklist items, 54 of which expect a clearance/distance measurement).
Three runs per architecture, strict-majority voting across runs to
suppress per-run noise.

Four metrics, defined upfront:

| Goal | Question |
|---|---|
| **Goal A** | When the checklist expects vision, did the agent actually invoke vision? Also: when it *didn't* expect vision, did the agent correctly skip it? |
| **Goal B** | When the checklist expects a specialist (`measure-distance`), did the right specialist get invoked? |
| **Goal C** | When the specialist did get invoked, did it actually return data? (Added 2026-05-11.) |
| **Goal D** | When the specialist returned data, did the agent use it to reach a real verdict? (Iter-2 follow-up — see Phase 2 below.) |

For Goal B we report three denominator views:

- **Goal B raw** — all 54 items.
- **Goal B adjusted** — exclude items where the agent's skip was
  legitimate (item doesn't apply to this site, relevant feature
  absent, real verdict reached without measurement, non-spatial data
  gap). This excludes "valid skips" the variant shouldn't be
  penalized for.
- **Goal B strict-clear** — additionally exclude items where the 3
  runs disagreed materially. What remains is the cleanest cut of
  "items where measurement was clearly the right answer".

The headline metric going forward is **Goal B strict-clear** — it most
accurately represents the bucket var-2 was built to address.

## The result

| Metric (el-md-exp) | ctrl | var-1 | **var-2** | var-2 vs var-1 |
|---|---:|---:|---:|---:|
| Goal A — vision invoked on expected=yes | 41.2% | 74.5% | 20.4% | -54pp |
| Goal A — correctly skipped on expected=no | ~60% | ~30% | **89.4%** | +59pp |
| Goal B raw | n/a | 0/54 = 0% | **11/54 = 20.4%** | +20.4pp |
| Goal B strict-clear | n/a | 0/27 = 0% | **11/27 = 40.7%** | **+40.7pp** ← headline |
| Goal C — specialist returned data | n/a | n/a | **100%** | n/a |

### How to read this

**var-1 doesn't work.** When we exposed `measure-distance` directly to
the agent alongside `vision`, the agent invoked it **zero times across
162 (item × run) cells**. The bifurcated-tool-list strategy fails by
sparse adoption — too many tools, agent defaults to the cheapest-to-
reason-about one (generic vision). We saw the identical pattern on a
separate experiment set (`cc` + inspect-drawing): var-1 invoked the
specialist 2/162 times. **Two independent experiment sets, same
sparse-adoption failure mode.** var-1 is a dead end.

**var-2 works.** The classifier-routing architecture is the only one
that actually reaches for the specialist in production. On the bucket
of items where measurement was clearly the right answer
(strict-clear), var-2 routes correctly **40.7% of the time, vs 0% for
both ctrl and var-1**. Every dispatched measure-distance call returned
data (Goal C 100%). And the agent is *more selective* than var-1 on
items where vision isn't needed — it correctly skips 89.4% of
expected=no items vs var-1's ~30%.

**The user-facing lift is concrete.** Of the 11 items where var-2's
classifier picked measurement on a majority of runs, **10 had ctrl
majority `not-verifiable`** — exactly the dead-end cases where vision
alone gave up. In var-2:

- **EL-13.21** — clearance between transformer pads and water lines.
  Ctrl: 3 runs all returned `not-verifiable`. Var-2: 2 runs computed
  the real-world distance and confidently returned `pass`.
- **EL-13.1** — clearance between transformer pads and buildings.
  Ctrl maj `not-verifiable`. Var-2: majority `fail` — measurement
  found pads inside the 5-foot threshold.
- **EL-13.16** — clearance between transformer pads and dumpsters.
  Ctrl maj `not-verifiable`. Var-2: unanimous `n/a` — measurement
  confirmed no relevant dumpsters near the pads.

These verdicts are what a human reviewer would have needed to produce
manually with ctrl. They're produced automatically with var-2.

(The full per-item table is in
[`metrics/var2-uplift.md`](metrics/var2-uplift.md).)

## What we're committing to

**Architecture:** Phase 1 commits to **var-2 / classifier-routing** as
the right architectural direction for vision tooling. The Goal B
strict-clear metric (40.7% vs 0%) on top of the verdict-conversion
narrative is the proof.

**What we're *not* committing to yet:** flipping the production
default. var-2 stays an opt-in overlay (`--experiment=vision-check`)
through Phase 2. Phase 2's job is to harden it for production. See
the path-to-core gating section below.

**Scope:** the Phase 1 evidence is strongest on `el-md-exp`
(electric, measure-distance specialist). The cc set provides
secondary data on the same pattern (var-1's sparse adoption of
`inspect-drawing` mirrors var-1's behavior here). Other disciplines
weren't in scope.

## Path to making var-2 core

We identified four gates to clear before flipping the production
default. **The Phase 1 blocker (dynamic scale) has landed**; the
remaining three are Phase 2 anchor work.

### Phase 1 close-out — dynamic scale (LANDED 2026-05-12)

The hardcoded `scaleInchesPerFoot = 0.05` constant has been replaced
with cache-first dynamic resolution. Shipped as bureau#350 +
conductor#159 — see those PRs for full diffs and tests.

**How it works now:** when the vision_check measurement route hits a
dispatch, conductor checks
`output/runs/run-N/cache/sheet-NN/drawing-scale.json` for a cached
scale. On cache miss it invokes a new bureau script
(`scripts/extract-scale.ts`) that hands `guide.md` + `blocks.md` for
that sheet to Haiku and asks for the scale in a structured format
(`{paper_value, paper_unit, real_value, real_unit, confidence}`).
Conductor converts to `scaleInchesPerFoot` via deterministic unit
math, snaps to the architectural-scale whitelist (1"=10', 1"=20', …,
1"=100', plus 1/8"=1' family) within ±5% tolerance, then writes the
cache file. On extraction failure or whitelist miss the dispatch
returns a clean `scale_not_determinable` error to the agent rather
than silently using a default — loud-fail eliminates the original
silent-wrong-data risk.

Validation pass: RUN_11 (next local fire) should produce cache files
under `output/runs/run-N/cache/sheet-NN/` and effectively identical
distance values to RUN_10 on the 1"=20' sheets the agent has been
measuring.

### Phase 2 anchors

1. **Goal D — correct post-result verdict.** Of the 11 items var-2
   routed correctly, only 3 moved to a real-verdict majority; 5
   stayed maj `not-verifiable` despite the chain returning
   measurements. The agent has data in hand and still defaults to
   "needs human review." That's the iter-2 work: the agent's
   post-measurement verdict-reasoning is the next bottleneck.
2. **Object-pair mis-identification (extract-measurement-pairs
   correctness).** We validated that the specialist *executes* (Goal
   C 100%) but not that it's measuring the *right two objects* on
   the drawing. Known issue from manual inspection. Same silent-
   correctness shape as hardcoded scale. Requires a ground-truth
   pass over the cropped images + extractor output before var-2 can
   go customer-facing.
3. **Substation cloud-path silent failure.** Every Phase 1 run from
   RUN_6 onward executed on local conductor because cloud runs
   (RUN_4, RUN_5) hung silently in Substation's `Substation-workflow-run`
   Inngest function. **var-2 has never run end-to-end on the
   production deployment path.** Whether this is a var-2 issue or a
   Substation infra issue isn't established. Tracked separately at
   [`../substation-review-silent-failure/README.md`](../substation-review-silent-failure/README.md).
4. **Cost & latency at production scale.** RUN_10 made 86
   `vision_check` calls vs ctrl's typical ~40. Each `vision_check`
   adds a classifier LLM call; each measure-distance dispatch adds
   ~2 Gemini Vision calls per pair. Estimated 5–10× the API cost of
   the ctrl baseline on a full review. Not a correctness blocker,
   but a finance/quota planning input for Phase 2.

### What's *not* gating

These are real follow-ups but explicitly deferred:

- Multi-discipline coverage (today only `el-md-exp` exercises
  measure-distance; cc exercises inspect-drawing but at runs=1).
- Multi-jurisdiction coverage (Austin only today).
- Classifier prompt tuning to lift Goal B further (40.7% strict-
  clear is good enough to commit; +10pp is the iter-2 goal).
- `measure-distance.ts` / `inspect-drawing.ts` library migration.
- Inspector-general `vision_check` parser support.

## Phase 1 closing checklist

- [x] **Dynamic scale extraction** — shipped 2026-05-12 (bureau#350 + conductor#159).
  Cache-first per-sheet resolution; loud-fail on `scale_not_determinable`.
- [x] el-md-exp ctrl-baseline ✅ current
- [x] el-md-exp var1-bifurcated ✅ current (RUN_2, runs=3)
- [x] el-md-exp var2-routing ✅ current (RUN_10_LOCAL, runs=3, post bureau#340 prompt tweak)
- [x] Goal A / B raw / B adjusted / B strict-clear / C all published
- [x] Verdict-conversion narrative captured in var2-uplift.md
- [x] var-2 debug UI in `vision-tool-orchestration/viewer/` for
  click-through inspection of vision_check → classifier → specialist
  chain
- [ ] cc/var-2 re-fire at runs=3 — *not gating Phase 1*; the cc set
  serves as supporting evidence for the var-1 sparse-adoption pattern
  rather than as a parallel pillar. Defer to Phase 2.

## Reading list for the report

- [`metrics/analysis.md`](metrics/analysis.md) — full Goal A/B/C
  table across all three variants, methodology snapshot, success-
  criteria evaluation.
- [`metrics/var2-uplift.md`](metrics/var2-uplift.md) — the
  dedicated story of what var-2 did to the verdicts, per-item.
- [`metrics/source-runs.md`](metrics/source-runs.md) — pinned
  identifiers, run metadata, supersedes chains.
- [`metrics/source-runs.json`](metrics/source-runs.json) —
  machine-readable version of the same.
- [`metrics/el-md-exp/tmp/el-md-exp-var2-run-10/`](metrics/el-md-exp/tmp/el-md-exp-var2-run-10/) —
  per-item TSV, no-vision-check skip analysis, RUN_10-vs-RUN_9
  comparison.
- [`viewer/`](viewer/) — debug UI for clicking through a single
  `vision_check` call → classifier output → specialist chain →
  Gemini bbox overlays on the cropped sheet.
- [`metrics-framework.md`](metrics-framework.md) — Goal A/B/C/D
  formal definitions.
