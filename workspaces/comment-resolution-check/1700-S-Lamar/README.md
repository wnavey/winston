# 1700 S Lamar — comment-resolution-check target

The site plan used to prototype and now run the comment-resolution-check (CRC)
workflow. CRC grades whether a resubmission resolves each atomic comment from
the prior Master Comment Report (MCR) + redlines.

## Key IDs

| Thing | Value |
|---|---|
| projectId | `23301a8a-4cdb-4751-ac0c-93b97f0f5c12` |
| submissionId | `cf1201c2-2e8b-4034-9a5e-a70b6317e39a` |
| U0 (guides source) | submission version **4**, svid `6b9b85ed-e992-4906-a222-b24ee836910c` |
| U1 (resubmission) | submission version **5**, svid `4cfe4c36-c14e-4f5f-8b71-27c6fe3ed677` |
| CRC guides | gen 6, bucket `crc-guides` prefix `23301a8a…/cf1201c2…/4/6/` (291 atomic items, 24 dept guide files) |

Naming gotcha: "U0" here is submission version *number 4*; "U1" is version 5.

## Run-audit index (`crc-run-audits/`)

Audits are produced by the `audit-crc-run` skill; canonical copies live in
`~/noetic/crc-audits/<reviewId>/` locally. Start with each dir's
`crc-audit-agent-5-synthesis-summary.md` (run-2 used `agent-4` for synthesis).

| Dir | reviewId | Run date | What it was |
|---|---|---|---|
| `run-2-audit` | `3703349c` | 2026-06-23 | gen-1 guides, calibration (U0 vs itself) |
| `run-3-audit` | `a8d07d22` | 2026-06-25 | gen-2 guides, calibration |
| `run-4-audit` | `bfb4f256` | 2026-07-13 | gen-6 guides, calibration; the pre-game-day baseline |
| `run-5-audit` | `d1ff47e7` | 2026-06-30 | gen-6 guides, calibration (audited after run-4; numbering is audit order, not run order) |
| `run-6-audit` | `ed5e7ba9` | 2026-07-14 | **v5 game day — the first actual, customer-facing CRC run**: U1 (submission version 5) checked against the U0 MCR comments + redlines. Real review, not calibration, so no Agent-4 output-quality report (no ground truth). Verdict: HEALTHY WITH NOTES. |

Calibration runs review U0 against guides built from U0 itself, so every item
should come back `failed` — that implicit ground truth is what the audits'
output-quality dimension scores. Game-day/real runs (run-6 onward) have no
such ground truth.

## Related

- `../lamar-collier-v5-game-day/` — game-day design spec; fire payload in winston#171
- `../crc-workflow/bugs/` — CRC bug docs (e.g. STRUCT-OUTPUT-RETRY-STORM.md; run-6 found a new `__unparsedToolInput` variant)
- Run artifacts: Supabase `workflow-runs` bucket, `comment-resolution-check/<projectId>/<datetime>/`

## Files

- `1700-S-Lamar-U0-MCR.pdf` — the U0 Master Comment Report. Source: prior
  formal review of submission version 0.

## Not committed

- `1700 S Lamar Blvd Sp-2026-0136C AWPE U0 Redlines.pdf` (~127 MB) — the U0
  AWPE redlines PDF. Skipped from git (over GitHub's 100 MB file limit).
  Original lives at `~/noetic/tmp/comment-resolution-check/` locally; we'll
  wire up a non-git mechanism for sharing this when the workflow needs it.
