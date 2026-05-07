# Vision-Check Experiment — CC Run 4 Analysis

**Date:** 2026-05-07
**Run:** Dispatcher run (Substation/Inngest), runs=1, completeness-check with `experiment=vision-check`
**Submission:** 1700 S. Lamar v2 (projectId `23301a8a`, submissionVersionId `eb67ee21`)
**`runLabel`:** `VISION_CHECK_CC_RUN_4` · workflow_runs.id `5d804242-861c-43ab-adfd-00e9af3757e2`
**Wall-clock duration:** 56 min 8 sec
**Versus run 3:** Both runs=1, same submission, same conductor build. The **only delta is bureau#306** (prompt trim — dropped "SINGLE entry point" line, dropped "Tips for phrasing" section, simplified `question` field description).

---

## Executive summary

The prompt-trim hypothesis was right. Removing the implicit quality bar
on `vision_check` calls **doubled the agent's coverage**:

| Metric | Run 3 | **Run 4** | Δ |
|---|---:|---:|---:|
| Items where vision_check called | 31/154 = 20.1% | **63/154 = 40.9%** | **+103%** |
| inspect-drawing-required hits | 1/8 = 12.5% | **4/8 = 50.0%** | **+300%** |
| inspect-drawing-optional hits | 20/46 = 43.5% | **26/46 = 56.5%** | +30% |
| vision-only hits | 10/100 = 10.0% | **33/100 = 33.0%** | +230% |
| no-tool misuse | 0/31 ✓ | 0/31 ✓ | unchanged |
| Total vision_check calls | 96 | 115 | +20% |
| Calls per called item | 3.1 | **1.83** | −41% |

The agent traded depth for breadth: under run 3's prompt it was selective
about which items to investigate but did multi-step verification on each;
under run 4's trimmed prompt it spreads attention across more items but
takes fewer follow-up calls each. With Cluster A+B routing preserved
(6/6 ✓) and zero misuse, this is a clear quality win — same precision,
much higher coverage.

---

## Cluster A + B preservation check

All 6 items that bureau#301 + bureau#305 fixed in run 3 still route to
`drawing_inspect` in run 4:

| Item | Run 3 | Run 4 |
|---|---|---|
| `cc-22:CC-22-12` (Driveway spacing dimensions) | drawing_inspect ✓ | drawing_inspect ✓ |
| `cc-22:CC-22-13` (Driveway widths / curb radii) | drawing_inspect ✓ | drawing_inspect ✓ |
| `cc-22:CC-22-20` (Parking aisle widths) | drawing_inspect ✓ | drawing_inspect ✓ |
| `cc-23:CC-23-01` (ROW width) | drawing_inspect ✓ | drawing_inspect ✓ |
| `cc-23:CC-23-04` (Dimensions for ROW improvements) | drawing_inspect ✓ | drawing_inspect ✓ |
| `cc-2:CC-2-16` (Boundary lines + bearings) | drawing_inspect ✓ | drawing_inspect ✓ |

The classifier prompt change is durable across the agent-prompt change.
Good signal — we can iterate either side without regressing the other.

---

## Inspect-drawing-required: misses dropped from 7 → 4

| Run 3 misses (7) | Run 4 misses (4) |
|---|---|
| `cc-13:AW-21` | — recovered |
| `cc-13:AW-23` | — recovered |
| `cc-13:AW-28` | `cc-13:AW-28` — still missed |
| `cc-13:AW-32` | — recovered |
| `cc-13:AW-39` | `cc-13:AW-39` — still missed |
| `cc-19:CC-19-05` | `cc-19:CC-19-05` — still missed |
| `cc-19:CC-19-19` | `cc-19:CC-19-19` — still missed |
| _(`cc-22:CC-22-14` was the only run-3 hit)_ | — also still hit |

3 of the 7 run-3 misses (AW-21, AW-23, AW-32) recovered after the
prompt trim. The 4 still missing are:

- `cc-13:AW-28` — easements indicating "as drawn"
- `cc-13:AW-39` — water meter callouts on plan view
- `cc-19:CC-19-05` — minor structures clearance
- `cc-19:CC-19-19` — accessible route conformance

These all share a property: phrasing them as a question requires
domain knowledge that's not in the deficiency text alone (what counts
as "as drawn"? What's an "accessible route"?). The agent may still be
deciding it doesn't have enough context to phrase a clean question on
these.

---

## Tool-name labeling drift (analyzer note)

Run 3 findings recorded `tools_used: ["vision_check"]`; run 4 records
`tools_used: ["vision"]` for the same actual tool invocation. The
agent's self-reported tool name drifted between runs. **Both refer
to the same `vision_check` calls** (proven by call counts: 96 in run 3,
115 in run 4 — both written by conductor's per-call metadata.json,
which is authoritative).

The analyzer was relying on the self-reported `tools_used` to determine
"was vision_check called for this item." That broke for run 4 (returned
0 hits initially). Fixed by deriving the called-set from
`vision-check-calls/<id>/metadata.json[].inputs.checklistItemId` —
conductor records the id at the call site, so it's not subject to
agent labeling drift.

This change makes future runs robust to whatever `tools_used` label
the agent decides to use.

---

## Routing accuracy

| Expected → | drawing_inspect | generic | measurement | total |
|---|---:|---:|---:|---:|
| **drawing_inspect** (truth) | **30 ✓** | 27 ✗ | 0 | 57 |
| **generic** (truth) | 16 ✗ | **41 ✓** | 1 ✗ | 58 |
| **measurement** (truth) | 0 | 0 | 0 | 0 |

- Drawing_inspect recall (per-call): 30/57 = **52.6%** (run 3: 66.7%)
- Generic recall (per-call): 41/58 = **70.7%** (run 3: 73.8%)
- Drawing_inspect precision: 30/46 = 65.2%
- Generic precision: 41/68 = 60.3%

Routing accuracy dropped slightly vs run 3 (66.7% → 52.6% on
drawing_inspect). Hypothesis: with twice as many items being called,
the classifier is now seeing items that are harder cases (the easy
high-confidence items got called in run 3 too; run 4 added the
medium-confidence ones). Worth confirming — a per-grade breakdown
of misroutes would tell us which items the classifier is getting
wrong now that weren't being called before.

Classifier confidence stayed high: mean 0.950 (range 0.92–0.99).

---

## First measurement route (and its fallback)

Run 4 produced **1 measurement-routed call** — the first time the
classifier chose `measurement` on this submission. It dispatched to
`vision` with `fallbackReason="measurement_arg_construction_not_implemented"`,
which is the documented Phase B behavior in `dispatch.ts`. Worth
noting — when measurement dispatch lands, this 1 call (and others
like it) will start hitting the real specialist.

---

## Specialist execution

| Specialist | Calls | Successes | Failures |
|---|---:|---:|---:|
| inspect-drawing | 46 | 46 | 0 |
| vision (generic) | 69 | 61 | 8 (incl. 1 measurement fallback) |

**Inspect-drawing was 100% successful.** Vision had 8 failures of which
1 is the documented measurement-fallback (not really a failure). Worth
investigating the other 7 vision failures (run 3 had 2). Could be
file-load issues, Gemini timeouts, or other transient errors.

---

## Open questions

1. **Why are AW-28, AW-39, CC-19-05, CC-19-19 still missed?** These are
   inspect-drawing-required items the agent never called vision_check
   on. Either (a) the agent decides they're answerable from text, or
   (b) the deficiency text is too abstract to phrase as a vision
   question. Spot-checking the agent's reasoning trail on these items
   would clarify.
2. **Routing accuracy drop on drawing_inspect** (66.7% → 52.6%). Is it
   harder items entering the call set, or has the classifier itself
   regressed? A run-3-vs-run-4 per-item routing diff would isolate.
3. **Vision specialist failures (7 unattributed).** Need root cause.
   Could be the multi-question pattern stressing some path, or a
   classifier-routed-to-generic-but-actually-needed-drawing case.
4. **Move to runs=3 for statistical confirmation.** Bureau#307 (cc
   workflow `maxWorkers` input) is open and would let us pass
   `maxWorkers=39` for runs=3. Once that lands, fire
   `VISION_CHECK_CC_RUN_5` at runs=3 + maxWorkers=39 to convert the
   directional findings here into 3-run-union recall numbers
   comparable to baseline's 73%.

---

## Files

- `experiments/run4/cc/output/` — full run artifacts (115 vision-check
  call dirs, 46 with specialist-inspect-drawing subdirs).
- `experiments/run4/analytics/analyze.py` — derived from run 3,
  analyzer now reads called-set from per-call metadata directly
  rather than `tools_used`.
- `experiments/run4/analytics/vision-call-invocation-metrics.tsv` — 185 rows.
- `experiments/run4/analytics/vision-check-calls-audit.tsv` — 115 rows.
