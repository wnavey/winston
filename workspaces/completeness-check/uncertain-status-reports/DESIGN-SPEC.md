# Completeness Check `uncertain` Status — Report Rendering — Design Spec

> **Status:** Draft, 2026-07-06. Follow-up to the
> [uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md)
> (winston #144), whose §9 deferred report handling per the 2026-07-06
> session. Parent feature shipped in bureau #509 + cityhall #565.
> Drives one small bureau-only PR.

---

## 1. Summary

Make the completeness-check markdown reports (the `format-reports` agent
step's consolidated + per-grouping outputs) render `uncertain` items
honestly instead of silently displaying their tentative verdict.

**The bug this fixes:** `format-reports` reads
`output/enriched-findings.json`, whose findings carry `winningFinding`
statuses — and the winning finding for an uncertain item is deliberately
the earliest run matching the *tentative* winner (that's how the parent
spec keeps `findingsDir` 4-state). So on a `runs >= 3` review, the
reports currently render every uncertain item as its tentative status
with full confidence — the report-level analog of the VersionTimeline
silent-FAIL problem the cityhall PR fixed (parent spec §8.4).

Fix shape (D1 below): `enrich-findings.ts` stamps the consolidated
truth (`consolidatedStatus` / `tentativeStatus` / `voteBreakdown`) onto
each enriched finding — a deterministic join in code — and the
`format-reports` prompt just renders it.

## 2. Decisions (locked, 2026-07-06 session)

| # | Decision | Choice |
|---|---|---|
| D1 | Where uncertain-awareness enters | **Option B — enrich stamps.** `enrich-findings.ts` accepts `--consolidatedFile` and stamps consolidated fields onto each finding. Rejected option A (prompt-only join of consolidated-findings.json by the agent): mechanical joins don't belong in an LLM. |
| D2 | Grouping rollup in the consolidated overview | ✗ when any displayed fail; **`?` when uncertain ≥ 1 and fail = 0**; ✓ otherwise. N/A ignored, as today. |
| D3 | `generate-reports.ts` | **Delete.** Referenced nowhere (not in workflow.yaml, no skill, no conductor call — only its own usage comment) and stale relative to the prompt-based reports. |
| D4 | Item rendering | CRC-D20 treatment: status `Uncertain` + consensus callout with tentative verdict + vote breakdown (+ missing-runs note). `?` marker in the consolidated items table. |
| D5 | Forced-finding precedence | **Enrich does NOT stamp consolidated fields on forced findings** — mirrors the clamp's existing forced-exemption pattern in the same script, so the display rule downstream stays a plain `consolidatedStatus ?? status` with no precedence logic in the prompt. A force that overrode an uncertain vote renders as the forced status (consistent with build-review-comments). |

## 3. Changes (all in `bureau/workflows/completeness-check/`)

### 3.1 `scripts/enrich-findings.ts`

- New **optional** arg `--consolidatedFile`. When absent or the file
  doesn't exist (runs=1 passthrough — the consolidate script doesn't
  write it), behavior is unchanged.
- Load `consolidated-findings.json` into a `ref → item` map (same shape
  `build-review-comments.ts` already declares: 5-state `status`,
  `tentativeStatus`, `voteBreakdown`).
- For each **non-forced** finding (D5), stamp onto the enriched finding:
  - `consolidatedStatus`: the 5-state consolidated status
  - `tentativeStatus`: non-null only when `consolidatedStatus='uncertain'`
  - `voteBreakdown`: `{ pass, fail, warn, "not-applicable", missing }`
- **Counts bucket on the displayed status**: `consolidatedStatus ?? status`
  (which for forced findings is just `status`). Add an `uncertain` key to
  per-grouping `counts` and `totals`. On runs=1 the bucket expression
  degenerates to `status` and `uncertain` is always 0 — totals identical
  to today.
- Sanity note (not a behavior change): for non-uncertain, non-forced
  items, `consolidatedStatus === status` by construction — both derive
  from the same post-clamp vote. If they ever diverge, that's clamp-rule
  drift (parent spec R1); worth a `console.warn` when stamping.

### 3.2 `scripts/build-review-comments.ts` (one-line type touch)

Widen the local `EnrichedData`/`EnrichedGrouping` counts types with the
optional `uncertain?: number` key so the enriched shape stays declared.
No behavior change — since bureau #509 the script derives its metadata
counts from the per-comment loop and only reads `enriched.totals.total`.

Future simplification (out of scope): BRC could read the stamped
`consolidatedStatus` instead of doing its own `consolidatedMap` lookup
for status precedence — but it still needs `consolidated-findings.json`
for `perRunFindings`/`sourceFindings`, so the win is marginal.

### 3.3 `prompts/format-reports.md`

- **Status vocabulary**: `Pass / Fail / Warn / Not Applicable / Uncertain`
  — drop the stale `Unclear` (removed from the agent contract in
  bureau #496/#509).
- **Display-status rule** (state it once, near the top): the status to
  render for every item is `consolidatedStatus ?? status`. Explain the
  one-liner: `consolidatedStatus` is stamped by enrich-findings from the
  cross-run vote; when present it is authoritative; forced findings
  never carry it.
- **Consolidated report — Overview rollup** (D2): per grouping,
  - ✗ if any displayed status is `fail`
  - `?` if no fails and ≥ 1 displayed `uncertain`
  - ✓ otherwise (N/A excluded, as today)
- **Consolidated report — metrics**: add uncertain to the headline
  counts (total uncertain) and to the per-grouping row (uncertain count
  alongside failures).
- **Consolidated report — Results tables**: marker legend becomes
  ✓ pass, ✗ fail, ⚠ warn, `?` uncertain (the existing `[checkmark/X/?]`
  header's `?` is repurposed from the dead unclear to uncertain; warn
  gets an explicit marker instead of today's unspecified rendering).
- **Detailed reports — uncertain items** (D4): render
  `**Status:** Uncertain`, then immediately below it a callout:

  ```
  > **Agent could not reach consensus.** Tentative verdict: **Fail** —
  > 2 fail / 1 pass across runs (1 run produced no finding). Please
  > review manually.
  ```

  Built from `tentativeStatus` + `voteBreakdown`; include the
  missing-runs clause only when `voteBreakdown.missing > 0`; list only
  non-zero vote buckets, severity order (fail, warn, pass, n/a). The
  Explanation/Evidence blocks below it stay — they come from the
  tentative winner's finding, which is exactly what the callout frames.
- `rephrased-items.json` (Output 3) is untouched — titles are
  status-independent.

### 3.4 `workflow.yaml`

- `enrich-findings` step args gain
  `consolidatedFile: "{{ WORKSPACE_PATH }}/output/consolidated-findings.json"`.
- Version `1.2.0 → 1.3.0`.

### 3.5 Delete `scripts/generate-reports.ts` (D3)

Dead code: not wired into workflow.yaml, no skill or conductor
references. The prompt-based `format-reports` step superseded it. If
someone needs an offline report from run artifacts later, resurrect
from git history.

## 4. Data shape — `enriched-findings.json` additions

```jsonc
{
  "groupings": [{
    "id": "cc-13",
    "findings": [{
      "checklistItemId": "AW-01",
      "status": "fail",                  // winningFinding status (4-state, tentative-shaped for uncertain items) — unchanged
      "consolidatedStatus": "uncertain", // NEW — 5-state; absent on runs=1 and on forced findings
      "tentativeStatus": "fail",         // NEW — only when consolidatedStatus='uncertain'
      "voteBreakdown": { "pass": 1, "fail": 1, "warn": 1, "not-applicable": 0, "missing": 0 }, // NEW
      /* …existing fields… */
    }],
    "counts": { "pass": 9, "fail": 2, "warn": 1, "uncertain": 1, "notApplicable": 3, "total": 16 }
  }],
  "totals": { "pass": 98, "fail": 15, "warn": 6, "uncertain": 8, "notApplicable": 67, "total": 194 }
}
```

## 5. Test plan

1. **Fixture chain** (extends the parent PR's synthetic smoke): runs=3
   fixtures with one uncertain, one advisory-clamped, one forced item →
   `cross-run-consolidate-cc` → `enrich-findings --consolidatedFile=…`.
   Verify: uncertain item stamped with all three fields; forced item NOT
   stamped; counts include `uncertain: 1` and partition `total`; runs=1
   invocation without the file byte-identical to today.
2. **Prompt check** on a real `runs=3` smoke run (folds into the parent
   spec's §10 smoke test): consolidated report shows the `?` grouping
   rollup (uncertain ≥ 1, fail = 0 case), uncertain metrics, `?` item
   markers; detailed report shows the callout with correct vote counts;
   no "Unclear" anywhere in output.
3. Grep the repo post-delete for `generate-reports` — only git history.

## 6. Out of scope

- Any cityhall change (reports are run artifacts, not UI).
- A customer-facing CC PDF (no such deliverable exists today; if one is
  built, it should read the same stamped enriched shape).
- BRC consuming the stamped fields (noted in §3.2 as marginal).

## 7. References

| Thing | Path |
|---|---|
| Parent spec (§9 deferred to here) | `winston/workspaces/completeness-check/uncertain-status/DESIGN-SPEC.md` |
| Parent impl PRs | bureau #509, cityhall #565 |
| format-reports prompt | `bureau/workflows/completeness-check/prompts/format-reports.md` |
| enrich script | `bureau/workflows/completeness-check/scripts/enrich-findings.ts` |
| Dead script to delete | `bureau/workflows/completeness-check/scripts/generate-reports.ts` |
| CRC PDF rendering rule (D20 treatment source) | `winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md` §9 |
