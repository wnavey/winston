# Run 1 — `inspect-drawing` tool-usage analysis

**Run:** `VISION_EXP_INSPECT_DRAWING_RUN_1`
**Workflow run ID:** `386b040b-3f75-47ab-af5c-26e8f6b74e9b`
**Review ID:** `51586bce-e7d8-4fce-834d-4437abe0df1a`
**Project:** 1700 S. Lamar (`23301a8a-…`)
**Submission version:** v2 (`eb67ee21-…`)
**Checklist:** `v2.5-trimmed`, 185 items
**Runs:** 3 (`runs=3`, runIndex `run-1` / `run-2` / `run-3`)
**Experiment:** `--experiment=inspect-drawing`
**Model:** `claude-sonnet-4-5-20250929`
**Status:** `completed` (all 3 runs finished, no review-step failures)

Reference grades come from
[`../../cc-vision-classification/cc-classification.tsv`](../../cc-vision-classification/cc-classification.tsv).

Source data:

- [`per-item-grade-vs-actual.tsv`](./per-item-grade-vs-actual.tsv) — full join of (run × 185 items × grade × tools_used × call count). 555 rows.
- [`inspect-drawing-calls-summary.tsv`](./inspect-drawing-calls-summary.tsv) — one row per actual `inspect-drawing` call (3 rows).
- [`analyze.py`](./analyze.py) — script that produced both TSVs and the printed stats.

---

## Headline numbers

| | Count |
|---|---:|
| **Total `inspect-drawing` calls across the whole run** | **3** |
| Total review steps run | 555 (185 items × 3 runs) |
| Calls / step | 0.5% |
| Distinct items invoking the tool | 2 (`AW-21`, `AW-23`) |
| Distinct (item × run) cells invoking the tool | 2 (both in run-1) |
| Calls in run-1 / run-2 / run-3 | **3 / 0 / 0** |
| Calls outside cc-13 | 0 |
| Tool errors | 0 — all 3 calls returned structured output, `confidence=0.95` |

The agent invoked `inspect-drawing` only in run-1, only on `cc-13`, and only on 2 of the 5 cc-13 items where `cc-vision-classification` says the call is **required**.

## Did it work?

**Yes — at the tool layer.** All 3 calls returned structurally valid output:

| Call | Item | Sheet | Result | Confidence | Tool worked |
|---|---|---|---|---:|---|
| `…mzfa-run-1-cc-13` | AW-23 | 19 | `classification=no` | 0.95 | ✅ |
| `…yx42-run-1-cc-13` | AW-23 | 18 | `classification=yes` | 0.95 | ✅ |
| `…og4a-run-1-cc-13` | AW-21 | 19 | `classification=no` | 0.95 | ✅ |

`unanswerable=false` on all three. No retries, no parse failures, no fallbacks. The Phase 1 pipeline (crop drawing block → Gemini at 150 DPI → structured output) produced the answers it was designed to produce.

**No — at the agent integration layer.** Two real concerns surface in the findings:

1. **The agent did not credit `inspect-drawing` for the answer.** For AW-21 / run-1, the finding's `observation` reads *"…visual confirmation of double-line depiction for pipes ≥24 inches could not be obtained due to vision tool limitations"* — even though `inspect-drawing` returned a confident `no` (pipes shown as single lines) on sheet 19. The agent attributes the verdict to vision tool failure rather than to the inspect-drawing answer it actually got.
2. **The agent contradicted `inspect-drawing` on AW-23 / run-1.** Inspect-drawing call on sheet 18 returned `classification=yes` (flow arrows present); the finding's reasoning quotes "vision tool analysis confirmed… no visible flow direction arrows" on sheet 18 and finalizes `status=fail`. So when vision and inspect-drawing disagreed, the agent picked vision.

The cc-13 run-1 finding for AW-23 also lists `tools_used=["vision","semantic-search-blocks"]` — `inspect-drawing` is not mentioned. See "Tracking bug" below.

## Hit rate vs `cc-vision-classification`

Across all 3 runs (so 8 required items × 3 runs = 24 opportunities total):

| Grade | Opportunities | Calls | Hit rate |
|---|---:|---:|---:|
| `inspect-drawing-required` | 24 | 2 | **8.3%** |
| `inspect-drawing-optional` | 138 | 0 | 0.0% |
| `vision-only` | 300 | 0 | 0.0% |
| `no-tool` | 93 | 0 | 0.0% |

Excluding cells where the agent ruled the item `not-applicable` (i.e. only counting cells where the agent actively engaged):

| Grade | Applicable opportunities | Calls | Hit rate |
|---|---:|---:|---:|
| `inspect-drawing-required` | 13 | 2 | **15.4%** |

### Per-run breakdown of the 8 required items

`hit` = inspect-drawing was called at least once for that (run, item).
`status` = the agent's final verdict.

| Item | run-1 status | run-1 hit | run-2 status | run-2 hit | run-3 status | run-3 hit |
|---|---|---:|---|---:|---|---:|
| `cc-13 / AW-21` | fail | ✅ | fail | ❌ | fail | ❌ |
| `cc-13 / AW-23` | fail | ✅ | fail | ❌ | fail | ❌ |
| `cc-13 / AW-28` | pass | ❌ | n/a | — | n/a | — |
| `cc-13 / AW-32` | n/a | — | n/a | — | fail | ❌ |
| `cc-13 / AW-39` | n/a | — | n/a | — | n/a | — |
| `cc-19 / CC-19-05` | n/a | — | n/a | — | n/a | — |
| `cc-19 / CC-19-19` | n/a | — | n/a | — | n/a | — |
| `cc-22 / CC-22-14` | pass | ❌ | fail | ❌ | fail | ❌ |

Observations:
- **AW-21 and AW-23 in run-1 are the only successful cells.** Same agent prompt + same model + same tools, runs 2 and 3 simply did not reach for inspect-drawing on either item, even though they reached the same `fail` verdict.
- **CC-22-14 (adjacent driveways) is the strongest miss.** Per cc-vision-classification, the validation methodology *itself* describes the visual pattern — yet the agent never invoked the tool on this item across 3 runs (passed once, failed twice, no calls).
- **Several required items came back `not-applicable`** — AW-39 (drain field), CC-19-05 (drainage easement contains floodplain), CC-19-19 (drainage area maps). Those are legitimate not-applicable verdicts for this submission (city-sewer site, no RSMP), so they don't count as missed opportunities.

### Misuse / negative reference set

| Grade | Opportunities | Calls | Misuse rate |
|---|---:|---:|---:|
| `vision-only` | 300 | 0 | 0% |
| `no-tool` | 93 | 0 | 0% |

**Zero misuse.** The agent never invoked `inspect-drawing` on a vision-only or no-tool item. This is a clean signal — the tool's prompt steering ("use only for drawing-region questions") is working, even if adoption is low.

## Tracking bug — `tools_used` does not record `inspect-drawing`

The per-finding `tools_used` field captures `vision`, `semantic-search-blocks`, and `Read` — but **never `inspect-drawing` / `script:inspect-drawing` / `run_inspect_drawing`** in any of the 555 findings, despite the actual per-call directory artifacts proving the tool was invoked.

| Tool name in `tools_used` | Findings mentioning it |
|---|---:|
| `vision` | 186 |
| `semantic-search-blocks` | 38 |
| `Read` | 17 |
| any name containing "inspect" | **0** |

Implication: any downstream analysis that relies on `tools_used` to count inspect-drawing usage will undercount it to zero. The ground truth lives in `output/inspect-drawing-calls/<callId>/metadata.json` per-call directories.

This is likely a name-mapping miss in whichever step builds the `tools_used` array (probably in `build-review-comments.ts` or `enrich-findings.ts`). Worth filing as a bug.

## What the 3 calls looked like (per-call detail)

### Call 1 — AW-23, sheet 19 (`…mzfa-run-1-cc-13`)

> **Question:** Do the wastewater lines shown on the plan views have direction-of-flow arrows on the wastewater line itself?

> **Result:** `classification=no`, confidence 0.95. *"Based on the provided plan view, the wastewater lines do not have direction-of-flow arrows drawn on the lines themselves. Both the proposed solid lines and the existing dashed lines lack these symbols."*

### Call 2 — AW-23, sheet 18 (`…yx42-run-1-cc-13`)

> **Question:** Do the wastewater lines shown on the utility plan have direction-of-flow arrows on or adjacent to the wastewater lines to indicate flow direction?

> **Result:** `classification=yes`, confidence 0.95. *"Yes, the wastewater lines shown on the utility plan feature direction-of-flow arrows. These arrowheads are placed directly on the linework of the wastewater lines."*

**Note:** Calls 1 and 2 contradict each other on different sheets of the same submission. The agent appears not to have synthesized the two — finding text quotes only "no visible flow direction arrows," matching call 1's verdict.

### Call 3 — AW-21, sheet 19 (`…og4a-run-1-cc-13`)

> **Question:** Are pipes that are 24 inches or larger in diameter (such as the 24" RCP storm drain line and 48" CSC water line) shown as double lines rather than single lines?

> **Result:** `classification=no`, confidence 0.95. *"No, pipes that are 24 inches or larger in diameter are depicted as single lines on this plan. The callouts for both the 24\" storm drain and 48\" water line point to standard single line types."*

The finding's reasoning blames "vision tool limitations" rather than crediting this answer.

## Recommendations

1. **File a bug to fix `tools_used` tracking.** Name-map `script:inspect-drawing` (or whatever the agent SDK records) into `tools_used` so downstream analysis can count usage. This was already a stated requirement of the experiment ("we want to grade tool choices") and the data is missing.
2. **Investigate why run-2 and run-3 didn't reach for the tool at all.** Same prompt, same items, same model — 3 calls in run-1, 0 in runs 2 / 3. Suggests prompt-priming variance rather than systematic gating. Worth re-running with a higher `runs` count (e.g. 5 or 10) to see whether the run-1 hit was lucky.
3. **Reconcile vision vs inspect-drawing when both are called and disagree.** The AW-23 case is illustrative — if inspect-drawing returns confidence 0.95 on a drawing-area question and vision contradicts it, the agent's prompt should weight inspect-drawing higher (it's the purpose-built tool). Consider adding explicit guidance to the experiment overlay.
4. **Push the agent harder on CC-22-14 and the cc-19 / cc-22 required items.** None of these items called the tool in any run. The current "Using the Inspect-Drawing Tool" section in the overlay may be too cc-13-focused (wastewater example) and not enough about non-utility cases (driveways, drainage easements). Adding a second example to the overlay prompt would be cheap.
5. **Even with low adoption, no misuse is encouraging.** The agent did not call inspect-drawing on any of the 393 vision-only / no-tool opportunities. If we can drive adoption up without losing this discipline, we're in good shape.

## TL;DR

Run-1 of the inspect-drawing experiment fired the tool **3 times total**, all in run-1 of cc-13, on the two canonical inspect-drawing-required items (AW-21, AW-23). All 3 calls produced confident structured outputs at the tool layer. **The tool worked**; the agent's adoption was sparse (15% hit rate on applicable required items), inconsistent across runs (3 calls in run-1, 0 in runs 2-3), and the agent often credited vision over inspect-drawing in its reasoning even when inspect-drawing answered the question. There's also a `tools_used` tracking bug that should be filed separately. Zero misuse on negative-grade items.
