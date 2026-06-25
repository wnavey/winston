# CRC `uncertain` Manual Override — Design Spec

> **Status:** Stub, 2026-06-25. Sibling of the
> [uncertain-status DESIGN-SPEC](../uncertain-status/DESIGN-SPEC.md).
> Spec body to be drafted; this file captures the **Path A** framing that
> the uncertain-status spec's guardrails commit to (§3.1) so the design
> conversation has a starting point.

---

## 1. Summary

Add a user-adjudication surface for CRC items whose consolidated `status` is
`'uncertain'`. The user picks one of `resolved | failed | not-applicable`
("I think this is actually X") and that choice is persisted alongside the
agent's verdict — never overwriting it.

> **Path A locked.** Per the 2026-06-25 grilling session, the user's choice
> lives in an **orthogonal `userAdjudicatedStatus` field on
> `review_comments.output_json`**. The agent's `status` stays the queryable
> "original call." Reverses the cityhall-ui DESIGN-SPEC Q15 framing from
> "read-only because we don't override" to "read-only because it's the
> agent's snapshot."

## 2. Goals

- **Resolve uncertainty without losing provenance.** The agent's verdict
  remains queryable so we can compute "% of uncertain items the user agreed
  with the agent's tentative call" as an accuracy signal once we have data.
- **Pre-fill the override dropdown sensibly.** Default to
  `tentativeStatus` (already persisted by the uncertain-status spec — see
  guardrail #2 in [its §3.1](../uncertain-status/DESIGN-SPEC.md#31-guardrails-for-the-future-override-spec)).
- **Decouple from triage.** `comment_triage` writes stay lazy-on-touch per
  cityhall-ui DESIGN-SPEC Q13; this spec does not extend the 5-value triage
  status set. (Open question for the spec proper — do we want to?)

## 3. Path A vs Path B (and why Path A)

The 2026-06-25 grilling session evaluated two ways to surface user choice:

| Path | Where the user's choice lives | Pros | Cons |
|---|---|---|---|
| **A — chosen** | New sibling field `output_json.userAdjudicatedStatus` (3-state: `resolved | failed | not-applicable | null`) | Agent verdict stays intact + queryable as "original call." Symmetric with `tentativeStatus` (both pre-filled, both omittable). Future-proof: a per-item `userAdjudicationNote` can ride along on the same row. | Two status fields to reason about. Renderers must consciously pick which one to display (typically: prefer `userAdjudicatedStatus` if set, fall back to `status`). |
| B — rejected | Mutate `output_json.status` directly, store agent's original in `output_json.agentStatus` | Single status field for renderers. | Inverts the "agent verdict is read-only" contract from the uncertain-status spec's guardrail #1. Every existing CRC query that reads `status` would need an audit. Also makes "did the user agree with the agent" a harder query. |

Path A keeps the surface narrow: existing renderers continue to read
`status` and see `'uncertain'`; new override-aware renderers also read
`userAdjudicatedStatus` and prefer it when set.

## 4. Open items for the spec proper

The pieces still to design (this stub doesn't lock them):

1. **Triage interaction.** Does setting `userAdjudicatedStatus` auto-write a
   `comment_triage` row? Currently leaning **no** — keep triage orthogonal
   per the uncertain-status spec §3.1 / Q19.
2. **PDF rendering.** When `userAdjudicatedStatus` is set, the PDF should
   render the user's call as the effective verdict and the agent's
   tentative call as context — but how? A "User-adjudicated as X (agent
   was uncertain, tentative Y)" callout?
3. **Cityhall UX.** Dropdown in the comment-detail panel? Inline pill swap?
   Confirmation step? Undo affordance? Persistence latency (optimistic vs.
   wait-for-server)?
4. **Permissions / who can adjudicate.** All viewers? Reviewers only?
   Applicant vs. city-staff role split? (Almost certainly project-member-
   scoped, but RLS policy needs writing.)
5. **Audit trail.** Do we capture *who* adjudicated and *when*, beyond just
   the value? Likely yes — `userAdjudicatedBy`, `userAdjudicatedAt` siblings
   on `output_json` mirror the `backfilledAt` pattern.
6. **Bulk adjudication.** Can a user mark N uncertain items as "I trust the
   agent's tentative call" in one action? Big win on the applicant side if
   the tentative is usually right.
7. **Eval impact.** Once we have user adjudication data, it becomes a free
   ground-truth signal — "% of uncertain items where the user kept the
   tentative" is a calibration metric for `uncertainThreshold`.

## 5. References

| Thing | Path |
|---|---|
| Uncertain-status spec (sibling) | `../uncertain-status/DESIGN-SPEC.md` |
| CRC SPEC | `../../SPEC.md` |
| CRC workflow DESIGN-SPEC | `../DESIGN-SPEC.md` |
| Cityhall UI DESIGN-SPEC | `../../cityhall-ui/DESIGN-SPEC.md` |
