# Vision Tool Usage Analysis — runs=10 baseline

**Review:** `24f98e83-282e-48c4-bae2-767e454810a5` · 1700 S. Lamar · `runs=10` · 2026-04-28T23:33Z

Counts of `mcp__conductor_tools__vision` and `mcp__conductor_tools__run_semantic_search_blocks` `tool_use` events across all 130 agent tasks (10 runs × 13 groupings), extracted from the conductor log. Per-task breakdown in [`vision-usage-by-task.tsv`](./vision-usage-by-task.tsv).

---

## Total: 590 vision calls + 438 semantic-search calls across the review

Both numbers reconcile with the workflow-level rollup the conductor wrote into `review_comments.agent_trace` (see structured-output-data-loss.md from the review baseline).

## Per-grouping vision usage (10 runs aggregated)

| Rank | Grouping | Description | Vision calls | Tasks using vision | Per task (avg / max) | Refs in grouping | Calls per ref | Search calls |
|---|---|---|---:|---:|---|---:|---:|---:|
| 1 | **cc-23** | Landscape Plan | **101** | 10/10 | 10.1 / 12 | 11 | 9.2 | 51 |
| 2 | **cc-2** | Vicinity / Project ID | **100** | 10/10 | 10.0 / 17 | 6 | **16.7** | 24 |
| 3 | **cc-1** | General Submittal | **64** | 10/10 | 6.4 / 13 | 33 | 1.9 | 17 |
| 4 | cc-22 | Tree Plan | 53 | 10/10 | 5.3 / 7 | 14 | 3.8 | 33 |
| 5 | cc-13 | AW General Reqs | 52 | 8/10 | 6.5 / 11 | 37 | 1.4 | 64 |
| 6 | cc-24 | Lighting | 50 | 10/10 | 5.0 / 7 | 9 | 5.6 | 53 |
| 7 | cc-5 | Existing Conditions | 49 | 10/10 | 4.9 / 7 | 14 | 3.5 | 25 |
| 8 | cc-6 | Demo / Tree Survey | 30 | 9/10 | 3.3 / 7 | 3 | 10.0 | 24 |
| 9 | cc-3 | Site Plan Cover Sheet | 28 | 10/10 | 2.8 / 6 | 11 | 2.5 | 67 |
| 10 | cc-10 | Site Plan Notes | 27 | 10/10 | 2.7 / 4 | 4 | 6.8 | 31 |
| 11 | cc-20 | Erosion & Sedimentation | 16 | 10/10 | 1.6 / 3 | 7 | 2.3 | 1 |
| 12 | cc-19 | Utility Plan | 11 | 6/10 | 1.8 / 3 | 22 | 0.5 | 24 |
| 13 | cc-15 | Drainage / Water Quality | 9 | 4/10 | 2.2 / 3 | 14 | 0.6 | 24 |

**Total: 590 vision · 438 search**

Two top-3 lists fall out of the data, depending on the question being asked:

| Question | Top 3 |
|---|---|
| **Most absolute vision load** | cc-23 (101), cc-2 (100), cc-1 (64) |
| **Most vision per checklist item** (call density) | cc-2 (16.7), cc-6 (10.0), cc-23 (9.2) |
| **Highest variance-AND-vision overlap** | cc-22 (57% split, 53 calls), cc-23 (45%, 101), cc-13 (32%, 52) |

---

## Recommendation: top 3 to focus on

| # | Grouping | Why |
|---|---|---|
| **1** | **cc-23 — Landscape Plan** | Heaviest absolute vision usage (101 calls). Every task uses vision. Also has 45% split-verdict rate including `cc-23:CC-23-07` — the only 3-way split in the entire review. **Vision determinism here would simultaneously reduce cost AND fix high-leverage variance.** |
| **2** | **cc-2 — Vicinity / Project Identification** | **Highest per-item vision density** (16.7 calls per ref). Only 6 checklist items but up to 17 calls per task. Worst cost-per-finding ratio in the review. Worth investigating *why* — likely repeated re-reads of the cover/vicinity blocks. |
| **3** | **cc-1 — General Submittal** | Third-most calls (64), every task uses vision. Includes `CC-1-26` (PE seal sampling) and `CC-1-02` (form-field reading) — both are vision-dependent items that surfaced in the high-variance analysis. |

Together these three account for **265 of 590 vision calls (45% of the review)**.

## Why these specifically

These three give the most leverage for two interventions simultaneously:

1. **Cost / latency reduction.** A response cache keyed by `(documentId, sheetNumber, prompt-hash)` would deduplicate aggressively here. cc-2's 17-calls-per-task max strongly suggests the same vicinity/cover blocks are being re-queried on different items.

2. **Vision-nondeterminism remediation** (the headline finding from [`high-variance-items-analysis.md`](./high-variance-items-analysis.md)). Of the four vision-driven split-verdict refs identified there:
   - `cc-23:CC-23-01` (existing ROW widths) — in cc-23 ✓
   - `cc-13:AW-23` and `cc-13:AW-27` — in cc-13 (rank 5)
   - `cc-22:CC-22-14` — in cc-22 (rank 4)
   - Plus `cc-1:CC-1-26` (PE seal sampling) — in cc-1 ✓

So focusing on cc-23 + cc-1 + cc-13 covers most of the documented vision-driven splits. cc-2 is in the top 3 for cost reasons rather than quality (it doesn't have documented vision-driven splits).

## Caveats

- These counts are vision **tool-use invocations**, not vision LLM token cost. A short "is this field filled?" call costs less than "describe everything on this sheet." For cost-weighted ranking, the conductor's `output/vision-log.jsonl` (sibling to the findings) has per-call payloads.
- Per-task call counts in [`vision-usage-by-task.tsv`](./vision-usage-by-task.tsv) show variance even within a grouping. cc-2's max (17) vs avg (10) on the same 6 items in different runs is itself a signal about agent-loop variance worth investigating separately.
- `tasks_with_vision < 10` for cc-13 (8/10), cc-15 (4/10), and cc-19 (6/10) means some runs answered those groupings purely from text reads. cc-15 and cc-19 are mostly text/notes-driven groupings; cc-13's 2 vision-skipping runs had `tools_used = []` for most findings.
