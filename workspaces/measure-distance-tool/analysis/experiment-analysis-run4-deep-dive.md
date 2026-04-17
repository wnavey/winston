# Experiment Run4 Deep Dive — 2026-04-17

First experiment run with the two-call Gemini pipeline (Phase A). Same guide
subset (1.md, 2.md, 13.md), Haiku 4.5, 3 runs × 3 items = 9 agents. Duration:
~41 minutes (20:31–21:13 UTC).

## Run configuration

- **Workflow:** review v5.1.0 + measure-distance experiment overlay
- **Guide:** `el-md-exp` (items 1.md, 2.md, 13.md)
- **Site plan:** Valley View Townhomes (SP-2025-0126C)

### Fixes applied since run3

| PR | Fix |
|----|-----|
| bureau#235 | Capture reasoning + applicableChecklistItems in metadata |
| bureau#236 | Short-circuit Option A (skip the 60-80s v1 stub entirely) |
| bureau#238 | **Two-call Gemini approach** — call 1 at 120 DPI, refined crop at 300 DPI, call 2 for precise nearestPoints |
| conductor#125 | Script-tool timeout bumped from 120s to 600s |

## Two-call Gemini breakdown

This is the headline new capability. 55 call-dirs total:

| Category | Count | Description |
|----------|------:|-------------|
| **Both call1 + call2 succeeded** | 41 | Full two-call pipeline completed end-to-end |
| **Call1 only (call2 failed)** | 0 | No call2 fallbacks — 100% success on the second call |
| **Neither (parent dirs)** | 14 | objectPairs batch orchestrator dirs (contain shared assets, no localization) |
| **Total** | **55** | |

**100% call2 success rate.** Every coarse localization that call1 produced led
to a successful refined crop + call2 result. No fallbacks to call1 were
triggered.

### Gemini confidence comparison (call1 vs call2)

For the 41 two-call measurements:

| Confidence metric | Call 1 (coarse, 120 DPI) | Call 2 (refined, 300 DPI) |
|---|---|---|
| Min confidence | 0.30 | 0.40 |
| Median confidence | 0.95 | 0.90 |
| Mean confidence | 0.92 | 0.91 |
| ≥0.90 | 37/41 (90%) | 37/41 (90%) |

Confidence is comparable between calls — Gemini is roughly equally confident
at both resolutions. The value of call2 is not higher confidence but higher
PRECISION (more pixels = smaller localization error in physical space).

## Measurement results

### Summary

| Metric | Value |
|--------|------:|
| Total results | 41 |
| Non-zero distances | 35 (85%) |
| Zero distances | 6 (15%) |
| Median distance | 27.3 ft |
| Distance range | 0 – 462.8 ft |

### Distance distribution

| Range | Count | % | Notes |
|-------|------:|---:|------|
| 0 ft (exact) | 6 | 15% | Tree symbols directly overlapping OHE line |
| 0.1 – 10 ft | 4 | 10% | Plausible close clearances (transformer-to-parking, tree-to-OHE) |
| 10 – 50 ft | 14 | 34% | Typical building/feature clearances |
| 50 – 100 ft | 5 | 12% | Cross-site distances |
| 100 – 200 ft | 8 | 20% | Suspect — may exceed property dimensions |
| > 200 ft | 4 | 10% | Likely measurement errors (462.8 ft max) |

### Suspect large measurements

Several measurements exceed what's physically plausible for this ~2-acre
residential site (maximum property dimension ~300 ft):

- **462.8 ft** (run-2/13.md -p2) — likely a coordinate mapping error in the
  two-call pipeline
- **321.3 ft** (run-1/2.md -p4) — near the property boundary limit
- **260.7 ft** (run-2/13.md -p3) — the call1 confidence for this pair was
  only 0.30 (very low), and call2 was 0.40

These outliers suggest the coordinate transformation between call1's 0-1000
space → refined crop → call2's 0-1000 space may have edge cases that amplify
errors, particularly when the call1 coarse localization has low confidence.

### Plausible-range measurements (0-50 ft)

The 24 measurements in the 0-50 ft range are physically plausible for this
site plan:

- **Tree-to-OHE clearances:** 0, 0, 0, 3.3, 4.3, 9.2, 12.6, 17.5 ft
- **Transformer-pad-to-feature:** 0.6, 14.0, 17.1, 20.3, 25.4, 26.0, 26.7,
  27.3, 28.6, 41.9, 48.1 ft

The 0.6 ft measurement (transformer-pad-to-parking) is particularly notable:
the agent used it to cite a specific violation of the 4-foot bollard
requirement (EL-13.38).

## Agent behavior

### Tool adoption

| Agent | MD calls | Call-dirs | Results | Non-zero | Notes |
|-------|---------|-----------|---------|----------|-------|
| run-1/1.md | **1** | 3 | 2 | 1 | **First time 1.md invoked MD!** |
| run-1/2.md | 1 | 7 | 6 | 3 | Batched 6 pairs |
| run-1/13.md | 0 | — | — | — | Skipped MD |
| run-2/1.md | 0 | — | — | — | Skipped MD |
| run-2/2.md | 3 | 11 | 8 | 6 | Most pairs across 3 calls |
| run-2/13.md | **4** | 21 | 17 | 17 | Heaviest user — 100% non-zero |
| run-3/1.md | 0 | — | — | — | Skipped MD |
| run-3/2.md | 1 | 4 | 3 | 3 | All non-zero |
| run-3/13.md | 3 | 9 | 5 | 5 | All non-zero |

**6 of 9 agents invoked MD** (same as run3). The breakthrough: **run-1/1.md
called the tool for the first time** — item 1.md (Site Feature Clearances from
OHE) had been universally skipped in all previous runs. The agent measured
tree-to-OHE distance and cited "3.3 feet and 0 feet" in its EL-1.37 finding.

**run-2/13.md was the power user:** 4 separate tool calls batching 17 pairs
across transformer-pad clearance measurements. Every single one produced a
non-zero distance.

### Agent citing distances in findings

The quality of finding citations continues to improve:

> **run-1/1.md [EL-1.37] fail:** "Trees are proposed within 10 lateral feet of
> overhead distribution conductors (**measured distances 3.3 feet and 0 feet**
> from OHE line per measure-distance tool)."

> **run-2/13.md [EL-13.38] fail:** "Transformer Pad 4 is located only **0.6
> feet** from a parking or vehicle circulation area, placing it well within the
> 4-foot threshold that triggers bollard requirements."

> **run-3/2.md [EL-2.6] fail:** "Measurement of the landscape plan shows a
> mitigation tree positioned only **9.2 feet** from the utility pole on the
> southeastern property boundary. This violates the minimum 10-foot clearance."

> **run-1/2.md [EL-2.1] not-verifiable:** "Overhead distribution electric line
> present with six mitigation trees (**measured at 0, 0, 12.6, and 0 feet
> lateral distances** from conductor)." — Agent batched 6 measurements and
> cited all of them in one finding.

### Finding counts

| Agent | Findings | fail | not-verifiable |
|-------|---------|------|---------------|
| run-1/1.md | 12 | 5 | 7 |
| run-1/2.md | 8 | 4 | 4 |
| run-1/13.md | 38 | 3 | 35 |
| run-2/1.md | 12 | 9 | 3 |
| run-2/2.md | 5 | 2 | 3 |
| run-2/13.md | 29 | 3 | 26 |
| run-3/1.md | 9 | 1 | 8 |
| run-3/2.md | 6 | 2 | 4 |
| run-3/13.md | 12 | 2 | 10 |
| **Total** | **131** | **31** | **100** |

### Phase 1 metrics (run4 vs baseline)

| Metric | Value |
|--------|------:|
| Invocation recall | 56.1% (32/57) |
| Completion rate | 315% (41 results from 13 invocations) |
| Finding conversion (nv → fail) | 15.4% (6/39) |

## What's working

1. **Two-call pipeline is stable** — 41/41 call2 completions (100%), zero
   fallbacks
2. **Measurement volume tripled** — 41 results (up from 12 in run3)
3. **85% non-zero rate** — up from 75% in run3
4. **Item 1.md breakthrough** — first MD invocation ever on this item
5. **Batched measurements in findings** — agent cites multiple distances per
   finding (e.g., "measured at 0, 0, 12.6, and 0 feet")
6. **Specific threshold comparisons** — "0.6 feet... well within the 4-foot
   threshold", "9.2 feet from the utility pole... violates the minimum 10-foot"

## What needs investigation

1. **Outlier distances (100+ ft)** — 12 of 41 measurements exceed 100 ft.
   Several exceed the property dimensions (~300 ft). Likely a coordinate
   mapping edge case in the two-call pipeline when the refined crop is near
   a page edge or the coarse bbox has low confidence.

2. **Agent tracing** — without observation/reasoning in the schema, we can't
   determine WHY run-1/13.md skipped MD while run-2/13.md used it 4 times.

3. **Ground truth** — still needed. The plausible-range measurements (0-50 ft)
   look right but haven't been verified against human measurement.
