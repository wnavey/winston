# Outstanding Issues — measure-distance tool

Tracked issues and improvements identified during the A/B experiment work.
Ordered roughly by impact, not effort. Updated after experiment-run4.

---

## Image quality & localization

### 1. Cropping to the drawing block — RESOLVED

~~Currently the tool sends the entire sheet page to Gemini.~~

**Status:** Fixed in bureau#233 (bbox format) + bureau#238 (two-call with
300 DPI refined crop). Run4 confirmed: all measurements use real drawing-block
crops, and call 2 operates on a 300 DPI refined region. Verified in the viewer.

### 2. Legend identification — CODE DEPLOYED, NOT YET EFFECTIVE

Bureau#243 (Phase B) deployed the legend image search code. It runs on every
call — `legend-search` events appear in run5 call-dirs. However, **all
searches return 0 results** because Valley View Townhomes lacks
`content_block` embeddings.

**Root cause:** The `search_content_blocks_hybrid` RPC needs non-null
`embedding` values on `content_block` rows. VVT's blocks have null embeddings.

**Fix:** Run embedding backfill from cityhall:
```bash
npx tsx scripts/backfill-content-block-embeddings.ts 63cead15-41f8-418c-b0ef-bd5c2b44719a
```

**Current behavior:** Falls back to the 15 KB text dump (same as pre-Phase B).
Run5's 89% conversion rate was achieved WITHOUT legend images — that's all
from the bbox fix.

**Once embeddings are computed:** Legend images should provide visual symbol
context to Gemini, potentially improving object identification accuracy on
ambiguous symbols.

See `analysis/improving-legend-and-bounding-box-plan.md` for full design.

### 14. Outlier distances from two-call coordinate mapping (new, run4)

Run4 produced 12 measurements exceeding 100 ft (max 462.8 ft) on a ~300 ft
property. The two-call pipeline's coordinate mapping between call 1 → refined
crop → call 2 appears to amplify errors when:
- The refined crop is small relative to the full page
- Call 1's coarse localization has low confidence (worst case: 0.30)

**Needs fixing before run5.** Options:
- Sanity-check upper bound: if measured distance > sheet physical dimensions,
  flag as low confidence
- Skip call 2 when call 1 confidence < threshold (e.g., 0.5)
- Expand the refined crop padding when call 1 confidence is low

### 15. Call 1 bbox bias on call 2 (new, investigation needed)

Call 2's image is literally the region that call 1 identified. If call 1
misidentifies the wrong feature, call 2 is looking at the wrong part of the
sheet — it can't course-correct. The prompt doesn't pass call 1's coordinates
to call 2 (good — no number-level bias), but the crop selection IS the bias.

Possible mitigations:
- Compare call 1 and call 2 object descriptions — if they disagree, flag
  low confidence
- Expand the crop when call 1 confidence is low
- Send the full drawing to call 2 as well (defeats the DPI purpose)

---

## Agent behavior

### 3. Agent under-uses the tool — IMPROVED

**Run1:** 5/9 agents invoked MD. **Run4:** 6/9, including item 1.md for the
first time. Prompt fix (bureau#225) is working. Still 3 agents that skip —
2 are on item 1.md (vertical clearance) which is expected, 1 is stochastic.

### 16. EL-13.20: agent should measure transformer pad-to-pad distance (TODO)

In run4, EL-13.20 (minimum 5-foot clearance between transformer pads) stayed
`not-verifiable` across all runs. The agent noted "five transformer pads shown
on Electrical Plan, no clearance dimensions provided between any pairs" but
never invoked the MD tool to measure the distances itself.

This is a textbook MD candidate: both objects (pad A and pad B) are visible on
Sheet 21, the scale is known (1"=20'), and the threshold is clear (5 feet).
The agent should be calling MD with objectPairs for each pad pair.

**Follow-up:** Investigate whether this is a prompt gap (agent doesn't think to
measure pad-to-pad), a tool-description gap (agent doesn't know it can measure
between two features of the same type), or stochastic (some runs might catch
it). Consider adding a worked example in the prompt for same-type-feature
measurements.

### 4. Agent passes wrong scale values — RESOLVED

**Status:** Fixed in bureau#225 (prompt fix with numeric examples). Run3 and
run4: 100% correct scale values (0.05 for 1"=20' sheets).

### 5. Agent should pass checklist context to the tool (medium impact)

The tool doesn't know which checklist item motivated the call. Agent passes
`reasoning` and `applicableChecklistItems` (bureau#235), but the tool doesn't
use them for threshold comparison. Future: auto-verdict.

### 6. How pre-processed blocks drive agent tool usage (research question)

Does blocks.md quality determine whether the agent knows there are features
to measure? Open research question for Phase 3.

---

## Tool reliability & performance

### 7. Python compute-distance timeout — PARTIALLY RESOLVED

Option A short-circuited (bureau#236), conductor timeout bumped to 600s
(conductor#125). Run4: zero timeouts. The 90s Python timeout remains but is
no longer the bottleneck.

### 8. Option A vector matching is a v1 stub (low urgency)

Fully disabled in bureau#236. Every call goes through Option B (Gemini).
Future R&D project to implement real pattern matching.

### 9. Gemini response time variability (medium impact)

No Gemini-level timeout exists. Run4 completed all Gemini calls within the
600s conductor timeout, but long-tail 200s+ calls are still possible.
Should add an AbortController on the generateText() call.

---

## Vertical distances & redlines

### 10. Vertical distance measurement (hard problem, high value)

23% of EL items need vertical clearance. Not addressable by the current
horizontal tool. Tracked as a separate roadmap item.

---

## Infrastructure & analysis

### 11. Compare-findings script — DONE

Implemented as `scripts/compare-findings.py`. Phase 1 metrics computed for
runs 1-5. Updated to treat missing experiment findings as implicit passes.
Run5 distance-only conversion: 89% (3 fail + 36 implicit pass / 44).

### 12. Conductor shell-quoting fix — RESOLVED

Merged in conductor#121 + conductor#123.

### 13. experiment-plan.md paths — RESOLVED

Updated to use relative paths and `$CONDUCTOR_DIR`.

---

## Follow-up items (lower priority)

### F1. Category-filtered RPC for legend block search

Current implementation (Phase B) uses the existing `search_content_blocks_hybrid`
RPC and post-filters to legend/symbol/diagram categories in TS. A purpose-built
RPC with an optional `categories` parameter would be more efficient. Requires
a cityhall migration. Track as a follow-up after Phase B is validated.

### F2. Per-phase latency logging — SHIPPED

Bureau#241 merged. Run5 captures per-phase timing in metadata.json.

### F3. Training v5.0 → v5.1 classification drift

Bureau#245 (training v5.1) changed item counts and deficiency text across all
departments. Only ZLU has been re-classified against v5.1 (1,517 → 1,672
items). Other departments' classifications are stale.

Impact: cross-department summary numbers (12,278 items, 1,537 horizontal)
are based on v5.0 and may be inaccurate for v5.1. Re-classification needed
before using these numbers in reports or the investment case.

### F4. Embedding backfill for experiment site plans

Phase B legend images require `content_block` embeddings. Valley View
Townhomes (the only experiment site plan so far) lacks embeddings. Any new
site plan used for experiments also needs the backfill run:
```bash
npx tsx scripts/backfill-content-block-embeddings.ts <projectId>
```

### F5. zlu-md-exp guide subset (bureau#263)

New ZLU experiment guide with the 3 highest-horizontal guides (15, 16, 32).
In review. Once merged, enables `--guide-code=zlu-md-exp` for cross-department
measure-distance experiments.
