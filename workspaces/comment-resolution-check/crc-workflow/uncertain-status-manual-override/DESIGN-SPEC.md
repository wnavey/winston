# CRC `uncertain` Manual Override — Design Spec

> **Status: SUPERSEDED, 2026-06-29.** This spec has been subsumed by the
> [comment-triage-rework DESIGN-SPEC](../comment-triage-rework/DESIGN-SPEC.md).
>
> The user-adjudication surface for `uncertain` items folds into the same
> per-workflow verdict-pick UI defined there (see §6 of the rework spec, and
> the explicit supersede flag at D19). Nothing in this directory should be
> implemented in isolation; treat this file as a historical pointer.

---

## Why this was rolled into the rework

The earlier framing (this stub, drafted 2026-06-25) committed to **Path A**:
the user's choice lives in a new orthogonal `output_json.userAdjudicatedStatus`
field on each `review_comment` row, distinct from the existing 5-value
`comment_triage.triage_status` enum. The agent's verdict stayed read-only.

The 2026-06-29 design pass for the broader comment-triage rework re-evaluated
that decision in light of two new constraints:

1. **CRC's 5-value generic triage states (`to-fix` / `formal-note` / `incorrect` /
   `na` / `new`) were being dropped** in favor of a per-workflow verdict-pick
   UI whose options *are* the verdict statuses (`Resolved` / `Failed` /
   `Uncertain`). Once the user's triage choice becomes the verdict, there's no
   second surface to put `userAdjudicatedStatus` on — it would be a duplicate
   of `comment_triage.triage_status`.

2. **The "agent verdict is read-only" guardrail is now satisfied by the
   existing column split**: `review_comments.output_json.status` (agent's
   call, never written by cityhall) vs. `comment_triage.triage_status`
   (user's pick, written only on override). No new sibling field is needed.

The Path A goals all carry over, but the mechanism collapses:

| Path A goal (this spec) | How the rework satisfies it |
|---|---|
| User's choice lives separately from agent's call | `comment_triage.triage_status` (user) vs. `review_comments.output_json.status` (agent). Distinct rows, distinct tables. |
| Pre-fill the dropdown sensibly | Agent verdict auto-selected (consistent with non-uncertain rows). `tentativeStatus` shown as informational context inside the triage panel — not auto-prefilled. See D20 in the rework spec. |
| Decouple from triage | No longer applicable — the rework explicitly unifies them. |
| Future per-item adjudication note | `comment_triage.triage_note` already exists. |

The open items in §4 of the original stub are resolved or scoped out by the
rework:

| Original open item | Disposition |
|---|---|
| Triage interaction (does it auto-write a triage row?) | YES — the user's verdict pick *is* the triage row. Rework D11 + §6.3. |
| PDF rendering of overrides | Deferred. Rework §3 non-goals + §14 follow-ups. |
| Cityhall UX (dropdown? confirmation? undo?) | Per-agent-verdict button set inside the existing `CommentTriagePanel`, lazy DB writes, no confirmation step, click again to revert. Rework §6.2 / §6.3. |
| Permissions | Anyone with project view-access can override. Rework D24. |
| Audit trail (`userAdjudicatedBy` / `userAdjudicatedAt`) | Deferred for MVP. Rework D3 / §14. |
| Bulk adjudication | Deferred for MVP. Rework D18 / §14. |
| Eval impact | Still applies; signal is now derivable from `comment_triage.triage_status ≠ output_json.status` joined to `reviews.review_type = 'crc'`. |

---

## Where to read next

- **Active spec:** [`../comment-triage-rework/DESIGN-SPEC.md`](../comment-triage-rework/DESIGN-SPEC.md)
- **Sibling context still load-bearing:**
  - [`../uncertain-status/DESIGN-SPEC.md`](../uncertain-status/DESIGN-SPEC.md) — the 4-state consolidated status itself, `tentativeStatus` persistence, the runs ≥ 3 gate.
  - [`../majority-vote/DESIGN-SPEC.md`](../majority-vote/DESIGN-SPEC.md) — the cross-run consolidation foundation.
- **Parent spec:** [`../DESIGN-SPEC.md`](../DESIGN-SPEC.md) — CRC workflow design overall.
