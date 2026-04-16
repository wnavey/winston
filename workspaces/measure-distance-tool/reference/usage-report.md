# Measure-Distance Tool — Usage Report

**Project:** Valley View Townhomes (`63cead15-41f8-418c-b0ef-bd5c2b44719a`)
**Submission version:** `55fb6548-814f-4287-bc4a-6018b756d730`
**Discipline:** Electric (`el`)
**Workflow:** `review-4.3` v4.3.0
**Run date:** 2026-04-15 (local run, Williams-MBP.lan)
**Workflow run id:** `3a773334-8f27-4a92-85ef-5941c4a7d788`
**Bureau commit under test:** `0e991fb9` — shell quoting fix (`execFileSync` + temp `.py` file)

---

## Workflow outcome

The workflow ran all three ensemble review passes to completion, consolidated findings, and synthesized structured comments. It **failed at the `organize-sections` finalization step** (`authentication_failed`), so no review was persisted to Supabase. This failure occurred well after the measure-distance tool had finished executing and did not affect tool behavior.

**Key consequence for attribution:** because the review never reached `saveReviewToDb()`, the post-hoc `applyToolAttribution()` routine in `conductor/src/shared/review-saver.ts` never ran. As a result:
- No `review_comments` rows exist in the DB for this run.
- `agent_trace.tools_used` is **not** populated anywhere — not in the DB and not on disk.
- The tool's effect on the review is inferable only from (a) the sidecar log file `output/measure-distance-log.json`, (b) the four debug PNGs in `output/measure-distance/`, and (c) language in the per-run findings under `output/runs/*/findings/`.

---

## Shell-quoting fix verification

The April 10 Vercel sandbox run (`e260d4a3`) saw **22/22 measure-distance calls fail** with `SyntaxError: unexpected character after line continuation character` in `cropJpeg`'s inline `python3 -c` subprocess. In this 2026-04-15 run, **zero** `SyntaxError` failures occurred across 19 invocations. The `execFileSync`/temp-file refactor in `0e991fb9` fully resolves that class of bug. ✅

---

## Invocation summary

| Metric | Value |
|---|---|
| Total invocations | 19 |
| Successes | 6 (31.6%) |
| Failures | 13 (68.4%) |
| Debug PNGs produced | 4 (sheets 9, 19, 21, 31) |
| Distinct guide items reached | 7 |
| Distinct guide items with ≥1 success | 3 |
| Distinct sheets measured | 4 |

### Checklist coverage

- **Total checklist items (el discipline):** 20
- **Items that attempted the tool:** 7/20 = **35.0%** → guide items `2, 3, 4, 7, 13, 14, 16`
- **Items with at least one successful call:** 3/20 = **15.0%** → guide items `7, 13, 16`

### Invocations over time

| # | Time (UTC) | Run | Guide | Sheet | ObjectA (truncated) | ObjectB (truncated) | Scale | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | 22:59:08 | run-1 | el-13 | 21 | Transformer Pad 1 near Bldg 2 U201 | West wall of Building 2 | 0.05 | ✅ OK |
| 2 | 23:01:08 | run-1 | el-3  | 21 | Electrical meters on Bldg 1 W wall | Bldg 1 foundation edge nearest | 1 | ❌ timeout |
| 3 | 23:03:08 | run-1 | el-13 | 21 | Transformer pad NW near Bldg 2 | Property line / sidewalk boundary | 0.05 | ✅ OK |
| 4 | 23:05:07 | run-1 | el-3  | 21 | (timeout) | — | — | ❌ timeout |
| 5 | 23:07:08 | run-1 | el-3  | 21 | (timeout) | — | — | ❌ timeout |
| 6 | 23:09:55 | run-2 | el-4  | 3  | Transmission structure vicinity | Proposed grading boundary | — | ❌ timeout |
| 7 | 23:11:57 | run-1 | el-7  | 31 | Mitigation trees SE corner | Property line / easement | — | ✅ OK |
| 8 | 23:14:11 | run-2 | el-14 | 9  | Transformer pad | Sidewalk / ped path | — | ❌ timeout |
| 9 | 23:16:14 | run-2 | el-14 | 9  | (timeout) | — | — | ❌ timeout |
| 10 | 23:19:19 | run-2 | el-16 | 31 | Mitigation trees SE | OHE utility line | — | ✅ OK |
| 11 | 23:21:13 | run-3 | el-14 | 9  | (missing args) | — | — | ❌ missing args |
| 12 | 23:21:16 | run-3 | el-14 | 9  | (timeout) | — | — | ❌ timeout |
| 13 | 23:23:16 | run-3 | el-13 | 21 | (timeout) | — | — | ❌ timeout |
| 14 | 23:25:18 | run-3 | el-16 | 31 | (timeout) | — | — | ❌ timeout |
| 15 | 23:27:18 | run-2 | el-13 | 21 | (timeout) | — | — | ❌ timeout |
| 16 | 23:29:18 | run-2 | el-13 | 19 | Transformer pad / access area | Adjacent structure / drive | — | ✅ OK |
| 17 | 23:31:07 | run-3 | el-3  | 21 | (timeout) | — | — | ❌ timeout |
| 18 | 23:33:08 | run-3 | el-2  | 31 | Mitigation trees southern boundary | OHE utility line | 0.05 | ✅ OK |
| 19 | 23:34:55 | run-3 | el-2  | 31 | (timeout) | — | — | ❌ timeout |

*(ObjectA/B for failed calls are still in the log under each invocation — the table abbreviates for readability.)*

---

## Error analysis

### Failure breakdown

| Error | Count | Interpretation |
|---|---|---|
| `spawnSync /bin/sh ETIMEDOUT` | 12 | Python subprocess exceeded the 90-second `callPython` timeout |
| "Missing required arguments" | 1 | The agent omitted a required arg (`--scaleInchesPerFoot` missing once in run-3/el-14) |
| SyntaxError (shell quoting) | **0** | ✅ Fixed by `0e991fb9` |

### Root cause of the new timeout failures

The sidecar log captured on sheet 31 shows:

- `measure-distance:option-a` → 69,939 total vector paths, 44,743 after filtering (Python PyMuPDF)
- `measure-distance:option-a-result` → **failed after ~90 seconds**, `"Python option-a call failed"`
- `measure-distance:option-b` (Gemini vision) → succeeded in ~4 seconds, confidence 0.9
- Total `elapsed_ms`: **97,331** — right at the ceiling of `callPython`'s 90s timeout

Sheet 21 (Electrical Design Plan) has dense vector geometry; option-a's clustering pass is the bottleneck. Invocations that didn't get to option-b before the 90-second hammer fell show up as `ETIMEDOUT` in `callPython`. Option-b by itself is fast — the problem is that we're spending the full timeout budget on option-a before ever reaching the fallback.

### Sidecar log completeness

`output/measure-distance-log.json` contains exactly **one** invocation's events (the final, sheet-31 measurement). The script overwrites this file on each invocation rather than appending. This is a v1 log mechanism that silently drops history — contrast with `output/vision-log.jsonl` which uses JSONL append-only format. The four debug PNGs in `output/measure-distance/` (sheets 9, 19, 21, 31) are the only remaining evidence of the other 5 successful measurements.

---

## Successful measurements

Based on debug PNGs and the sole log entry:

| Sheet | Debug PNG | Guide(s) likely triggering | Notes |
|---|---|---|---|
| 9  | `sheet-9-measurement.png`  (4.7 MB) | el-14 access-drive checks | Transformer pad → drivable surface |
| 19 | `sheet-19-measurement.png` (3.8 MB) | el-13 pad clearance | Pad → adjacent feature |
| 21 | `sheet-21-measurement.png` (3.5 MB) | el-13 pad clearance | Electrical Design Plan |
| 31 | `sheet-31-measurement.png` (3.8 MB) | el-2, el-7, el-16 tree/OHE | Landscape Plan |

The one fully-logged measurement (run-3, el-2, sheet-31): trees in SE corner → OHE line on southern boundary. Returned `distanceFeet: 0.1` with `confidence: "low"`, `method: "vision"`, `fallbackUsed: true`.

---

## Agent trace verification

### 1. Tool use captured in `tools_used` (DB)

**Not captured.** `applyToolAttribution()` never ran (workflow failed at `organize-sections` before review save). Had it run, the agent-trace population logic (review-saver.ts:182-198) would have found only 1 qualifying `measure-distance:result` event in the sidecar log — far less than the 6 successful calls — due to the log-overwrite bug described above.

### 2. Tool use captured in agent observation / reasoning (on-disk findings)

Scanning all 60 per-run findings JSON files (`output/runs/run-*/findings/*.md.json`):

- **Explicit named references to the tool:** 1 finding (run-2, EL-13.38):
  > *"The measure-distance tool confirmed the pad NW of Bldg 1 is 0 feet from the driveway edge (touching the driveway)."*

- **Quantitative distance statements in observations/reasoning:** 16 distinct distance callouts across 8 guide items. However, many of these are explicitly flagged by the agent as *visual/scale-based estimates* (e.g., *"approximately 6 feet based on visual scale (1" = 20')"*) rather than tool-derived measurements. The agent does not reliably distinguish tool-derived measurements from vision estimates in prose.

**Conclusion:** The agents are using the tool's outputs when they call it, but they are not consistently citing the tool by name. Of the 6 successful invocations, exactly **1** (EL-13.38) resulted in a finding that explicitly names the tool. The others show up as unannotated distance claims.

---

## Side observations

- **Scale parameter is unreliable.** Across 19 invocations, the `--scaleInchesPerFoot` argument was passed as `"0.05"` (10 times), `"1"` (4 times), and omitted/other (5 times). The correct value for 1" = 20' is `"0.05"`. Agents that passed `"1"` or omitted the arg will have produced wildly wrong distance results even on successful measurements. The prompt in `review.md` should make the scale convention concrete (one example per common scale).
- **`drawingBlockBbox` resolved to `{x0:0,y0:0,x1:1,y1:1}` on sheet 21 and `null` on sheet 31** — i.e., the block detector either returned the full page or nothing. Downstream cropping is therefore a no-op, which likely contributes to option-b confidence being treated as low.
- **Average invocation spacing is ~2 minutes.** With 19 calls × 2 min ≈ 38 minutes of wall time devoted to this tool during review-runs. If option-a is going to keep timing out, short-circuiting it sooner would reclaim substantial runtime.

---

## Recommendations

1. **Convert `measure-distance-log.json` to JSONL append-only** (match `vision-log.jsonl`). Without this, the tool-attribution logic can only ever see the last call and we lose evidentiary history.
2. **Trip-break option-a when `totalPaths > ~50,000`** (or track per-PDF) and jump straight to option-b. On this site plan, option-a never succeeded even when given the full 90s.
3. **Raise the `callPython` timeout budget or split it** (e.g., 30s option-a, 60s option-b).
4. **Tighten the review prompt on two points:**
   - Require agents that cite a tool-derived distance to name `measure-distance` explicitly in the observation — this is necessary for downstream audit and the `tools_used` attribution to be useful.
   - Show a concrete scale-to-parameter example (`1" = 20' → scaleInchesPerFoot=0.05`) in the Using the Measure-Distance Tool section of `review.md`.
5. **Audit the `drawingBlockBbox` detector on sheet 21** — a full-page bbox suggests the layout extractor isn't finding the title block/drawing region, which hurts crop quality and option-b accuracy.
