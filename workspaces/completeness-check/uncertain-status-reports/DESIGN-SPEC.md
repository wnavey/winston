# Completeness Check `uncertain` Status — Report Rendering — Design Spec

> **Status:** Draft, 2026-07-06 (rev 2 — added the substation PDF
> surface, §3.6). Follow-up to the
> [uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md)
> (winston #144), whose §9 deferred report handling per the 2026-07-06
> session. Parent feature shipped in bureau #509 + cityhall #565.
> Drives one small bureau PR + one small substation PR.

---

## 1. Summary

Make BOTH completeness-check report surfaces render `uncertain` items
honestly instead of silently displaying a wrong verdict:

1. **Bureau markdown run-artifacts** — the `format-reports` agent
   step's consolidated + per-grouping outputs (§3.1–§3.5).
2. **Substation PDF** — the `/completeness-check-pdf` route +
   `CompletenessCheckReportDocument` React-PDF renderer, the
   customer-facing "Download PDF" (§3.6). **Missed by both prior specs**
   — the parent spec's consumer sweep audited cityhall only.

**The markdown bug:** `format-reports` reads
`output/enriched-findings.json`, whose findings carry `winningFinding`
statuses — and the winning finding for an uncertain item is deliberately
the earliest run matching the *tentative* winner (that's how the parent
spec keeps `findingsDir` 4-state). So on a `runs >= 3` review, the
reports currently render every uncertain item as its tentative status
with full confidence.

**The PDF bug (worse, and live since bureau #509 merged):**
`completeness-check-pdf.ts`'s `normalizeStatus()` coerces any status
outside its allow-list to **`'fail'`** — the exact `.catch('fail')`
hazard pattern the parent spec's §8.5 warned about, in a repo nobody
audited. The first `runs >= 3` review with an uncertain item renders it
as a confident FAIL in the PDF.

Fix shapes: for markdown, `enrich-findings.ts` stamps the consolidated
truth (`consolidatedStatus` / `tentativeStatus` / `voteBreakdown`) onto
each enriched finding — a deterministic join in code — and the
`format-reports` prompt just renders it (D1). For the PDF, widen the
allow-list + status components and render the D20 callout (§3.6).

## 2. Decisions (locked, 2026-07-06 session)

| # | Decision | Choice |
|---|---|---|
| D1 | Where uncertain-awareness enters | **Option B — enrich stamps.** `enrich-findings.ts` accepts `--consolidatedFile` and stamps consolidated fields onto each finding. Rejected option A (prompt-only join of consolidated-findings.json by the agent): mechanical joins don't belong in an LLM. |
| D2 | Grouping rollup in the consolidated overview | ✗ when any displayed fail; **`?` when uncertain ≥ 1 and fail = 0**; ✓ otherwise. N/A ignored, as today. |
| D3 | `generate-reports.ts` | **Delete.** Referenced nowhere (not in workflow.yaml, no skill, no conductor call — only its own usage comment) and stale relative to the prompt-based reports. |
| D4 | Item rendering | CRC-D20 treatment: status `Uncertain` + consensus callout with tentative verdict + vote breakdown (+ missing-runs note). `?` marker in the consolidated items table. |
| D5 | Forced-finding precedence | **Enrich does NOT stamp consolidated fields on forced findings** — mirrors the clamp's existing forced-exemption pattern in the same script, so the display rule downstream stays a plain `consolidatedStatus ?? status` with no precedence logic in the prompt. A force that overrode an uncertain vote renders as the forced status (consistent with build-review-comments). |

## 3. Changes (§3.1–§3.5 in `bureau/workflows/completeness-check/`; §3.6 in substation)

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

### 3.6 Substation PDF (`/completeness-check-pdf`) — separate PR

The customer-facing PDF reads `reviews` + `review_comments.output_json`
directly from Supabase and renders via React-PDF. Changes:

**`src/routes/completeness-check-pdf.ts`:**
- Add `'uncertain'` to the local `Status` type and `ALLOWED_STATUSES`.
  This alone defuses the `normalizeStatus() → 'fail'` coercion.
- Parse `tentativeStatus` (string, validated against the 4-state agent
  enum) and `voteBreakdown` (object, defensively) from
  `commentJson` into the comment passed to the document.

**`src/pdf/components/status.ts`:**
- Add `'uncertain'` to the shared `Status` union with
  `STATUS_LABEL: 'Uncertain'`, `STATUS_COLOR: '#D97706'` (amber —
  matches cityhall's amber pill; shares the hue with legacy `unclear`,
  acceptable since the two never co-occur), and
  `STATUS_COLOR_SOFT: '#FFFBEB'`.

**`src/pdf/completeness-check-document.tsx`:**
- `CcReviewComment`: optional `tentativeStatus` / `voteBreakdown`.
- `countByStatus`: add the `uncertain` bucket. (`getEffectiveStatus`
  needs no change — triage overrides only rewrite `fail`.)
- Summary page: `uncertain` StackedBar segment + count chip and a
  section-table column, both conditional on `overallCounts.uncertain > 0`
  — mirror the existing `showUnclear` pattern exactly.
- Section rows: `hasIssue` includes `uncertain` (warning icon).
- `STATUS_GROUP_ORDER`: `fail, warn, uncertain, unclear, pass,
  not-applicable` (matches cityhall's CC tab order).
- Per-item rendering in the Uncertain group: the D20 callout as an
  annotation line between title and explanation — "Agent could not
  reach consensus. Tentative verdict: Fail — 2 fail / 1 pass across
  runs (1 run produced no finding)." Non-zero buckets only, severity
  order, missing clause only when > 0. Built by a pure helper so it's
  unit-testable.
- `DetailMeta` (Reference Docs / Resolution lines): render for
  `uncertain` items too — the resolution carried from the tentative
  winner is exactly what the reader needs behind the callout.

**Deploy note:** unlike the parent feature there is no ordering
constraint against bureau (already merged) — but ship this promptly:
until it deploys, any uncertain item renders as FAIL in downloaded
PDFs. The change is backward-compatible with all existing reviews.

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
4. **Substation**: unit test the callout-text helper; render the PDF for
   a review with uncertain items (once one exists post-smoke-test) and
   verify the chip/column/group/callout; render an old 4-state review
   and confirm byte-identical layout (conditional chrome hidden).

## 6. Out of scope

- Any cityhall change (the cityhall UI shipped in #565; the markdown
  reports are run artifacts).
- BRC consuming the stamped fields (noted in §3.2 as marginal).
- CRC's PDF (`generate-crc-report` skill) — separate pipeline, its
  uncertain rendering is specced in the CRC uncertain-status spec §9.

## 7. References

| Thing | Path |
|---|---|
| Parent spec (§9 deferred to here) | `winston/workspaces/completeness-check/uncertain-status/DESIGN-SPEC.md` |
| Parent impl PRs | bureau #509, cityhall #565 |
| format-reports prompt | `bureau/workflows/completeness-check/prompts/format-reports.md` |
| enrich script | `bureau/workflows/completeness-check/scripts/enrich-findings.ts` |
| Dead script to delete | `bureau/workflows/completeness-check/scripts/generate-reports.ts` |
| CRC PDF rendering rule (D20 treatment source) | `winston/workspaces/comment-resolution-check/crc-workflow/uncertain-status/DESIGN-SPEC.md` §9 |
