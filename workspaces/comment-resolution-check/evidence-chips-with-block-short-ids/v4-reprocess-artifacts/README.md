# v4 reprocess artifacts — Lamar + Collier submission v4

Artifacts from the partial reprocess described in
[`../Lamar-Collier-v4-partial-reprocess-plan.md`](../Lamar-Collier-v4-partial-reprocess-plan.md).

**Executed 2026-07-09.** All 57 sheet_versions under plan_set_version
`e9111f12-a156-4ed1-9446-8770de2407b4` were converted to
`block_numbering_scheme = 'short-id-ordered'` with regenerated reading guides.
Live-verified: 57/57 short-id-ordered, 0 null/short guides, 0 out-of-range
"Block N" references.

Script: `substation/scripts/regen-reading-guides-v4.ts`.

## Files

`snapshot-preflip-*.json` — pre-flip row dumps (one per script invocation).
`run-log-*.json` — per-sheet outcomes for each `run` invocation.

Snapshot timeline (each invocation writes a snapshot before its first write):

| Snapshot | State captured | Clean pre-flip? |
|---|---|---|
| `16-45-24Z` | snapshot-only run — all 57 legacy | ✅ |
| `16-47-04Z`, `16-47-52Z` | dry-run canaries — all 57 legacy | ✅ |
| **`16-54-47Z`** | `run --limit 1`, before its write — all 57 legacy | ✅ **canonical** |
| `16-55-39Z` | full `run`, taken AFTER sheet 1 was already flipped by the limit-1 run — 56 legacy, 1 short-id-ordered | ⚠️ NOT clean |

## Rollback

Use the **canonical** clean pre-flip snapshot `snapshot-preflip-2026-07-09T16-54-47Z.json`
(last snapshot taken while all 57 rows were still legacy). Do **not** use
`16-55-39Z` — sheet 1 is already flipped in it.

For each row: restore `reading_guide` from the snapshot and set
`block_numbering_scheme = 'legacy-category-order'`.
